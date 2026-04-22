#!/usr/bin/env python3
"""
DuckHive DesktopControl Daemon
Spawned by DesktopControlTool.ts, communicates via JSON lines on stdin/stdout.

Usage: python3 desktop-control-daemon.py <method> <json-args>

Commands received (one JSON object per line):
  {"jsonrpc": "2.0", "id": 1, "method": "method_name", "params": {...}}

Responses sent (one JSON object per line):
  {"jsonrpc": "2.0", "id": 1, "result": {...}}
  {"jsonrpc": "2.0", "id": 1, "error": "message"}
"""

import sys
import json
import traceback
from pathlib import Path

# Add skill to path
SKILL_PATH = Path(__file__).parent.parent.parent.parent.parent / "desktop-control-lobster-edition-skill" / "skill"
sys.path.insert(0, str(SKILL_PATH))

from __init__ import get_controller, DesktopController

# ─── Safe method whitelist ───────────────────────────────────────────────────────

# Methods that are safe to expose without user confirmation
SAFE_METHODS = {
    # Screen
    "screenshot",
    "get_screen_size",
    "get_pixel_color",
    "get_monitor_info",
    # Windows
    "get_all_windows",
    "get_active_window",
    "window_exists",
    # Clipboard
    "get_from_clipboard",
    # Info
    "get_mouse_position",
    "is_safe",
    "get_action_log",
    # OCR / Vision
    "ocr_text_from_region",
    "find_text_on_screen",
    "verify_text_present",
    # Workflow
    "validate_task",
    "preview_task",
    "workflow_report",
    "openclaw_summary",
}

# Methods requiring user approval (marked in response)
APPROVAL_METHODS = {
    "move_mouse": "move mouse cursor",
    "click": "click at coordinates",
    "double_click": "double-click at coordinates",
    "right_click": "right-click at coordinates",
    "drag": "drag mouse",
    "scroll": "scroll",
    "type_text": "type text",
    "press": "press key",
    "hotkey": "press hotkey",
    "key_down": "hold key down",
    "key_up": "release key",
    "open_app": "open application",
    "run_applescript": "run AppleScript",
    "run_command": "run shell command",
    "activate_window": "activate window",
    "copy_to_clipboard": "copy to clipboard",
    "safe_type": "safe type text",
    "safe_hotkey": "safe hotkey",
    "safe_click_type": "safe click and type",
    "safe_drag": "safe drag",
    "browser_navigate": "navigate browser",
    "alert": "show alert dialog",
    "confirm": "show confirm dialog",
    "prompt": "show input dialog",
}

ALL_METHODS = SAFE_METHODS | APPROVAL_METHODS

# ─── Method router ─────────────────────────────────────────────────────────────

def call_method(dc: DesktopController, method: str, params: dict) -> dict:
    """Call a DesktopController method by name with params dict."""
    if method not in ALL_METHODS:
        raise ValueError(f"Unknown method: {method}")

    fn = getattr(dc, method, None)
    if fn is None:
        raise ValueError(f"DesktopController has no method: {method}")

    # Special case: screenshot returns PIL Image
    if method == "screenshot":
        result = dc.screenshot(**params)
        if result is not None:
            return {"image": result, "saved": True}
        return {"image": None, "saved": False}

    # Special case: find_on_screen / find_on_screen_retry → return position or null
    if method in ("find_on_screen", "find_on_screen_retry", "find_text_on_screen"):
        result = dc.find_on_screen_retry(**params) if method == "find_on_screen_retry" else \
                 dc.find_on_screen(**params) if method == "find_on_screen" else \
                 dc.find_text_on_screen(**params)
        return result

    # Special case: ocr_text_from_region
    if method == "ocr_text_from_region":
        result = dc.ocr_text_from_region(**params)
        return {"text": result or ""}

    # Safe methods → execute directly
    if method in SAFE_METHODS:
        result = fn(**params) if params else fn()
        # Convert common return types
        if isinstance(result, tuple):
            return {"result": list(result)}
        if result is None:
            return {"result": True}
        return {"result": result}

    # Approval methods → return approval_required
    if method in APPROVAL_METHODS:
        return {
            "_approval_required": True,
            "_action_description": APPROVAL_METHODS[method],
            "_params": params,
            "_note": "Configure policy with desktop_control set_policy or approve via UI",
        }

    raise ValueError(f"Method {method} not handled")


# ─── JSON-RPC line protocol ─────────────────────────────────────────────────────

def handle_request(dc: DesktopController, req: dict) -> dict:
    """Handle a single JSON-RPC 2.0 request."""
    try:
        method = req.get("method")
        params = req.get("params", {})
        id = req.get("id")

        result = call_method(dc, method, params)
        return {"jsonrpc": "2.0", "id": id, "result": result}

    except Exception as err:
        tb = traceback.format_exc()
        return {"jsonrpc": "2.0", "id": req.get("id"), "error": str(err), "trace": tb[:500]}


def main():
    dc = get_controller(failsafe=True)

    # Read lines from stdin until EOF
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            resp = handle_request(dc, req)
            print(json.dumps(resp), flush=True)
        except json.JSONDecodeError:
            err = {"jsonrpc": "2.0", "error": "Invalid JSON", "id": None}
            print(json.dumps(err), flush=True)


if __name__ == "__main__":
    main()
