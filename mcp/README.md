# Mec Tracker MCP

Lets **Claude Desktop** or **Claude Code** drive the Mec Tracker panel in Premiere Pro through short commands, instead of screenshots and clicks. [Leia em português](README.pt-BR.md).

```
Claude  ── MCP (stdio) ──  server.js  ── WebSocket 127.0.0.1:47321 ──  Mec Tracker panel (3.4.0+)
```

UXP panels cannot open a port, so the panel connects to this server as a client. The server has no dependencies (Node 18+).

## Install

**Easiest**: in Claude Code (or the Code tab of Claude Desktop) paste `Install Mec Tracker for me: https://github.com/hugomec7/MecTracker`. Claude follows the steps in the main README and installs this connector plus the Premiere plugin.

**Claude Code plugin** (this folder is a Claude Code plugin; the repo root is its marketplace):

```text
/plugin install mectracker --marketplace hugomec7/MecTracker
```

**Premiere plugin from the command line** (downloads the latest release and runs its installer):

```bash
npx -y https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz --install-premiere-plugin
```

The same thing is available to Claude as the `mectracker_install_plugin` tool.

### Other ways

**Copy and paste into Claude** (Claude Code, or the Code tab of Claude Desktop). It installs itself. Needs [Node.js](https://nodejs.org) 18+:

```text
Install the Mec Tracker MCP connector (Premiere Pro plugin) on this computer:
1. Check that Node.js 18 or newer is installed (node -v). If it is not, ask me to install it from nodejs.org and stop.
2. Claude Code: run  claude mcp add mectracker -s user -- npx -y https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz
   (on Windows use "cmd /c npx" instead of "npx").
3. Claude Desktop: in claude_desktop_config.json (Mac: ~/Library/Application Support/Claude/, Windows: %APPDATA%\Claude\), create it if missing and add to "mcpServers" an entry "mectracker" with "command": "npx" and "args": ["-y", "https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz"] (on Windows: "command": "cmd", "args": ["/c", "npx", "-y", "https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz"]). Keep everything already in the file.
4. When done, tell me to restart Claude and, in Premiere, tick Mec Tracker > Help > Allow Claude to control the panel.
Instructions: https://github.com/hugomec7/MecTracker/tree/main/mcp
```

**Claude Desktop, no Node needed**: double-click [`../dist/MecTracker.mcpb`](../dist/MecTracker.mcpb) (also in the `Claude` folder of the release zip), or drag it into **Settings > Extensions**.

**Claude Code**:

```bash
claude mcp add mectracker -s user -- npx -y https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz
```

**Claude Desktop by hand** (Settings > Developer > Edit Config):

```json
{
  "mcpServers": {
    "mectracker": { "command": "npx", "args": ["-y", "https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz"] }
  }
}
```

On Windows use `"command": "cmd", "args": ["/c", "npx", "-y", "..."]`.

Then in Premiere: **Mec Tracker > Help > Allow Claude to control the panel**. The panel retries every few seconds, so the order does not matter. A green **Claude** dot shows at the top of the panel while it is connected.



| Tool | What it does |
|---|---|
| `mectracker_status` | Connection, sequence, playhead, selected clips, options, stored tracks, current job. |
| `mectracker_list_clips` | Every video clip of the active sequence: `id` (e.g. `V2-508032000000`), track, name, start/end (s), selected. |
| `mectracker_set_options` | `action` (`follow`/`stabilize`), `position`, `rotation`, `scale`, `every_frames`, `paste_to_clip_above`. |
| `mectracker_track` | Tracks the given `clips` (or the timeline selection). With `paste_to_clip_above` it also pastes onto the clips on the track above. |
| `mectracker_paste` | Pastes the stored track(s) onto `clips` (or the selection). `reference_seconds` = where the target is already well placed (default: playhead). |
| `mectracker_wait` | Waits for the running job (track/paste) and returns its result. |
| `mectracker_cancel` | Cancels the running track. |
| `mectracker_discard_tracks` | Clears the stored tracks. |
| `mectracker_log` | Last lines of the panel log. |
| `mectracker_install_plugin` | Installs or updates the Premiere plugin (latest release from GitHub). |

`track` and `paste` wait up to `wait_seconds` (default 45). Longer jobs return their progress; call `mectracker_wait` to keep waiting. Clip ids let Claude pick clips without touching your timeline selection.

The mask itself is still made and tracked in Premiere (Effect Controls); Mec Tracker reads it from there.

## Settings and security

- Port: `47321`, only on `127.0.0.1`. Change with the `MECTRACKER_PORT` environment variable (the panel uses 47321, so only change it for testing).
- Connections that come from a web page (an `http(s)` Origin) are refused, so websites cannot drive the panel.
- Only one Claude window can hold the port. A second one waits and takes over when the first closes.
- The panel only connects while **Allow Claude to control the panel** is ticked (off by default).

## Build the .mcpb and the npx package

```bash
cd mcp && npm run pack   # builds dist/MecTracker.mcpb and dist/mectracker-mcp.tgz
```

Keep `version` in `manifest.json`, `package.json` and `VERSION` in `server.js` the same as the plugin.

## Messages between server and panel

JSON text frames. Panel → server: `{"type":"hello","version":"3.4.0","lang":"pt"}`, `{"type":"reply","id":1,"ok":true,"result":{}}`, `{"type":"job","job":{...}}` (when a track/paste ends). Server → panel: `{"type":"cmd","id":1,"cmd":"status|clips|options|track|paste|job|cancel|discard|log","args":{}}`. The panel side is the "controle pelo Claude" block in `com.mectracker/index.js`.
