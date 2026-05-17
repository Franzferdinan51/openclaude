package components

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewInputAreaUsesAsciiPrompt(t *testing.T) {
	input := NewInputArea(80, 3)

	if !strings.Contains(input.ta.Prompt, inputPrompt) {
		t.Fatalf("prompt missing ascii input marker: %q", input.ta.Prompt)
	}
	if strings.Contains(input.ta.Prompt, "â€º") {
		t.Fatalf("prompt still contains mojibake: %q", input.ta.Prompt)
	}
}

func TestInputAreaFocusRestoresTyping(t *testing.T) {
	input := NewInputArea(80, 3)
	input.Blur()

	if input.Focused() {
		t.Fatal("test setup expected blurred input")
	}

	input.Focus()
	_, _ = input.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'h', 'i'}})

	if got := input.Value(); got != "hi" {
		t.Fatalf("input value = %q", got)
	}
}
