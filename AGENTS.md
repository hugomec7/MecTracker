# AGENTS.md

Guide for AI agents (Claude, Codex, Cursor, etc.) working with Mec Tracker: either **using** it in Premiere Pro, or **changing** its code.

## Using Mec Tracker from an agent

Do not drive the panel with screenshots and clicks. Use the MCP server in [`mcp/`](mcp/README.md): it is faster and uses far fewer tokens.

1. The user installs the connector (`dist/MecTracker.mcpb` in Claude Desktop, or `claude mcp add mectracker -- node /path/to/mcp/server.js`) and ticks **Help > Allow Claude to control the panel** in Mec Tracker 3.4.0+.
2. `mectracker_status` first. If it says the panel is not connected, tell the user the exact step it prints.
3. `mectracker_list_clips` to get clip ids (`V<track>-<start ticks>`; V1 is the lowest track).
4. `mectracker_set_options` if needed (follow/stabilize, position/rotation/scale, every_frames, paste_to_clip_above).
5. `mectracker_track` with the clip that has the tracked mask, then `mectracker_paste` with the target clips. For targets on the track right above, `mectracker_track` with `paste_to_clip_above: true` does both.
6. Long tracks return progress; call `mectracker_wait`. On errors read `mectracker_log`.

The mask must already exist and be tracked by Premiere (Effect Controls, or an Object Mask in the clip's Opacity). The agent cannot create or track masks.

## Repository layout

- `com.mectracker/` the UXP plugin (manifest v5, Premiere Pro 26+). No build step. `index.js` is one file with small modules (`__defs[...]`): `png`, `measure`, `solver`, `prproj`, `host` (all Premiere API calls), `app` (UI, texts in `DICT.pt` / `DICT.en`, and the "controle pelo Claude" bridge).
- `mcp/` the MCP server (`server.js`, Node 18+, zero dependencies) and the `.mcpb` manifest. `dist/MecTracker.mcpb` is the packed connector.
- `tools/guide/` renders the panel with a fake Premiere (`panel-mock.html`) and builds the PDF guides. Keep its HTML in sync with `com.mectracker/index.html`.
- `tools/mcp-test/` end-to-end test of the MCP server + panel bridge with a fake Premiere (`node tools/mcp-test/e2e.js`, needs Playwright).
- `docs/` guides (PDF), README images and tutorial videos.

## Rules for changes

- Every user-facing text goes in both `DICT.pt` and `DICT.en`. Code comments are in Portuguese.
- UI changes: the owner (Hugo) approves them from screenshots before release. Render them with the mock in `tools/guide` or `tools/mcp-test`.
- Keep the panel light on Premiere: do not poll the Premiere API on a timer (see 3.3.7 in the CHANGELOG).
- When features change, update `README.md`, `README.pt-BR.md`, `CHANGELOG.md` and the PDF guides (`tools/guide`).
- New MCP tools need both sides: a `case` in `onBridgeMsg` (panel, `index.js`) and an entry in `TOOLS` + `callTool` (`mcp/server.js`), plus the tables in `mcp/README*.md` and `mcp/manifest.json`.

## Releasing a version

Bump the version in all of these, then tag `vX.Y.Z` (the panel's update notice reads GitHub releases):

- `com.mectracker/manifest.json` (`version`)
- `VERSION` in `com.mectracker/index.js`
- `plugin-ver` at the end of the Help tab in `com.mectracker/index.html` (and `tools/guide/panel-mock.html`)
- `versionString` in `Install-Windows.bat` and `Install-Mac.command`
- `mcp/manifest.json`, `mcp/package.json` and `VERSION` in `mcp/server.js`, then repack: `cd mcp && npx -y @anthropic-ai/mcpb pack . ../dist/MecTracker.mcpb`

Release zip `MecTracker_X.Y.Z.zip` holds a `MecTracker-Installer/` folder with `com.mectracker/` (no version in the folder name), both installers, `MecTracker.ccx` (zip of the plugin folder's contents), the PT/EN guide PDFs, `Tutoriais/` and `Claude/` (`MecTracker.mcpb` + `server.js`).
