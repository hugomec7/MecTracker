#!/usr/bin/env node
// Mec Tracker MCP server.
//
// Lets Claude (Desktop or Code) drive the Mec Tracker panel in Premiere Pro through short commands
// instead of screenshots and clicks.
//
//   Claude  <-- MCP over stdio -->  this server  <-- WebSocket on 127.0.0.1:47321 -->  Mec Tracker panel
//
// UXP panels cannot listen on a port, so the panel connects to us as a WebSocket client
// (Help tab > "Allow Claude to control the panel"). No dependencies: Node 18+ only.
'use strict';

const http = require('http');
const crypto = require('crypto');

const VERSION = '3.4.0';
const PORT = Number(process.env.MECTRACKER_PORT) || 47321;
const HOST = '127.0.0.1';
const CMD_TIMEOUT = 20000;
const DEFAULT_WAIT = 45;
const MAX_WAIT = 600;

function warn(...a) { process.stderr.write('[mectracker] ' + a.join(' ') + '\n'); }

// ------------------------------------------------------------------ WebSocket (panel side)
let panel = null;          // { socket, version, lang }
let listening = false;
let portBusy = false;
let nextId = 1;
const pending = new Map(); // command id -> { resolve, reject, timer }
const jobs = new Map();    // job id -> finished job
const jobWaiters = new Map(); // job id -> [resolve]

function encodeFrame(text, opcode = 0x1) {
  const data = Buffer.from(text, 'utf8');
  const len = data.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, data]);
}

function attach(socket) {
  let buf = Buffer.alloc(0);
  let parts = [];
  const conn = { socket, version: null, lang: null };

  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 64 * 1024 * 1024) { socket.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) return;
      let payload = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      buf = buf.subarray(need);
      if (op === 0x8) { try { socket.end(encodeFrame('', 0x8)); } catch (e) {} return; }
      if (op === 0x9) { try { socket.write(encodeFrame(payload.toString('utf8'), 0xA)); } catch (e) {} continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x0) {
        parts.push(payload);
        if (fin) { const text = Buffer.concat(parts).toString('utf8'); parts = []; onPanelMessage(conn, text); }
      }
    }
  });
  const gone = () => {
    if (panel === conn) {
      panel = null;
      warn('panel disconnected');
      for (const [id, p] of pending) { clearTimeout(p.timer); p.reject(new Error('The Mec Tracker panel disconnected.')); pending.delete(id); }
    }
  };
  socket.on('close', gone);
  socket.on('error', gone);
  return conn;
}

function onPanelMessage(conn, text) {
  let m; try { m = JSON.parse(text); } catch (e) { return; }
  if (m.type === 'hello') {
    if (panel && panel !== conn) { try { panel.socket.destroy(); } catch (e) {} }
    panel = conn; conn.version = m.version; conn.lang = m.lang;
    jobs.clear();
    warn('panel connected, version', m.version);
    return;
  }
  if (conn !== panel) return;
  if (m.type === 'reply') {
    const p = pending.get(m.id); if (!p) return;
    pending.delete(m.id); clearTimeout(p.timer);
    if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || 'Error in the panel.'));
  } else if (m.type === 'job' && m.job) {
    jobs.set(m.job.id, m.job);
    const w = jobWaiters.get(m.job.id) || []; jobWaiters.delete(m.job.id);
    w.forEach((r) => r(m.job));
  }
}

function notConnected() {
  if (portBusy) return new Error(`Port ${PORT} is already used by another program (probably another Claude window with the Mec Tracker connector). Close the other one, or set MECTRACKER_PORT.`);
  return new Error('The Mec Tracker panel is not connected. If Mec Tracker is not installed in Premiere (or is older than 3.4.0), call mectracker_install_plugin. Otherwise: in Premiere Pro open Window > UXP Plugins > Mec Tracker, go to the Help tab and tick "Allow Claude to control the panel" (it connects within ~10 s). Mec Tracker 3.4.0 or newer is needed.');
}

function send(cmd, args) {
  if (!panel) return Promise.reject(notConnected());
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('The panel did not answer in time (Premiere may be busy).')); }, CMD_TIMEOUT);
    pending.set(id, { resolve, reject, timer });
    try { panel.socket.write(encodeFrame(JSON.stringify({ type: 'cmd', id, cmd, args: args || {} }))); }
    catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
  });
}

