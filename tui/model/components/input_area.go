package components

import (
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/gitlawb/duckhive/tui/tui"
)

// InputAreaModel wraps a bubbles textarea for multi-line user input.
type InputAreaModel struct {
	ta      textarea.Model
	history []string
	histIdx int
}

// NewInputArea creates a focused input area with the given dimensions.
func NewInputArea(width, height int) InputAreaModel {
	ta := textarea.New()
	ta.Placeholder = "Ask DuckHive..."
	ta.Prompt = tui.ModeIndicator.Render("› ")
	ta.CharLimit = 10000
	ta.SetWidth(width)
	ta.SetHeight(height)
	ta.Focus()

	ta.Cursor.Style = lipgloss.NewStyle().
		Foreground(tui.ColorAccent)

	return InputAreaModel{
		ta:      ta,
		history: []string{},
		histIdx: -1,
	}
}

// SetValue sets the input text programmatically.
func (m *InputAreaModel) SetValue(val string) {
	m.ta.SetValue(val)
}

// Reset clears the current text.
func (m *InputAreaModel) Reset() {
	m.ta.Reset()
}

// Value returns the current input text.
func (m *InputAreaModel) Value() string {
	return m.ta.Value()
}

// SetPrompt updates the textarea prompt.
func (m *InputAreaModel) SetPrompt(prompt string) {
	m.ta.Prompt = prompt
}

// SetPlaceholder updates the textarea placeholder.
func (m *InputAreaModel) SetPlaceholder(placeholder string) {
	m.ta.Placeholder = placeholder
}

// SetSize updates the textarea dimensions.
func (m *InputAreaModel) SetSize(width, height int) {
	if width > 0 {
		m.ta.SetWidth(width)
	}
	if height > 0 {
		m.ta.SetHeight(height)
	}
}

// SetHistory loads command history for up/down navigation.
func (m *InputAreaModel) SetHistory(hist []string) {
	m.history = hist
	m.histIdx = len(hist)
}

// HistoryPrev recalls the previous history item.
func (m *InputAreaModel) HistoryPrev() {
	if len(m.history) == 0 {
		return
	}
	if m.histIdx > 0 {
		m.histIdx--
	}
	if m.histIdx >= 0 && m.histIdx < len(m.history) {
		m.ta.SetValue(m.history[m.histIdx])
	}
}

// HistoryNext recalls the next history item.
func (m *InputAreaModel) HistoryNext() {
	if len(m.history) == 0 {
		return
	}
	if m.histIdx < len(m.history)-1 {
		m.histIdx++
		m.ta.SetValue(m.history[m.histIdx])
		return
	}
	m.histIdx = len(m.history)
	m.ta.SetValue("")
}

// Init implements tea.Model.
func (m InputAreaModel) Init() tea.Cmd {
	return nil
}

// Update handles textarea events and dispatches submit.
func (m *InputAreaModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	m.ta, cmd = m.ta.Update(msg)
	return m, cmd
}

// View returns the rendered textarea.
func (m *InputAreaModel) View() string {
	return tui.InputArea.Render(m.ta.View())
}
