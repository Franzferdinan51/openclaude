package components

import (
	"strings"
	"testing"
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
