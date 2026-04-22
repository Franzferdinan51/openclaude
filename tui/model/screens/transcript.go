package screens

import (
	"github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/gitlawb/duckhive/tui/model"
	"github.com/gitlawb/duckhive/tui/tui"
)

// TranscriptPanel is a collapsible side panel showing message history.
type TranscriptPanel struct {
	messages []model.Message
	visible  bool
	width    int
	height   int
	selected int
}

func NewTranscriptPanel() *TranscriptPanel {
	return &TranscriptPanel{visible: false, selected: 0}
}

// Toggle visibility of the transcript panel.
func (m *TranscriptPanel) Toggle() {
	m.visible = !m.visible
}

// SetMessages updates the message list.
func (m *TranscriptPanel) SetMessages(msgs []model.Message) {
	m.messages = msgs
}

// SetSize updates the panel dimensions.
func (m *TranscriptPanel) SetSize(width, height int) {
	if width > 0 {
		m.width = width
	}
	if height > 0 {
		m.height = height
	}
}

// Init implements tea.Model.
func (m TranscriptPanel) Init() tea.Cmd {
	return nil
}

// Update handles transcript panel input.
func (m *TranscriptPanel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if m.selected > 0 {
				m.selected--
			}
		case "down", "j":
			if m.selected < len(m.messages)-1 {
				m.selected++
			}
		case "escape", "ctrl+o":
			m.visible = false
		}
	}
	return m, nil
}

// View renders the transcript panel.
func (m *TranscriptPanel) View() string {
	if !m.visible {
		return ""
	}

	var lines []string
	limit := len(m.messages)
	if m.height > 0 && limit > m.height-4 {
		limit = m.height - 4
	}
	start := len(m.messages) - limit
	if start < 0 {
		start = 0
	}
	for i, msg := range m.messages[start:] {
		prefix := "  "
		style := tui.DimText
		if start+i == m.selected {
			prefix = tui.Accent.Render("▶ ")
			style = tui.ModeIndicator
		}
		marker := msgMarker(msg.Type)
		maxWidth := 40
		if m.width > 12 {
			maxWidth = m.width - 8
		}
		lines = append(lines, style.Render(prefix+marker+" "+truncate(msg.Content, maxWidth)))
	}
	if len(lines) == 0 {
		lines = append(lines, tui.DimText.Render("  (no messages)"))
	}

	content := lipgloss.JoinVertical(0, lines...)
	footer := tui.DimText.Render("↑↓ navigate  esc/ctrl+o close")

	return lipgloss.JoinVertical(0, content, "", footer)
}

// IsVisible returns whether the panel is shown.
func (m *TranscriptPanel) IsVisible() bool {
	return m.visible
}

func msgMarker(t model.MessageType) string {
	switch t {
	case model.MsgTypeUser:
		return ">"
	case model.MsgTypeAssistant:
		return "<"
	case model.MsgTypeSystem:
		return "!"
	default:
		return "|"
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
