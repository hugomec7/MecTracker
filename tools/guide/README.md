# Guide builder
Renders the real panel with a mock of the Premiere API and builds the PT/EN user guide PDFs.

1. Make a folder `render/` with `index.css`, `index.js`, `logo.png` from `com.mectracker.v2/` and `panel-mock.html` renamed to `index.html`.
2. `node build.js <render folder> <output folder>` (needs Playwright + Chromium).
