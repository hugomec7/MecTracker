# MCP test

End-to-end test of the Claude control: starts `mcp/server.js`, opens the real panel in Chromium with a fake Premiere (`mock.js`, tracking and pasting are faked), ticks **Allow Claude to control the panel** and calls every MCP tool.

```bash
node tools/mcp-test/e2e.js            # needs Playwright + Chromium
```

Screenshots go to the temp folder (`mt-mcp-test`). It does not touch Premiere, so it checks the protocol and the panel UI, not the real tracking.
