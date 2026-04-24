package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// View renders the full TUI.
func (m *Model) View() string {
	if m.isSuspended {
		return Styles.DimText.Render("\nDuckHive suspended. Run `fg` to bring it back.\n")
	}

	var sb strings.Builder

	sb.WriteString(m.headerView())
	sb.WriteString(m.messagesView())
	sb.WriteString(m.statusView())
	sb.WriteString(m.inputView())

	return sb.String()
}

// headerView renders the top bar with logo/title.
func (m *Model) headerView() string {
	title := Styles.HeaderTitle.Render("DuckHive")
	version := Styles.HeaderSubtitle.Render("v0.8.0")
	status := ""
	if m.isLoading {
		status = " " + m.spinner.View()
	}
	if m.modelName != "" {
		status += " " + Styles.DimText.Render(m.modelName)
	}
	if m.totalCost > 0 {
		status += " " + Styles.DimText.Render(fmt.Sprintf("$%.4f", m.totalCost))
	}

	left := fmt.Sprintf(" %s %s", title, version)
	right := status

	header := Styles.Header.
		Width(m.width).
		Render(padLeft(left, m.width-len(stripAnsi(right))) + right)

	return header + "\n"
}

// messagesView renders the scrollable message list.
func (m *Model) messagesView() string {
	var sb strings.Builder

	for _, msg := range m.messages {
		sb.WriteString(renderMessage(msg, m.toolDisplay))
	}

	m.viewport.SetContent(sb.String())
	return m.viewport.View()
}

// statusView renders the bottom status bar.
func (m *Model) statusView() string {
	segments := []string{}

	if m.isLoading {
		segments = append(segments, m.spinner.View()+" processing")
	}
	if m.isStreaming {
		segments = append(segments, "streaming...")
	}

	left := strings.Join(segments, "  ")
	right := ""
	if m.ctx != CtxChat {
		right = Styles.ModeIndicator.Render(contextLabel(m.ctx))
	}

	width := m.width - len(stripAnsi(left)) - len(stripAnsi(right))
	if width < 0 {
		width = 0
	}

	return Styles.StatusBar.Width(m.width).Render(padLeft(left, width) + right) + "\n"
}

// inputView renders the text input area.
func (m *Model) inputView() string {
	prompt := Styles.ModeIndicator.Render("› ")
	input := m.input.View()

	switch m.inputStyle {
	case InputStyleBlock:
		// Full-width background box
		block := Styles.InputBlock.Render(prompt + input)
		return Styles.InputArea.Width(m.width).Render(block) + "\n"

	case InputStyleBordered:
		// ─ lines above/below
		separator := Styles.DimText.Render(strings.Repeat("─", m.width))
		content := prompt + input
		field := Styles.InputBordered.Width(m.width).Render(content)
		return separator + "\n" + Styles.InputArea.Width(m.width).Render(field) + "\n" + separator + "\n"

	default:
		// Plain (default)
		inputBorder := Styles.InputField
		if m.ctx == CtxConfirmation {
			inputBorder = inputBorder.BorderForeground(lipgloss.Color("#FF5370"))
		}
		return Styles.InputArea.Width(m.width).Render(prompt + input) + "\n"
	}
}

// renderMessage turns a Message into a rendered string.
// toolDisplay controls how tool calls are shown.
func renderMessage(msg Message, toolDisplay ToolDisplayMode) string {
	var bubble string

	switch msg.Type {
	case MsgTypeUser:
		label := Styles.DimText.Render("you")
		bubble = Styles.UserBubble.Render(label + "  " + msg.Content)

	case MsgTypeAssistant:
		label := Styles.HeaderSubtitle.Render("duck")
		content := msg.Content
		if msg.IsStreaming {
			content += "▌"
		}
		bubble = Styles.AssistantBubble.Render(label + "\n" + content)

	case MsgTypeSystem:
		bubble = Styles.SystemBubble.Render(msg.Content)

	case MsgTypeToolUse:
		bubble = renderToolMessage(msg, toolDisplay)

	case MsgTypeProgress:
		bubble = Styles.DimText.Render(msg.Content)

	default:
		bubble = Styles.DimText.Render(msg.Content)
	}

	return bubble + "\n"
}

