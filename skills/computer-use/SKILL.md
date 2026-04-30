# computer-use — DuckHive Built-in MCP Server

## Overview

DuckHive ships with the **OpenAI Codex computer-use MCP server** fully built-in. No setup needed on macOS — it's installed automatically by `node install.js` from the Codex app bundle.

## What It Is

32 macOS desktop automation tools via the Codex `SkyComputerUseClient` native binary:
- 📸 `screenshot` — capture screen
- 🖱️ `click`, `left_click`, `right_click`, `double_click`, `mouse_move`, `drag`
- ✌️ `left_click_drag`, `scroll`
- ⌨️ `type_text`, `press_key`, `hold_key`
- 🔍 `zoom`
- 📱 `open_application`, `list_apps`, `get_app_state`
- 📋 `write_clipboard`, `read_clipboard`
- 🔐 `request_access`, `list_granted_applications`
- ⏱️ `wait`, `cursor_position`, `computer_batch`

## Automatic Installation

`node install.js` copies the plugin from:
1. `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/` (Codex app)
2. `~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use/` (Codex cache)

Copied to: `packages/computer-use-bundle/computer-use/`

## Auto-Wired

The plugin is automatically added to DuckHive's MCP config on first use of `/computer-use status`. No manual `/computer-use enable` required — just run any computer-use command.

## Manual Commands

```
/computer-use status   — Check plugin + MCP config status
/computer-use enable  — Force-add to DuckHive MCP config
/computer-use disable — Remove from DuckHive MCP config
```

After enable/disable, restart DuckHive or run `/mcp reload`.

## Requirements

- **macOS only** (SkyComputerUseClient is a native macOS binary)
- **Codex CLI installed** (provides the plugin source: `@openai/codex`)
- **Accessibility permissions** granted (System Preferences → Privacy → Accessibility)

## How It Works

```
DuckHive MCP Client
  │
  │ StdioClientTransport
  │   command: packages/computer-use-bundle/computer-use/.../SkyComputerUseClient
  │   args: ["mcp"]
  │
  ▼
packages/computer-use-bundle/computer-use/Codex Computer Use.app/
  SkyComputerUseService    ← LaunchAgent (TCC/Accessibility manager)
  SkyComputerUseClient     ← stdio MCP server (spawned as subprocess)
```

## Architecture

| Layer | Implementation |
|-------|----------------|
| MCP server | Codex `SkyComputerUseClient` (native macOS binary) |
| MCP transport | stdio (subprocess spawned by DuckHive MCP client) |
| Tool rendering | `getCodexComputerUseToolOverrides()` in impl.ts |
| Auto-discovery | `findComputerUsePluginDir()` — 5 known paths |
| Auto-wiring | `autoWireComputerUse()` on every command invocation |

## Key Files

| File | Purpose |
|------|---------|
| `src/commands/computer-use/impl.ts` | Command + auto-discovery + MCP wiring |
| `packages/computer-use-bundle/` | Plugin copy destination |
| `install.js` → `setupComputerUseBundle()` | Copies plugin from Codex app |
| `SKILL.md` | This file |

## Tool Names (mcp__computer-use__*)

`screenshot`, `cursor_position`, `click`, `left_click`, `right_click`, `double_click`, `triple_click`, `type_text`, `press_key`, `hold_key`, `scroll`, `drag`, `left_click_drag`, `mouse_move`, `open_application`, `list_apps`, `get_app_state`, `request_access`, `write_clipboard`, `read_clipboard`, `left_mouse_down`, `left_mouse_up`, `zoom`, `wait`, `computer_batch`
