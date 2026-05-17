package tui

import (
	"strings"
	"testing"
)

func TestInputViewUsesAsciiPrompt(t *testing.T) {
	m := NewModel()
	m.width = 80

	view := m.inputView()

	if !strings.Contains(view, "> ") {
		t.Fatalf("input view missing ascii prompt marker: %q", view)
	}
	if strings.Contains(view, "\u203a") || strings.Contains(view, "\u00e2\u20ac\u00ba") {
		t.Fatalf("input view still contains non-ascii prompt marker: %q", view)
	}
}

func TestStreamingMessageUsesAsciiMarker(t *testing.T) {
	view := renderMessage(Message{
		Type:        MsgTypeAssistant,
		Content:     "working",
		IsStreaming: true,
	})

	if !strings.Contains(view, "working|") {
		t.Fatalf("streaming message missing ascii marker: %q", view)
	}
	if strings.Contains(view, "\u258c") || strings.Contains(view, "\u00e2\u2013\u0152") {
		t.Fatalf("streaming message still contains non-ascii marker: %q", view)
	}
}