// renderToolMessage renders a tool use message according to the current display mode.
func renderToolMessage(msg Message, mode ToolDisplayMode) string {
	toolName := msg.ToolName
	if toolName == "" {
		toolName = "(tool)"
	}

	switch mode {
	case ToolDisplayHidden:
		// Suppress tool output entirely
		return ""

	case ToolDisplayEmoji:
		// ⚡ tool_name → ✓/✗ result with timing
		header := Styles.ToolEmojiHeader.Render("⚡ " + toolName)
		if msg.IsError {
			errMsg := msg.Content
			if errMsg == "" {
				errMsg = "failed"
			}
			result := Styles.ToolEmojiFail.Render("✗ " + errMsg)
			return Styles.ToolBubble.Render(header + "  " + result)
		}
		result := Styles.ToolEmojiOK.Render("✓ done")
		content := msg.Content
		if content != "" {
			result += " " + Styles.DimText.Render(content)
		}
		return Styles.ToolBubble.Render(header + "  " + result)

	case ToolDisplayMinimal:
		// → ran tool_name inline
		return Styles.DimText.Render("→ ran " + toolName)

	default:
		// ToolDisplayGrouped — bold label + full content (original behavior)
		toolLabel := Styles.DimText.Render("tool:") + " " +
			Styles.ModeIndicator.Render(toolName)
		return Styles.ToolBubble.Render(toolLabel + "  " + msg.Content)
	}
}

// welcomeScreenWithBanner renders the ASCII art banner for the welcome screen.
// The banner is colored in ColorAccent (#F3B33D) with subtitle in ColorMuted.
func (m *Model) welcomeScreenWithBanner() string {
	banner := Styles.BannerAccent.Render(
		"██████╗ ███████╗███████╗████████╗███████╗██╗     ██╗███╗   ██╗███████╗\n"+
			"██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔════╝██║     ██║████╗  ██║██╔════╝\n"+
			"██████╔╝███████╗███████╗   ██║   █████╗  ██║     ██║██╔██╗ ██║█████╗  \n"+
			"██╔═══╝ ██╔══╝  ╚════██║   ██║   ██╔══╝  ██║     ██║██║╚██╗██║██╔══╝  \n"+
			"██║     ███████╗███████║   ██║   ███████╗███████╗██║██║ ╚████║███████╗\n"+
			"╚═╝     ╚══════╝╚══════╝   ╚═╝   ╚══════╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝")

	subtitle := Styles.BannerMuted.Render("v0.8.0 — Your AI Coding Agent")

	// Model and cost info
	modelLine := ""
	if m.modelName != "" {
		modelLine = Styles.DimText.Render("model: ") + Styles.ModeIndicator.Render(m.modelName)
	}
	costLine := ""
	if m.totalCost > 0 {
		costLine = Styles.DimText.Render("cost: ") + Styles.CostInfo.Render(fmt.Sprintf("$%.4f", m.totalCost))
	}

	sep := Styles.DimText.Render(strings.Repeat("─", m.width))

	var sb strings.Builder
	sb.WriteString("\n")
	sb.WriteString(sep)
	sb.WriteString("\n")
	sb.WriteString(m.centerText(banner, m.width))
	sb.WriteString("\n")
	sb.WriteString(m.centerText(subtitle, m.width))
	sb.WriteString("\n")
	if modelLine != "" || costLine != "" {
		sb.WriteString(m.centerText(modelLine+"    "+costLine, m.width))
		sb.WriteString("\n")
	}
	sb.WriteString(sep)
	sb.WriteString("\n")
	sb.WriteString(m.centerText(Styles.BannerMuted.Render("Type /help for commands"), m.width))
	sb.WriteString("\n")

	return sb.String()
}

// centerText centers a string within a given width.
func (m *Model) centerText(s string, width int) string {
	visible := len(stripAnsi(s))
	if visible >= width {
		return s
	}
	pad := (width - visible) / 2
	return strings.Repeat(" ", pad) + s
}

// contextLabel returns a human-readable label for an AppContext.
func contextLabel(ctx AppContext) string {
	switch ctx {
	case CtxChat:
		return "CHAT"
	case CtxConfirmation:
		return "CONFIRM"
	case CtxSettings:
		return "SETTINGS"
	case CtxSelect:
		return "SELECT"
	default:
		return "GLOBAL"
	}
}

// padLeft pads a string to the left to fill width.
func padLeft(s string, width int) string {
	visible := len(stripAnsi(s))
	if visible >= width {
		return s
	}
	pad := strings.Repeat(" ", width-visible)
	return pad + s
}

// stripAnsi removes ANSI escape codes for plain-text length calculation.
func stripAnsi(s string) string {
	in := false
	var r strings.Builder
	for _, ch := range s {
		if ch == '\x1b' {
			in = true
			continue
		}
		if ch == 'm' && in {
			in = false
			continue
		}
		if !in {
			r.WriteRune(ch)
		}
	}
	return r.String()
}
