package components

import (
	"strings"
	"testing"

	"github.com/gitlawb/duckhive/tui/model"
)

func TestFormatLabeledMessageUsesAsciiStreamingCursor(t *testing.T) {
	rendered := formatMessage(model.Message{
		Type:        model.MsgTypeAssistant,
		Content:     "hello",
		IsStreaming: true,
	}, 80, false)

	if !strings.Contains(rendered, "hello|") {
		t.Fatalf("rendered missing ascii cursor:\n%s", rendered)
	}
	if strings.Contains(rendered, "â–Œ") {
		t.Fatalf("rendered still contains mojibake cursor:\n%s", rendered)
	}
}

func TestFormatToolMessageUsesAsciiStreamingCursor(t *testing.T) {
	rendered := formatMessage(model.Message{
		Type:        model.MsgTypeToolResult,
		Content:     "running",
		IsStreaming: true,
		ToolCalls: []model.ToolCall{{
			Name:   "shell",
			Status: model.ToolStatusPending,
		}},
	}, 80, false)

	if !strings.Contains(rendered, "running|") {
		t.Fatalf("rendered missing ascii cursor:\n%s", rendered)
	}
	if strings.Contains(rendered, "â–Œ") {
		t.Fatalf("rendered still contains mojibake cursor:\n%s", rendered)
	}
}
