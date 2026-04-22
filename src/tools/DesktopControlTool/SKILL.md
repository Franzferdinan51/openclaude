# SKILL.md — DuckHive Desktop Control

## Tool Name
`desktop_control`

## What It Does
Provides full macOS desktop automation — mouse control, keyboard input, screenshots, OCR text extraction, window management, app launching, AppleScript execution, and AI-powered vision analysis.

## Powered By
`desktop-control-lobster-edition-skill` — [GitHub](https://github.com/Franzferdinan51/desktop-control-lobster-edition-skill)

## Dependencies
```bash
pip3 install --break-system-packages -r requirements.txt
# Requirements: pyautogui, pillow, opencv-python, pygetwindow, pyperclip, rubicon-objc
```

## Usage

### Via Tool Call (in AI conversation)
```
desktop_control screenshot
desktop_control type_text text="Hello World"
desktop_control click x=500 y=300
desktop_control ocr_text_from_region region=[0,0,800,600]
```

### Via `/desktop` Command
```
/desktop    — Show full action reference
```

## Action Reference

### Screen (SAFE — no approval needed)
| Action | Description |
|--------|-------------|
| `screenshot` | Capture screen, returns image path |
| `get_screen_size` | Get display dimensions |
| `get_pixel_color` | Get RGB color at x,y |
| `get_monitor_info` | List all monitors |

### Mouse ⚠️ APPROVAL REQUIRED
| Action | Params |
|--------|--------|
| `move_mouse` | x, y, duration?, smooth? |
| `click` | x?, y?, button? |
| `double_click` | x?, y? |
| `right_click` | x?, y? |
| `drag` | start_x, start_y, end_x, end_y, duration? |
| `scroll` | clicks, direction? |
| `get_mouse_position` | — |

### Keyboard ⚠️ APPROVAL REQUIRED
| Action | Params |
|--------|--------|
| `type_text` | text, paste?, interval? |
| `press` | key (enter, escape, etc.) |
| `hotkey` | keys (["cmd","s"]) |

### OCR / Vision (SAFE)
| Action | Description |
|--------|-------------|
| `ocr_text_from_region` | Extract text from screen region |
| `find_text_on_screen` | Find text on screen |
| `find_on_screen_retry` | Image match with retries |
| `wait_for_image` | Wait for image to appear |

### Windows
| Action | Description |
|--------|-------------|
| `get_all_windows` | List all open windows |
| `get_active_window` | Get focused window title |
| `window_exists` | Check if window is open |
| `activate_window` | Focus window by title |

### Apps / Scripts ⚠️ APPROVAL REQUIRED
| Action | Params |
|--------|--------|
| `open_app` | app_name |
| `run_applescript` | script |
| `browser_navigate` | url |

### Workflow / Evidence
| Action | Description |
|--------|-------------|
| `capture_evidence` | Screenshot + annotation |
| `annotate_screenshot` | Add boxes/text to image |
| `compare_screenshots` | Diff two screenshots |
| `get_action_log` | Show action history |
| `checkpoint` | Save workflow checkpoint |
| `workflow_report` | Generate summary |
| `openclaw_summary` | OpenClaw-format summary |
| `export_openclaw_bundle` | Export as OpenClaw bundle |

### AI Vision Assist
| Action | Description |
|--------|-------------|
| `vision_assist` | AI screen analysis with council fallback |
| `set_resource_broker` | Configure vision backend |

## Safety Policies
- **SAFE** (no approval): screenshot, OCR, window listing, get_* actions
- **APPROVAL REQUIRED**: mouse, keyboard, app launching, scripting

Configure approval policy:
```json
desktop_control set_policy approval_actions=["move_mouse","type_text","open_app","run_applescript"]
```

## Architecture
- Python daemon (`desktop-control-daemon.py`) runs as subprocess
- Communicates via JSON-RPC 2.0 over stdin/stdout
- Long-lived daemon (killed after 5 min idle)
- DesktopController from desktop-control-lobster-edition-skill handles actual automation