function waitJob(id, seconds) {
  if (jobs.has(id)) return Promise.resolve(jobs.get(id));
  return new Promise((resolve) => {
    const list = jobWaiters.get(id) || []; jobWaiters.set(id, list);
    const done = (j) => { clearTimeout(timer); resolve(j); };
    const timer = setTimeout(() => { const l = jobWaiters.get(id) || []; const i = l.indexOf(done); if (i >= 0) l.splice(i, 1); resolve(null); }, seconds * 1000);
    list.push(done);
  });
}

function okOrigin(req) {
  // block web pages: a browser always sends an http(s) Origin; the UXP panel does not
  const origin = String(req.headers.origin || '');
  if (/^https?:/i.test(origin)) return false;
  const host = String(req.headers.host || '').replace(/:\d+$/, '');
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '';
}

function startSocketServer() {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Mec Tracker MCP ' + VERSION + '\n'); });
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key || !okOrigin(req) || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    socket.setNoDelay(true);
    attach(socket);
  });
  server.on('error', (e) => {
    listening = false;
    if (e.code === 'EADDRINUSE') { if (!portBusy) warn('port', PORT, 'in use, retrying every 5 s'); portBusy = true; setTimeout(startSocketServer, 5000).unref(); }
    else { warn('socket server error:', e.message); setTimeout(startSocketServer, 5000).unref(); }
  });
  server.listen(PORT, HOST, () => { listening = true; portBusy = false; warn('waiting for the panel on ws://' + HOST + ':' + PORT); });
}

