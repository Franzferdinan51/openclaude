// @ts-nocheck
/**
 * /desktop command — shows desktop control help and available actions.
 * The actual desktop automation is done via the `desktop_control` tool.
 */
import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async (_args: string): Promise<{ type: string; value: string }> => {
  return {
    type: 'text',
    value: `🦆 DuckHive Desktop Control

The desktop_control tool provides full macOS automation:

Screenshots & Display
  desktop_control screenshot          — Capture screen
  desktop_control get_screen_size    — Get screen dimensions
  desktop_control get_pixel_color    — Get color at x,y
  desktop_control get_monitor_info   — List monitors

Mouse Control  ⚠️ APPROVAL REQUIRED
  desktop_control move_mouse         — Move cursor to x,y
  desktop_control click             — Click at x,y
  desktop_control double_click      — Double-click
  desktop_control right_click       — Right-click
  desktop_control drag              — Drag from A to B
  desktop_control scroll             — Scroll up/down/left/right

Keyboard  ⚠️ APPROVAL REQUIRED
  desktop_control type_text         — Type text at cursor
  desktop_control press            — Press a key (enter, escape, etc.)
  desktop_control hotkey            — Press hotkey combo (cmd+s, etc.)

Windows
  desktop_control get_all_windows   — List all windows
  desktop_control get_active_window — Get focused window
  desktop_control window_exists     — Check if window is open
  desktop_control activate_window   — Focus a window by title

OCR & Vision  ✅ SAFE (no approval)
  desktop_control ocr_text_from_region   — Extract text from screen region
  desktop_control find_text_on_screen     — Find text on screen
  desktop_control find_on_screen_retry    — Find image with retries
  desktop_control wait_for_image         — Wait for image to appear

Apps & Scripts  ⚠️ APPROVAL REQUIRED
  desktop_control open_app           — Launch an application
  desktop_control run_applescript   — Execute AppleScript code
  desktop_control browser_navigate  — Open URL in browser

Clipboard
  desktop_control copy_to_clipboard — Copy text to clipboard
  desktop_control get_from_clipboard — Read clipboard contents

Workflow & Evidence
  desktop_control capture_evidence  — Screenshot with annotation
  desktop_control annotate_screenshot — Add boxes/text to screenshot
  desktop_control compare_screenshots — Diff two screenshots
  desktop_control get_action_log    — Show action history
  desktop_control checkpoint        — Save workflow checkpoint
  desktop_control workflow_report  — Generate workflow summary

AI Vision Assist
  desktop_control vision_assist     — AI-powered screen analysis
  desktop_control set_resource_broker — Configure vision backend

Safety Policies
  desktop_control set_policy        — Set approval requirements
  desktop_control is_safe           — Check if system is safe mode

Policy Configuration:
  Use set_policy to configure which actions require approval:
    desktop_control set_policy approval_actions=["move_mouse","type_text","open_app"]

Powered by desktop-control-lobster-edition-skill.
`,
  }
}
