package tui

import (
	"os"
	"path/filepath"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/gitlawb/duckhive/tui/model"
)

func TestHandleKeyUsesActionBindingsNotLiteralDefaults(t *testing.T) {
	km, errs := ApplyKeyOverrides(DefaultKeyMap(), map[string]string{
		"model": "ctrl+q",
		"shell": "ctrl+s",
	})
	if len(errs) != 0 {
		t.Fatalf("ApplyKeyOverrides returned errors: %v", errs)
	}

	out, consumed := HandleKey(tea.KeyMsg{Type: tea.KeyCtrlQ}, km, "Chat")
	if !consumed {
		t.Fatal("custom model key was not consumed")
	}
	if _, ok := out.(model.MsgModelPicker); !ok {
		t.Fatalf("custom model key returned %T, want MsgModelPicker", out)
	}

	out, consumed = HandleKey(tea.KeyMsg{Type: tea.KeyCtrlS}, km, "Chat")
	if !consumed {
		t.Fatal("custom shell key was not consumed")
	}
	if _, ok := out.(model.MsgToggleShellMode); !ok {
		t.Fatalf("custom shell key returned %T, want MsgToggleShellMode", out)
	}
}

func TestDefaultModelPickerBindingIsReachable(t *testing.T) {
	out, consumed := HandleKey(tea.KeyMsg{Type: tea.KeyCtrlP}, DefaultKeyMap(), "Chat")
	if !consumed {
		t.Fatal("default ctrl+p model picker key was not consumed")
	}
	if _, ok := out.(model.MsgModelPicker); !ok {
		t.Fatalf("default ctrl+p returned %T, want MsgModelPicker", out)
	}
}

func TestLoadKeyMapFromEnvMergesFileAndInlineOverrides(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "keymap.json")
	if err := os.WriteFile(path, []byte(`{"model":"ctrl+q","shell":"ctrl+s"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv(KeyMapPathEnv, path)
	t.Setenv(KeyMapEnv, `{"model":"ctrl+n","undo":"ctrl+u"}`)

	km, errs := LoadKeyMapFromEnv()
	if len(errs) != 0 {
		t.Fatalf("LoadKeyMapFromEnv returned errors: %v", errs)
	}

	out, consumed := HandleKey(tea.KeyMsg{Type: tea.KeyCtrlN}, km, "Chat")
	if !consumed {
		t.Fatal("inline override for model key was not consumed")
	}
	if _, ok := out.(model.MsgModelPicker); !ok {
		t.Fatalf("inline model key returned %T, want MsgModelPicker", out)
	}

	out, consumed = HandleKey(tea.KeyMsg{Type: tea.KeyCtrlS}, km, "Chat")
	if !consumed {
		t.Fatal("file override for shell key was not consumed")
	}
	if _, ok := out.(model.MsgToggleShellMode); !ok {
		t.Fatalf("file shell key returned %T, want MsgToggleShellMode", out)
	}

	out, consumed = HandleKey(tea.KeyMsg{Type: tea.KeyCtrlU}, km, "Chat")
	if !consumed {
		t.Fatal("inline override for undo key was not consumed")
	}
	if _, ok := out.(model.MsgUndo); !ok {
		t.Fatalf("inline undo key returned %T, want MsgUndo", out)
	}
}

func TestApplyKeyOverridesReportsUnknownActions(t *testing.T) {
	_, errs := ApplyKeyOverrides(DefaultKeyMap(), map[string]string{
		"unknown-action": "ctrl+u",
	})
	if len(errs) != 1 {
		t.Fatalf("errs = %v, want exactly one unknown action error", errs)
	}
}
