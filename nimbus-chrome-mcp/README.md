# Nimbus Chrome MCP

Give Nimbus Chat + Builder full access to your local Chrome — navigate,
click, type, screenshot, extract page structure, run arbitrary JS — the same
way Claude does inside its own hosted browser.

## How it works

```
┌─────────────────────┐         stdio          ┌──────────────────┐
│  Nimbus Chat / Builder │ ──── MCP protocol ────→ │  chrome-mcp-bridge  │
│  (LibreChat / bolt.diy)│                        │  (this repo)         │
└─────────────────────┘                        └────────┬─────────┘
                                                        │ WebSocket
                                                        │ ws://127.0.0.1:35123
                                                        ▼
                                              ┌─────────────────────┐
                                              │  Nimbus Chrome ext  │
                                              │  (drives your tabs) │
                                              └─────────────────────┘
```

- **`extension/`** — Manifest V3 Chrome extension. Talks to the bridge over
  a localhost WebSocket and executes tab/scripting/screenshot calls.
- **`bridge/`** — Small Node package that speaks MCP stdio on one side and
  the extension's WebSocket protocol on the other. LibreChat / bolt.diy
  spawn this via their `mcpServers` config.

## Trust model

- WebSocket server binds only to `127.0.0.1`. Non-loopback connections are
  refused at the socket level.
- Only one extension may be connected at a time.
- The extension surfaces its capabilities in its popup so users understand
  they're installing a browser-driving tool.

## Install (users)

1. Download the extension ZIP from https://nimbusapi.net/extensions
2. Extract, open `chrome://extensions`, enable Developer mode, click
   "Load unpacked", pick the extracted folder.
3. Open Nimbus Chat or Builder. New tools appear in the tool menu:
   `nimbus_chrome_navigate`, `nimbus_chrome_read_page`, etc.

## Wire into your own LibreChat / bolt.diy fork

`librechat.yaml`:

```yaml
mcpServers:
  chrome:
    command: node
    args:
      - /app/nimbus-chrome-mcp/bridge/index.js
    timeout: 30000
    initTimeout: 15000
    chatMenu: true
    description: Full Chrome browser control via the Nimbus extension.
```

`bolt.diy`'s MCP store: point at the same bridge script or use
`npx @nimbus/chrome-mcp-bridge` once published.

## License

MIT.
