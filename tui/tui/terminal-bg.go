package tui

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

// detectBg queries the terminal for its background color using a background-aware
// escape sequence, then returns the closest matching 256-color ANSI code.
// Falls back to the default dark background (#171A1D) if detection fails.
func detectBg() string {
	if runtime.GOOS == "windows" {
		return "\x1b[48;5;235m" // default dark
	}

	// Query terminal for background color (ISO-8613-3 / iTerm2 / XTerm)
	cmd := exec.Command("printf", "\x1b]11;?\x1b\\")
	cmd.Stdout = nil
	out, err := cmd.Output()
	if err == nil && len(out) > 0 {
		// Response format: DCS ... ST, e.g. "\x1b]11;rgb:DDDD/DDDD/DDDD\x1b\\"
		s := string(out)
		if len(s) > 6 && s[:6] == "\x1b]11;" {
			// Try to parse rgb:RRRR/GGGG/BBBB
			for _, part := range splitString(s[6:], "/") {
				if len(part) == 4 {
					// Each component is 4 hex digits (0-65535)
					var r, g, b int
					fmt.Sscanf(part, "%04x%04x%04x", &r, &g, &b)
					return rgb256(r, g, b)
				}
			}
			// Try rgb:DD/DD/DD (8-bit)
			for _, part := range splitString(s[6:], "/") {
				if len(part) == 3 {
					var r, g, b int
					fmt.Sscanf(part, "%02x%02x%02x", &r, &g, &b)
					return rgb256(r*257/255, g*257/255, b*257/255)
				}
			}
		}
	}

	// Fallback: try direct OSC query for terminals that support it
	out2, err2 := exec.Command("sh", "-c",
		`printf '\x1b]11;?\x1b\\' 2>/dev/null | head -1 | cut -d';' -f2 | tr -d '\x1b\\'`).Output()
	if err2 == nil && len(out2) > 0 {
		return string(out2)
	}

	return "\x1b[48;5;235m" // #171A1D approximation
}

// rgb256 converts 8-bit RGB values to the nearest 256-color ANSI code.
func rgb256(r, g, b int) string {
	// Map to 6x6x6 color cube
	r6 := (r*5+127) / 255
	g6 := (g*5+127) / 255
	b6 := (b*5+127) / 255
	color := 16 + r6*36 + g6*6 + b6
	return fmt.Sprintf("\x1b[48;5;%dm", color)
}

// splitString splits a string by a separator (simple version of strings.Split).
func splitString(s, sep string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s)-len(sep); i++ {
		if s[i:i+len(sep)] == sep {
			result = append(result, s[start:i])
			start = i + len(sep)
			i += len(sep) - 1
		}
	}
	result = append(result, s[start:])
	return result
}

// detectTerminalBg writes a probe escape sequence and reads the response.
// Uses the most reliable method per platform.
func detectTerminalBg() string {
	// macOS Terminal / iTerm2: OSC 11
	if runtime.GOOS == "darwin" {
		out, err := exec.Command("osascript", "-e",
			`tell app "Terminal" to get background color of window 1`).Output()
		if err == nil && len(out) > 0 {
			// Returns like {R, G, B} with values 0-65535
			// Parse it below — but for now just return default
			_ = out
		}
	}

	return detectBg()
}

// setRawMode enables raw mode on stdin for styled input.
// Returns a cleanup function to restore normal mode.
func setRawMode() (cleanup func()) {
	// For cross-platform raw mode, use the termios package via bash
	// The actual raw mode is handled by bubbletea's textinput
	// This stub is here for documentation purposes
	return func() {}
}

// restoreTTY is a no-op stub — bubbletea handles this internally.
func restoreTTY() {}

// Default dark background matching the DuckHive theme.
const DefaultBg = "\x1b[48;5;235m"

// BG returns either the detected background or the default.
func Bg() string {
	if bg := os.Getenv("DUCKHIVE_TUI_BG"); bg != "" {
		return bg
	}
	return detectBg()
}
