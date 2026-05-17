# computer-use - DuckHive Computer-Use Status Surface

## Overview

DuckHive can inspect and wire the supported OpenAI Codex computer-use MCP server when the native macOS bundle is available. On non-macOS platforms, or when the proprietary Codex bundle is missing, use DuckHive's bundled `newest-desktop-control` MCP gateway for desktop, Android, and `computer_use_*` compatibility aliases.

DuckHive does not patch, decompile, re-sign, or bypass proprietary Codex binaries.

## What It Is

Codex Computer Use exposes macOS desktop automation tools through the native `SkyComputerUseClient` binary:

- `screenshot` - capture screen
- `click`, `left_click`, `right_click`, `double_click`, `mouse_move`, `drag`
- `left_click_drag`, `scroll`
- `type_text`, `press_key`, `hold_key`
- `zoom`
- `open_application`, `list_apps`, `get_app_state`
- `write_clipboard`, `read_clipboard`
- `request_access`, `list_granted_applications`
- `wait`, `cursor_position`, `computer_batch`

## Plugin Discovery

DuckHive checks supported Codex integration points:

1. `packages/computer-use-bundle/computer-use/`
2. `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/`
3. `~/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/`
4. `~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use/`
5. `~/.codex/plugins/computer-use/`

## Wiring Behavior

`/computer-use status` inspects plugin/config state without mutating MCP configuration. Use `/computer-use enable` only when the Codex plugin is present and this DuckHive build does not reserve the built-in `computer-use` runtime slot.

```text
/computer-use status  - Check plugin and MCP config status
/computer-use enable  - Add supported Codex plugin to DuckHive MCP config
/computer-use disable - Remove Codex plugin from DuckHive MCP config
```

After enable/disable, restart DuckHive or run `/mcp reload`.

## Bundled Fallback Gateway

If `/computer-use status` reports that the Codex plugin is missing, use the bundled `newest-desktop-control` gateway instead:

```text
mcp__newest-desktop-control__desktop_screenshot
mcp__newest-desktop-control__desktop_mouse_click
mcp__newest-desktop-control__desktop_keyboard_type
mcp__newest-desktop-control__android_screenshot
mcp__newest-desktop-control__computer_use_screenshot
```

The gateway also exposes `desktop_*`, `android_*`, and compatibility aliases such as `screenshot`, `mouse_click`, `keyboard`, `terminal`, `file_read`, `run_script`, `computer_use_mouse_click`, and `computer_use_keyboard`.

## Requirements

- macOS only for the native Codex `SkyComputerUseClient`
- Codex.app or a local computer-use bundle for `/computer-use enable`
- Accessibility and Screen Recording permissions for native desktop automation
- `newest-desktop-control` for cross-platform desktop/Android fallback behavior

## MCP Config

After enable:

```json
{
  "mcpServers": {
    "computer-use": {
      "type": "stdio",
      "command": "/path/to/SkyComputerUseClient",
      "args": ["mcp"],
      "env": {}
    }
  }
}
```

## Key Files

| File | Purpose |
|------|---------|
| `src/commands/computer-use/impl.ts` | Command, discovery, status, and MCP wiring |
| `skills/newest-desktop-control/` | Bundled desktop/Android fallback gateway |
| `packages/computer-use-bundle/` | Optional local Codex plugin copy destination |
| `install.js` -> `setupComputerUseBundle()` | Copies plugin from supported Codex locations when available |
