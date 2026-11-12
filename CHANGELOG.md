# Changelog

## 3.4.0
- Claude control (MCP): Claude Desktop or Claude Code can now run Mec Tracker through commands (status, list clips, options, track, paste, wait, cancel, discard, log) instead of screenshots and clicks. Install the connector from the `Claude` folder of the download (`MecTracker.mcpb`), then tick **Allow Claude to control the panel** in the Help tab. A green **Claude** dot shows at the top while it is connected. See [mcp/README.md](mcp/README.md).
- Install with Claude: paste `Install Mec Tracker for me: https://github.com/hugomec7/MecTracker` into Claude Code and it installs the Claude plugin (marketplace in this repo) and the Premiere plugin (`--install-premiere-plugin`, or the `mectracker_install_plugin` tool).
- Everything stays on your computer: the panel connects only to `127.0.0.1:47321`, and only while the box is ticked (off by default).

## 3.3.9
- Unassigned Masks: when the same clip sits at the same place in more than one sequence (a copy of the sequence, an older version, a Nest), the panel could read the mask of another sequence and the track came out wrong. It now only uses the mask of the clip in the active sequence.

## 3.3.8
- Track: the video tracks hidden while tracking now always show again at the end. Before, the panel only restored the tracks that Premiere already reported as hidden, and some stayed hidden.
- If Premiere or the panel closes in the middle of a track, the panel shows those tracks again the next time it opens (or before the next action).

## 3.3.7
- Stability: the panel no longer asks Premiere for the timeline selection every 600 ms. It only checks when the mouse enters the panel and right before each click. This constant polling could slow down and crash Premiere.
- Track: the first frame is exported alone. Only when the mask cuts the clip does it switch to 4 frames in parallel. Masks in Unassigned Masks no longer start several exports at once before reading the project.
- Track: waiting for each exported frame checks the disk less often.

## 3.3.6
- Video tutorials: 9 short videos (open the panel, masks, Track and Paste, Paste Straight, several clips, Stabilize). They are in the README and in the Tutoriais folder of the download.
- Help tab: new Video tutorials section with a link to the videos.

## 3.3.5
- Update notice checks GitHub every 30 minutes (it was every 6 hours).
- Check for updates: a new link at the end of the Help tab checks GitHub right away and tells you if you have the latest version, if there is a new one (the notice shows at the top), or if it could not check.

## 3.3.4
- Object Mask: when the mask is in Unassigned Masks but Premiere did not save its motion (Object Mask, or a mask not tracked yet), the panel now says so and tells you to drag the mask into the clip's Opacity.
- Plugin ID changed from com.mectracker.v2 to com.mectracker. The installers remove the old version automatically. Your language and options go back to the defaults once.

## 3.3.3
- Open source release: the license key check was removed.
- Update notice: the panel tells you when a new release is out on GitHub, with the release notes and a Download link.
- "Track copied" strip shows when a track is stored; Discard clears it.
- Hide options: fold Position/Rotation/Scale and the keyframe interval into a one-line summary.

## 3.3.2
- Buttons show how many clips are selected (Track 3 Clips, Paste to 3 Clips).

## 3.3.1
- With Paste Straight to Clip Above on, only Track & Paste is shown.

## 3.3.0
- Simpler panel: at most two buttons, and the blue one is always the next step.
- Track several masks at once and paste them onto targets you pick (each target gets the track it overlaps most in time).
- "Auto-Paste to Clip Above" renamed to "Paste Straight to Clip Above".