// ------------------------------------------------------------------ instalar o plugin no Premiere
// Baixa a release mais nova do GitHub, extrai (tar entende zip no Windows 10+ e no Mac) e roda o
// instalador do zip: no Windows abre o Install-Windows.bat (pede permissão de administrador),
// no Mac pede a senha numa janela do sistema (osascript) e roda o Install-Mac.command.
const REPO = 'hugomec7/MecTracker';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, Object.assign({ maxBuffer: 16 * 1024 * 1024 }, opts), (err, stdout, stderr) => {
      if (err) { err.message += (stderr ? '\n' + stderr : ''); reject(err); } else resolve(String(stdout));
    });
  });
}
function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name === name) return p;
    if (e.isDirectory()) { const r = findFile(p, name); if (r) return r; }
  }
  return null;
}
function newerOrSame(a, b) {
  const x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return true;
}
async function installPremierePlugin() {
  if (process.platform !== 'win32' && process.platform !== 'darwin') throw new Error('Premiere Pro only runs on Windows and macOS.');
  const headers = { 'User-Agent': 'mectracker-mcp', Accept: 'application/vnd.github+json' };
  // a maior versão publicada que tenha um zip (a "latest" do GitHub pode ser uma release sem arquivo)
  const list = await (await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers })).json();
  if (!Array.isArray(list)) throw new Error('Could not read the releases of ' + REPO + ' on GitHub' + (list && list.message ? ': ' + list.message : '.'));
  const ok = list.filter((r) => !r.draft && !r.prerelease && (r.assets || []).some((x) => /\.zip$/i.test(x.name)));
  ok.sort((p, q) => (newerOrSame(p.tag_name, String(q.tag_name).replace(/^v/, '')) ? -1 : 1));
  const rel = ok[0];
  if (!rel) throw new Error('No release with a zip found in ' + REPO + '.');
  const asset = rel.assets.find((x) => /\.zip$/i.test(x.name));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mectracker-'));
  const zip = path.join(dir, asset.name);
  const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'mectracker-mcp' } });
  if (!res.ok) throw new Error('Download failed: HTTP ' + res.status);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  await run('tar', ['-xf', zip, '-C', dir]);
  const out = { version: rel.tag_name, downloaded: asset.name, folder: dir };
  if (!newerOrSame(rel.tag_name, '3.4.0')) out.warning = 'This release is older than 3.4.0 and has no "Allow Claude to control the panel" option yet.';
  if (process.platform === 'win32') {
    const bat = findFile(dir, 'Install-Windows.bat');
    if (!bat) throw new Error('Install-Windows.bat not found in the zip.');
    spawn('cmd.exe', ['/c', 'start "" "' + bat + '"'], { cwd: path.dirname(bat), detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
    out.status = 'The installer window is open. Accept the administrator prompt (Yes), wait for "Done" and press a key to close it.';
  } else {
    const sh = findFile(dir, 'Install-Mac.command');
    if (!sh) throw new Error('Install-Mac.command not found in the zip.');
    const q = (t) => "'" + t.replace(/'/g, "'\\''") + "'";
    const script = 'do shell script ' + JSON.stringify('/bin/bash ' + q(sh)) + ' with administrator privileges with prompt "Mec Tracker wants to install its Premiere Pro plugin."';
    out.log = (await run('osascript', ['-e', script])).trim();
    out.status = 'Installed.';
  }
  out.next = 'Restart Premiere Pro, open Window > UXP Plugins > Mec Tracker, go to Help and tick "Allow Claude to control the panel".';
  return out;
}

// ------------------------------------------------------------------ MCP tools
const clipsProp = {
  type: 'array', items: { type: 'string' },
  description: 'Clip ids from mectracker_list_clips (e.g. "V1-0"). Leave out to use the clips selected on the timeline.',
};
const waitProp = { type: 'number', description: `Seconds to wait for the result (default ${DEFAULT_WAIT}, max ${MAX_WAIT}). If it is still running, call mectracker_wait.` };

const TOOLS = [
  {
    name: 'mectracker_status',
    description: 'Mec Tracker panel state: connection, active sequence, playhead, selected clips, options, stored tracks and the current/last job. Call this first.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'mectracker_list_clips',
    description: 'Lists every video clip in the active sequence with its id, track (V1 is the lowest), name, start/end in seconds and whether it is selected. Use the ids with mectracker_track and mectracker_paste.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'mectracker_set_options',
    description: 'Changes the panel options (only the ones you pass). action: "follow" makes the target follow the object, "stabilize" moves the clip against the motion. position/rotation/scale: which Transform properties get keyframes. every_frames: keyframe interval (1 = every frame). paste_to_clip_above: when true, Track also pastes onto the clip(s) on the nearest video track above, in one step.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['follow', 'stabilize'] },
        position: { type: 'boolean' }, rotation: { type: 'boolean' }, scale: { type: 'boolean' },
        every_frames: { type: 'integer', minimum: 1, maximum: 240 },
        paste_to_clip_above: { type: 'boolean' },
      },
    },
  },
  {
    name: 'mectracker_track',
    description: 'Reads the motion of the mask on the given clip(s) (the mask must already be tracked with Premiere\'s own mask tracking, or be an Object Mask in the clip\'s Opacity). One clip: tracks it. Several clips: tracks each one. With paste_to_clip_above on, it also pastes the motion onto the clips on the track above each one. The tracks stay stored in the panel for mectracker_paste. Tracking can take a while; the result includes the panel log.',
    inputSchema: { type: 'object', properties: { clips: clipsProp, paste_to_clip_above: { type: 'boolean', description: 'Sets the "Paste Straight to Clip Above" option before tracking.' }, wait_seconds: waitProp } },
  },
  {
    name: 'mectracker_paste',
    description: 'Pastes the stored track(s) as Transform keyframes onto the target clip(s) (text, image, graphic, or the clip itself to stabilize). The reference frame is the moment where the target is already well placed: the playhead, or reference_seconds. With several stored tracks, each target gets the track it overlaps most in time.',
    inputSchema: { type: 'object', properties: { clips: clipsProp, reference_seconds: { type: 'number', description: 'Sequence time (seconds) where the target is already in the right place. Default: the playhead.' }, wait_seconds: waitProp } },
  },
  {
    name: 'mectracker_wait',
    description: 'Waits for the running track/paste job to finish and returns its result.',
    inputSchema: { type: 'object', properties: { wait_seconds: waitProp } },
  },
  {
    name: 'mectracker_cancel',
    description: 'Cancels the running track job.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'mectracker_discard_tracks',
    description: 'Discards the tracks stored in the panel.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'mectracker_install_plugin',
    description: 'Installs (or updates) the Mec Tracker plugin in Premiere Pro on this computer: downloads the latest release from GitHub and runs its installer. Windows shows an administrator prompt; macOS asks for the password in a system window. Premiere must be restarted afterwards. Use it when mectracker_status says the panel is not connected and the user does not have Mec Tracker 3.4.0+ installed.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'mectracker_log',
    description: 'Last lines of the panel log (Help tab > Log). Useful when something failed.',
    inputSchema: { type: 'object', properties: { lines: { type: 'integer', minimum: 1, maximum: 500 } } },
    annotations: { readOnlyHint: true },
  },
];

