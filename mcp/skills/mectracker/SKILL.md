---
name: mectracker
description: Track a mask and paste its motion as Transform keyframes in Adobe Premiere Pro with the Mec Tracker panel (follow an object with text/graphics, or stabilize a shot). Use when the user asks to track, follow, stick, pin or stabilize something in Premiere, or mentions Mec Tracker.
---

# Mec Tracker

Drive the Mec Tracker panel through the `mectracker_*` MCP tools. Never use screenshots or clicks for this: the tools are faster and cheaper.

## Start

1. Call `mectracker_status`.
2. If the panel is not connected:
   - Mec Tracker missing or older than 3.4.0: ask the user, then call `mectracker_install_plugin` (Windows shows an administrator prompt, macOS asks for the password). Then the user restarts Premiere.
   - Otherwise tell the user: open **Window > UXP Plugins > Mec Tracker**, go to **Help** and tick **Allow Claude to control the panel**. Call `mectracker_status` again.

## Track and paste

1. `mectracker_list_clips` to see the clips (ids like `V2-508032000000`; V1 is the lowest track).
2. The clip with the object must have a mask already tracked in Premiere (Effect Controls > Opacity mask, tracked forward; or Object Mask in Opacity). You cannot create or track masks; ask the user to do it if `mectracker_track` says there is no mask.
3. Options if needed: `mectracker_set_options` (`action` follow/stabilize, `position`/`rotation`/`scale`, `every_frames`).
4. Targets on the track right above the filmed clip: `mectracker_track` with `clips: [filmed]` and `paste_to_clip_above: true`. One step.
5. Other targets: `mectracker_track` with the filmed clip(s), then `mectracker_paste` with `clips: [targets]` and `reference_seconds` = a time where the target is already in the right place (default: playhead).
6. Stabilize: `action: "stabilize"`, track the clip, paste onto the same clip.
7. If a job returns `done: false`, call `mectracker_wait`. On failure read `status`, `log`, or `mectracker_log`, and explain it to the user in plain words.

Report what was tracked and pasted (clip names, keyframe count) in one or two sentences.
