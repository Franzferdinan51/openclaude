# Computer Use Bundle

This directory contains the OpenAI Codex `computer-use` MCP server plugin.

## Auto-installed by install.js

During `node install.js`, the installer copies the computer-use plugin from:
1. `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/` (Codex app bundle)
2. `~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use/` (Codex extracted)

On non-macOS platforms, this directory remains empty — computer-use is macOS-only.

## Contents

```
computer-use/
├── .mcp.json                    ← MCP server stdio config
├── .codex-plugin/plugin.json  ← Plugin manifest
├── Codex Computer Use.app/     ← Native macOS app (SkyComputerUseService + SkyComputerUseClient)
│   └── Contents/
│       ├── MacOS/SkyComputerUseService    ← LaunchAgent (TCC, accessibility)
│       └── SharedSupport/SkyComputerUseClient.app/
│           └── Contents/MacOS/SkyComputerUseClient  ← stdio MCP server
└── assets/
```

## MCP Tools Exposed

32 tools via `mcp__computer-use__*`:
- Screen: screenshot, zoom
- Mouse: click, left_click, right_click, double_click, triple_click, mouse_move, drag, left_click_drag, scroll, left_mouse_down, left_mouse_up
- Keyboard: type_text, press_key, hold_key, set_value
- Clipboard: write_clipboard, read_clipboard
- Apps: open_application, list_apps, get_app_state
- Permissions: request_access, list_granted_applications
- Utilities: cursor_position, wait, computer_batch

## Manual Setup (if install.js skipped it)

```bash
# macOS: copy from Codex app
cp -r "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use" \
  "$(dirname "$(dirname "$(which node)")/../lib/node_modules/duckhive/packages/computer-use-bundle/computer-use"

# Or from extracted Codex cache
cp -r ~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use \
  ~/.duckhive/packages/computer-use-bundle/
```
