# newest-desktop-control — MCP Gateway for Desktop Automation

**Based on:** [desktop-control-lobster-edition-skill](https://github.com/Franzferdinan51/desktop-control-lobster-edition-skill) by Franzferdinan51
**Type:** MCP-based skill (stdio JSON-RPC)
**Platforms:** macOS, Linux, Windows

---

## What It Is

`newest-desktop-control` is a Node.js MCP gateway that consolidates desktop automation for macOS, Linux, and Windows — plus Android ADB control and Codex Computer Use detection — into one MCP server.

It replaces older Python-based desktop control approaches with a unified Node.js stdio JSON-RPC interface that speaks native MCP protocol.

---

## Capabilities

### Desktop Automation (macOS/Linux/Windows)
- **Screenshots** — full screen, region, with PyAutoGUI fallback
- **Mouse** — move, click, double-click, right-click, drag, scroll
- **Keyboard** — type text, press keys, hotkey combos
- **Clipboard** — read and write
- **Screen** — size, pixel color, cursor position
- **Apps** — launch, list running
- **Windows** — activate by title
- **Terminal** — execute commands
- **Files** — read/write files

### Android ADB Control
- Screenshots, taps, swipes, text input
- Key events (home, back, volume)
- App launch, UI dump (uiautomator2)
- Logcat streaming
- Screen size, focused activity

### Codex Computer Use Detection
- Detects Codex.app installation on macOS
- Generates MCP config for `SkyComputerUseClient mcp` entry point
- Falls back to native desktop controls if Codex is unavailable

### Compatibility Aliases
Tools are aliased to older names for backwards compatibility:
- `screenshot` → `desktop_screenshot`
- `mouse_click` → `desktop_mouse_click`
- `keyboard` → `desktop_keyboard`
- `computer_use_*` → desktop fallbacks

---

## Requirements

- **Node.js 18+**
- **Python 3** with `pyautogui` and `Pillow`:
  ```bash
  pip3 install pyautogui pillow
  ```
- **ADB** (for Android control):
  ```bash
  # macOS
  brew install android-platform-tools
  # Linux
  sudo apt install adb
  ```
- **macOS Accessibility permissions** (System Preferences → Privacy → Accessibility) for mouse/keyboard automation

---

## Usage

```
/newest-desktop-control status   — Check dependencies and backend availability
/newest-desktop-control tools   — List all available tools
/newest-desktop-control android — Check ADB connection
```

### In-Chat Tool Usage

Once loaded, the following tools are available via MCP:

```
mcp__newest-desktop-control__desktop_screenshot
mcp__newest-desktop-control__desktop_mouse_move
mcp__newest-desktop-control__desktop_mouse_click
mcp__newest-desktop-control__desktop_mouse_scroll
mcp__newest-desktop-control__desktop_keyboard_type
mcp__newest-desktop-control__desktop_keyboard_press
mcp__newest-desktop-control__desktop_keyboard_hotkey
mcp__newest-desktop-control__desktop_clipboard_read
mcp__newest-desktop-control__desktop_clipboard_write
mcp__newest-desktop-control__desktop_get_screen_size
mcp__newest-desktop-control__desktop_get_pixel_color
mcp__newest-desktop-control__desktop_launch_app
mcp__newest-desktop-control__desktop_activate_window
mcp__newest-desktop-control__android_screenshot
mcp__newest-desktop-control__android_tap
mcp__newest-desktop-control__android_text
mcp__newest-desktop-control__android_key
mcp__newest-desktop-control__android_ui_dump
mcp__newest-desktop-control__android_logcat
mcp__newest-desktop-control__backend_status
mcp__newest-desktop-control__permissions_check
mcp__newest-desktop-control__codex_mcp_config
```

---

## Architecture

```
DuckHive MCP Client
  │
  │ StdioClientTransport
  │   command: node
  │   args: [skills/newest-desktop-control/src/server.js]
  │
  ▼
newest-desktop-control MCP Server (Node.js)
  │
  ├── DesktopBackend (PyAutoGUI) — mouse, keyboard, screenshots
  ├── AndroidBackend (ADB) — Android device control
  └── CodexBackend — Codex.app detection + MCP config gen
```

---

## MCP Configuration

The skill is auto-wired to DuckHive's MCP bridge via `config/mcporter.json`:

```json
{
  "mcpServers": {
    "newest-desktop-control": {
      "command": "node",
      "args": ["${SKILL_DIR}/newest-desktop-control/src/server.js"],
      "scope": "agent"
    }
  }
}
```

---

## Comparison: computer-use vs newest-desktop-control

| Feature | computer-use (Codex) | newest-desktop-control |
|---------|----------------------|-----------------------|
| Mouse/keyboard | ✅ Native macOS | ✅ PyAutoGUI cross-platform |
| Screenshot | ✅ Native macOS | ✅ Cross-platform |
| Android ADB | — | ✅ Full control |
| Codex Computer Use | ✅ Built-in | ✅ Detection + fallback |
| Windows support | — | ✅ |
| Linux support | — | ✅ |
| No Codex.app needed | — | ✅ |

Use **computer-use** for pure macOS Codex-powered automation. Use **newest-desktop-control** for cross-platform (including Android) without Codex.

---

**Version:** 1.0.0
**Added:** 2026-05-06
**Credit:** [Franzferdinan51/desktop-control-lobster-edition-skill](https://github.com/Franzferdinan51/desktop-control-lobster-edition-skill)
