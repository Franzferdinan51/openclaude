package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestChatKeysForwardTypingToInput(t *testing.T) {
	m := NewModel(80, 24)

	_, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'o', 'k'}})

	if got := m.input.Value(); got != "ok" {
		t.Fatalf("input value = %q", got)
	}
	if !m.input.Focused() {
		t.Fatal("expected input to stay focused")
	}
}