function clampWait(v) { const n = Number(v); return isFinite(n) && n >= 0 ? Math.min(MAX_WAIT, n) : DEFAULT_WAIT; }

async function finishJob(job, wait) {
  if (!job || job.done) return job;
  const done = await waitJob(job.id, wait);
  if (done) return done;
  const now = await send('job').catch(() => job);
  return Object.assign({}, now, { note: 'Still running. Call mectracker_wait to keep waiting, or mectracker_cancel to stop.' });
}

async function callTool(name, a) {
  a = a || {};
  switch (name) {
    case 'mectracker_status': {
      if (!panel) return { connected: false, message: notConnected().message };
      return Object.assign({ connected: true }, await send('status'));
    }
    case 'mectracker_list_clips': return send('clips');
    case 'mectracker_set_options': return send('options', a);
    case 'mectracker_track': {
      const job = await send('track', { clips: a.clips, paste_to_clip_above: a.paste_to_clip_above });
      return finishJob(job, clampWait(a.wait_seconds));
    }
    case 'mectracker_paste': {
      const job = await send('paste', { clips: a.clips, reference_seconds: a.reference_seconds });
      return finishJob(job, clampWait(a.wait_seconds));
    }
    case 'mectracker_wait': {
      const job = await send('job');
      if (!job) return { message: 'No job has run since the panel connected.' };
      return finishJob(job, clampWait(a.wait_seconds));
    }
    case 'mectracker_cancel': return send('cancel');
    case 'mectracker_discard_tracks': return send('discard');
    case 'mectracker_log': return send('log', { lines: a.lines });
    case 'mectracker_install_plugin': return installPremierePlugin();
    default: throw new Error('Unknown tool: ' + name);
  }
}

// ------------------------------------------------------------------ MCP over stdio (JSON-RPC, one message per line)
const INSTRUCTIONS = [
  'Mec Tracker reads the motion of a mask in Premiere Pro and pastes it as Transform keyframes on other clips (follow) or on the same clip (stabilize).',
  'Typical flow: mectracker_status -> mectracker_list_clips -> mectracker_track (clip with the tracked mask) -> mectracker_paste (target clips).',
  'For text/graphics on the track right above the filmed clip, mectracker_track with paste_to_clip_above=true does it in one step.',
  'The mask itself must be created and tracked in Premiere first (Effect Controls); this server cannot do that.',
  'Prefer these tools over screenshots and clicks.',
].join(' ');

function write(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    let result;
    if (method === 'initialize') {
      result = {
        protocolVersion: (params && params.protocolVersion) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'mectracker', title: 'Mec Tracker', version: VERSION },
        instructions: INSTRUCTIONS,
      };
    } else if (method === 'ping') result = {};
    else if (method === 'tools/list') result = { tools: TOOLS };
    else if (method === 'tools/call') {
      try {
        const out = await callTool(params && params.name, params && params.arguments);
        result = { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] };
      } catch (e) {
        result = { content: [{ type: 'text', text: String(e && e.message || e) }], isError: true };
      }
    } else if (method && method.startsWith('notifications/')) return;
    else { if (isRequest) write({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } }); return; }
    if (isRequest) write({ jsonrpc: '2.0', id, result });
  } catch (e) {
    if (isRequest) write({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e && e.message || e) } });
  }
}

function startStdio() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch (e) { write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
      (Array.isArray(msg) ? msg : [msg]).forEach((m) => handle(m));
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

if (process.argv.includes('--install-premiere-plugin')) {
  installPremierePlugin().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); }, (e) => { console.error('Error: ' + e.message); process.exit(1); });
} else if (process.argv.includes('--version')) {
  console.log(VERSION);
} else {
  startSocketServer();
  startStdio();
}
