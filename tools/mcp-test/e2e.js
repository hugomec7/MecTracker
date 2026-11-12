const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..'), S = process.argv[2] || require('os').tmpdir() + '/mt-mcp-test', SERVER = path.join(ROOT, 'mcp', 'server.js');
const fs = require('fs'); fs.mkdirSync(path.join(S, 'render'), { recursive: true });
['index.js', 'index.css', 'logo.png'].forEach(f => fs.copyFileSync(path.join(ROOT, 'com.mectracker', f), path.join(S, 'render', f)));
fs.copyFileSync(path.join(__dirname, 'mock.js'), path.join(S, 'render', 'mock.js'));
fs.writeFileSync(path.join(S, 'render', 'index.html'), fs.readFileSync(path.join(ROOT, 'com.mectracker', 'index.html'), 'utf8').replace('<script src="index.js"></script>', '<script src="mock.js"></script>\n  <script src="index.js"></script>'));
const srv = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
srv.stderr.on('data', d => process.stdout.write('  [srv] ' + d));
let buf = '', waiters = {}, id = 0;
srv.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (waiters[m.id]) waiters[m.id](m); } });
function rpc(method, params) { const i = ++id; srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n'); return new Promise(r => waiters[i] = r); }
async function tool(name, args) { const r = await rpc('tools/call', { name, arguments: args || {} }); const t = r.result.content[0].text; console.log('\n>>', name, JSON.stringify(args || {}), r.result.isError ? 'ERROR' : ''); console.log(t.length > 1500 ? t.slice(0, 1500) + '…' : t); return r.result.isError ? null : JSON.parse(t); }
(async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  console.log('init', init.result.serverInfo, init.result.protocolVersion);
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  console.log('tools', (await rpc('tools/list')).result.tools.map(t => t.name).join(', '));
  await tool('mectracker_status');
  // origem web deve ser bloqueada
  const res = await fetch('http://127.0.0.1:47321/', { headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13', Origin: 'https://evil.example' } }).catch(e => ({ status: 'err ' + e.message }));
  console.log('web origin upgrade ->', res.status);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 340, height: 900 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (/Claude/.test(m.text())) console.log('  [panel]', m.text()); });
  await p.goto('file://' + path.join(S, 'render', 'index.html'));
  await p.evaluate(() => {
    const H = window.__MT_TEST__.host, T = 254016000000;
    H.track = async (pr, seq, item, sc, onP, cancel) => { const n = 40; for (let i = 0; i < n; i++) { if (cancel.cancelled) break; onP({ done: i + 1, total: n, msPerFrame: 40 }); await new Promise(r => setTimeout(r, window.SLOW || 40)); } return { samples: Array.from({ length: n }, () => ({})), frameTicks: T / 4, startTicks: 0, clipName: await item.getName(), sequenceName: 'Seq 01', sequenceGuid: 'g1', complete: !cancel.cancelled, source: 'render', seconds: 1.6 }; };
    H.pasteKeys = async (pr, seq, target, ref, track, o) => ({ keyframes: 41, name: await target.getName(), shutter: true, ref: ref.ticksNumber / T });
  });
  await p.click('#tab-help'); await p.click('#chip-claude');
  await p.screenshot({ path: path.join(S, 'shot-help-wait.png'), fullPage: true });
  for (let i = 0; i < 40; i++) { const s = await tool('mectracker_status').catch(() => null); if (s && s.connected) break; await new Promise(r => setTimeout(r, 500)); }
  await p.screenshot({ path: path.join(S, 'shot-help-on.png'), fullPage: true });
  const clips = await tool('mectracker_list_clips');
  await tool('mectracker_set_options', { action: 'follow', rotation: true, every_frames: 2 });
  await tool('mectracker_track', { clips: [clips.clips[0].id] });
  await tool('mectracker_paste', { clips: [clips.clips[1].id, clips.clips[2].id], reference_seconds: 4 });
  await tool('mectracker_paste', { clips: ['V9-1'] });
  // job longo: volta antes de terminar, depois espera
  await p.evaluate(() => { window.SLOW = 150; });
  const j = tool('mectracker_track', { paste_to_clip_above: true, wait_seconds: 1 });
  await new Promise(r => setTimeout(r, 1500)); await p.screenshot({ path: path.join(S, 'shot-main-running.png'), fullPage: false, clip: { x: 0, y: 0, width: 340, height: 330 } });
  await j;
  await tool('mectracker_status');
  await tool('mectracker_wait', { wait_seconds: 20 });
  await p.screenshot({ path: path.join(S, 'shot-main-done.png'), clip: { x: 0, y: 0, width: 340, height: 420 } });
  await tool('mectracker_discard_tracks');
  await tool('mectracker_log', { lines: 8 });
  // desligar a caixa desconecta
  await p.click('#tab-help'); await p.click('#chip-claude'); await new Promise(r => setTimeout(r, 300));
  await tool('mectracker_status');
  await b.close(); srv.kill(); process.exit(0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
