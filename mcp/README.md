# Mec Tracker MCP

Lets **Claude Desktop** or **Claude Code** drive the Mec Tracker panel in Premiere Pro through short commands, instead of screenshots and clicks. [Leia em português](README.pt-BR.md).

```
Claude  ── MCP (stdio) ──  server.js  ── WebSocket 127.0.0.1:47321 ──  Mec Tracker panel (3.4.0+)
```

UXP panels cannot open a port, so the panel connects to this server as a client. The server has no dependencies (Node 18+).

## Install

**Claude Desktop**: double-click [`../dist/MecTracker.mcpb`](../dist/MecTracker.mcpb) (also in the `Claude` folder of the release zip), or drag it into **Settings > Extensions**.

**Claude Code**:

```bash
claude mcp add mectracker -- node "/path/to/server.js"
```

Then in Premiere: **Mec Tracker > Help > Allow Claude to control the panel**. The panel retries every few seconds, so the order does not matter. A green **Claude** dot shows at the top of the panel while it is connected.

## Tools

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

`track` and `paste` wait up to `wait_seconds` (default 45). Longer jobs return their progress; call `mectracker_wait` to keep waiting. Clip ids let Claude pick clips without touching your timeline selection.

The mask itself is still made and tracked in Premiere (Effect Controls); Mec Tracker reads it from there.

## Settings and security

- Port: `47321`, only on `127.0.0.1`. Change with the `MECTRACKER_PORT` environment variable (the panel uses 47321, so only change it for testing).
- Connections that come from a web page (an `http(s)` Origin) are refused, so websites cannot drive the panel.
- Only one Claude window can hold the port. A second one waits and takes over when the first closes.
- The panel only connects while **Allow Claude to control the panel** is ticked (off by default).

## Build the .mcpb

```bash
cd mcp && npx -y @anthropic-ai/mcpb pack . ../dist/MecTracker.mcpb
```

Keep `version` in `manifest.json`, `package.json` and `VERSION` in `server.js` the same as the plugin.

## Messages between server and panel

JSON text frames. Panel → server: `{"type":"hello","version":"3.4.0","lang":"pt"}`, `{"type":"reply","id":1,"ok":true,"result":{}}`, `{"type":"job","job":{...}}` (when a track/paste ends). Server → panel: `{"type":"cmd","id":1,"cmd":"status|clips|options|track|paste|job|cancel|discard|log","args":{}}`. The panel side is the "controle pelo Claude" block in `com.mectracker/index.js`.
