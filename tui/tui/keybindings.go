package tui

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbletea"
	"github.com/gitlawb/duckhive/tui/model"
)

// KeyMap holds all keyboard shortcuts, organized by context.
type KeyMap struct {
	// Global — always active
	Interrupt        key.Binding
	Exit             key.Binding
	Redraw           key.Binding
	ToggleTranscript key.Binding
	ToggleTodos      key.Binding
	GlobalSearch     key.Binding

	// Chat — active while in Chat context
	Submit          key.Binding
	HistoryUp       key.Binding
	HistoryDown     key.Binding
	Cancel          key.Binding
	CycleMode       key.Binding
	ToggleShellMode key.Binding
	ModelPicker     key.Binding
	FastMode        key.Binding
	ThinkingToggle  key.Binding
	ExternalEditor  key.Binding
	Undo            key.Binding
	ImagePaste      key.Binding
	Stash           key.Binding

	// Navigation within message list
	MsgPageUp   key.Binding
	MsgPageDown key.Binding
	MsgTop      key.Binding
	MsgBottom   key.Binding
	MsgSelect   key.Binding

	// Confirmation dialog
	ConfirmYes key.Binding
	ConfirmNo  key.Binding
}

const (
	// KeyMapEnv accepts a JSON object such as {"model":"ctrl+q","shell":"ctrl+s"}.
	KeyMapEnv     = "DUCKHIVE_TUI_KEYMAP"
	KeyMapPathEnv = "DUCKHIVE_TUI_KEYMAP_PATH"
)

// DefaultKeyMap returns the full keybinding set.
func DefaultKeyMap() KeyMap {
	return KeyMap{
		// Global
		Interrupt: key.NewBinding(
			key.WithKeys("ctrl+c"),
			key.WithHelp("ctrl+c", "interrupt"),
		),
		Exit: key.NewBinding(
			key.WithKeys("ctrl+d"),
			key.WithHelp("ctrl+d", "exit"),
		),
		Redraw: key.NewBinding(
			key.WithKeys("ctrl+l"),
			key.WithHelp("ctrl+l", "redraw"),
		),
		ToggleTranscript: key.NewBinding(
			key.WithKeys("ctrl+o"),
			key.WithHelp("ctrl+o", "transcript"),
		),
		ToggleTodos: key.NewBinding(
			key.WithKeys("ctrl+t"),
			key.WithHelp("ctrl+t", "deck"),
		),
		GlobalSearch: key.NewBinding(
			key.WithKeys("ctrl+r"),
			key.WithHelp("ctrl+r", "search"),
		),

		// Chat
		Submit: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "send"),
		),
		HistoryUp: key.NewBinding(
			key.WithKeys("up"),
			key.WithHelp("up", "history prev"),
		),
		HistoryDown: key.NewBinding(
			key.WithKeys("down"),
			key.WithHelp("down", "history next"),
		),
		Cancel: key.NewBinding(
			key.WithKeys("escape"),
			key.WithHelp("esc", "cancel"),
		),
		CycleMode: key.NewBinding(
			key.WithKeys("shift+tab"),
			key.WithHelp("shift+tab", "cycle mode"),
		),
		ModelPicker: key.NewBinding(
			key.WithKeys("ctrl+p"),
			key.WithHelp("ctrl+p", "model"),
		),
		FastMode: key.NewBinding(
			key.WithKeys("ctrl+f"),
			key.WithHelp("ctrl+f", "fast mode"),
		),
		ThinkingToggle: key.NewBinding(
			key.WithKeys("ctrl+k"),
			key.WithHelp("ctrl+k", "thinking"),
		),
		ToggleShellMode: key.NewBinding(
			key.WithKeys("ctrl+x"),
			key.WithHelp("ctrl+x", "shell mode"),
		),
		ExternalEditor: key.NewBinding(
			key.WithKeys("ctrl+e"),
			key.WithHelp("ctrl+e", "edit"),
		),
		Undo: key.NewBinding(
			key.WithKeys("ctrl+_"),
			key.WithHelp("ctrl+_", "undo"),
		),
		ImagePaste: key.NewBinding(
			key.WithKeys("ctrl+v"),
			key.WithHelp("ctrl+v", "paste image"),
		),
		Stash: key.NewBinding(
			key.WithKeys("ctrl+z"),
			key.WithHelp("ctrl+z", "suspend"),
		),

		// Message navigation
		MsgPageUp: key.NewBinding(
			key.WithKeys("pgup"),
			key.WithHelp("pgup", "page up"),
		),
		MsgPageDown: key.NewBinding(
			key.WithKeys("pgdn"),
			key.WithHelp("pgdn", "page down"),
		),
		MsgTop: key.NewBinding(
			key.WithKeys("home"),
			key.WithHelp("home", "top"),
		),
		MsgBottom: key.NewBinding(
			key.WithKeys("end"),
			key.WithHelp("end", "bottom"),
		),
		MsgSelect: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "select"),
		),

		// Confirmation
		ConfirmYes: key.NewBinding(
			key.WithKeys("y", "enter"),
			key.WithHelp("y/enter", "yes"),
		),
		ConfirmNo: key.NewBinding(
			key.WithKeys("n", "escape"),
			key.WithHelp("n/esc", "no"),
		),
	}
}

// LoadKeyMapFromEnv returns the default keymap with optional JSON overrides.
func LoadKeyMapFromEnv() (KeyMap, []error) {
	overrides := map[string]string{}
	var errs []error

	if path := strings.TrimSpace(os.Getenv(KeyMapPathEnv)); path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", KeyMapPathEnv, err))
		} else if err := json.Unmarshal(data, &overrides); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", KeyMapPathEnv, err))
		}
	}

	if inline := strings.TrimSpace(os.Getenv(KeyMapEnv)); inline != "" {
		inlineOverrides := map[string]string{}
		if err := json.Unmarshal([]byte(inline), &inlineOverrides); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", KeyMapEnv, err))
		} else {
			for action, keys := range inlineOverrides {
				overrides[action] = keys
			}
		}
	}

	km, applyErrs := ApplyKeyOverrides(DefaultKeyMap(), overrides)
	errs = append(errs, applyErrs...)
	return km, errs
}

// ApplyKeyOverrides remaps known TUI actions while preserving default help text.
func ApplyKeyOverrides(km KeyMap, overrides map[string]string) (KeyMap, []error) {
	var errs []error
	for action, spec := range overrides {
		keys := splitKeySpec(spec)
		if len(keys) == 0 {
			errs = append(errs, fmt.Errorf("keymap action %q has no keys", action))
			continue
		}
		if !setActionKeys(&km, action, keys) {
			errs = append(errs, fmt.Errorf("unknown keymap action %q", action))
		}
	}
	return km, errs
}

func splitKeySpec(spec string) []string {
	var keys []string
	for _, part := range strings.Split(spec, ",") {
		if keyName := strings.TrimSpace(part); keyName != "" {
			keys = append(keys, keyName)
		}
	}
	return keys
}

func setActionKeys(km *KeyMap, action string, keys []string) bool {
	switch normalizeKeyAction(action) {
	case "interrupt":
		setBindingKeys(&km.Interrupt, keys)
	case "exit", "quit":
		setBindingKeys(&km.Exit, keys)
	case "redraw":
		setBindingKeys(&km.Redraw, keys)
	case "transcript", "toggletranscript":
		setBindingKeys(&km.ToggleTranscript, keys)
	case "deck", "todos", "toggletodos":
		setBindingKeys(&km.ToggleTodos, keys)
	case "search", "globalsearch":
		setBindingKeys(&km.GlobalSearch, keys)
	case "submit", "send":
		setBindingKeys(&km.Submit, keys)
	case "historyup":
		setBindingKeys(&km.HistoryUp, keys)
	case "historydown":
		setBindingKeys(&km.HistoryDown, keys)
	case "cancel":
		setBindingKeys(&km.Cancel, keys)
	case "cyclemode":
		setBindingKeys(&km.CycleMode, keys)
	case "shell", "shellmode", "toggleshellmode":
		setBindingKeys(&km.ToggleShellMode, keys)
	case "model", "modelpicker":
		setBindingKeys(&km.ModelPicker, keys)
	case "fast", "fastmode":
		setBindingKeys(&km.FastMode, keys)
	case "edit", "externaleditor":
		setBindingKeys(&km.ExternalEditor, keys)
	case "undo":
		setBindingKeys(&km.Undo, keys)
	case "suspend", "stash":
		setBindingKeys(&km.Stash, keys)
	case "pageup":
		setBindingKeys(&km.MsgPageUp, keys)
	case "pagedown":
		setBindingKeys(&km.MsgPageDown, keys)
	case "confirmyes", "yes":
		setBindingKeys(&km.ConfirmYes, keys)
	case "confirmno", "no":
		setBindingKeys(&km.ConfirmNo, keys)
	default:
		return false
	}
	return true
}

func normalizeKeyAction(action string) string {
	action = strings.ToLower(strings.TrimSpace(action))
	action = strings.ReplaceAll(action, "-", "")
	action = strings.ReplaceAll(action, "_", "")
	action = strings.ReplaceAll(action, " ", "")
	return action
}

func setBindingKeys(binding *key.Binding, keys []string) {
	help := binding.Help()
	binding.SetKeys(keys...)
	binding.SetHelp(strings.Join(keys, "/"), help.Desc)
}

// ActiveBindings returns the bindings relevant to the given context.
func ActiveBindings(km KeyMap, ctx string) []key.Binding {
	switch ctx {
	case "Chat":
		return []key.Binding{
			km.Interrupt, km.Exit, km.Redraw,
			km.ToggleTranscript, km.ToggleTodos, km.GlobalSearch,
			km.Submit, km.HistoryUp, km.HistoryDown, km.Cancel,
			km.CycleMode, km.ToggleShellMode, km.FastMode,
			km.ModelPicker, km.ExternalEditor, km.Undo, km.Stash,
		}
	case "Confirmation":
		return []key.Binding{km.Interrupt, km.Exit, km.Redraw, km.ConfirmYes, km.ConfirmNo}
	case "Settings":
		return []key.Binding{km.Interrupt, km.Exit, km.Redraw, km.Cancel, km.Submit}
	default:
		return []key.Binding{
			km.Interrupt, km.Exit, km.Redraw,
			km.ToggleTranscript, km.ToggleTodos, km.GlobalSearch,
		}
	}
}

// HandleKey resolves a key press to a model.OutMsg based on active context.
// Returns nil if the key is not handled.
func HandleKey(msg tea.KeyMsg, km KeyMap, ctx string) (out model.OutMsg, consumed bool) {
	switch {
	case key.Matches(msg, km.Interrupt):
		return model.MsgInterrupt{}, true
	case key.Matches(msg, km.Exit):
		return model.MsgExit{}, true
	case key.Matches(msg, km.Redraw):
		return model.MsgRedraw{}, true
	case key.Matches(msg, km.ToggleTranscript):
		return model.MsgToggleTranscript{}, true
	case key.Matches(msg, km.ToggleTodos):
		return model.MsgToggleTodos{}, true
	case key.Matches(msg, km.GlobalSearch):
		return model.MsgNavigate{Screen: model.ScreenREPL}, true
	}

	switch ctx {
	case "Chat":
		return handleChatBinding(msg, km)
	case "Confirmation":
		return handleConfirmationBinding(msg, km)
	case "Settings":
		return handleSettingsBinding(msg, km)
	}
	return nil, false
}

func handleChatBinding(msg tea.KeyMsg, km KeyMap) (model.OutMsg, bool) {
	switch {
	case key.Matches(msg, km.Submit):
		return model.MsgInputSubmitted{}, true
	case key.Matches(msg, km.HistoryUp):
		return model.MsgHistoryUp{}, true
	case key.Matches(msg, km.HistoryDown):
		return model.MsgHistoryDown{}, true
	case key.Matches(msg, km.Cancel):
		return model.MsgCancelInput{}, true
	case key.Matches(msg, km.CycleMode):
		return model.MsgCycleMode{}, true
	case key.Matches(msg, km.ToggleShellMode):
		return model.MsgToggleShellMode{}, true
	case key.Matches(msg, km.ModelPicker):
		return model.MsgModelPicker{}, true
	case key.Matches(msg, km.FastMode):
		return model.MsgToggleFastMode{}, true
	case key.Matches(msg, km.ExternalEditor):
		return model.MsgExternalEditor{}, true
	case key.Matches(msg, km.Undo):
		return model.MsgUndo{}, true
	case key.Matches(msg, km.Stash):
		return model.MsgSuspend{}, true
	case key.Matches(msg, km.MsgPageUp):
		return model.MsgPageUp{}, true
	case key.Matches(msg, km.MsgPageDown):
		return model.MsgPageDown{}, true
	}
	return nil, false
}

func handleConfirmationBinding(msg tea.KeyMsg, km KeyMap) (model.OutMsg, bool) {
	switch {
	case key.Matches(msg, km.ConfirmYes):
		return model.MsgConfirmYes{}, true
	case key.Matches(msg, km.ConfirmNo):
		return model.MsgConfirmNo{}, true
	}
	return nil, false
}

func handleSettingsBinding(msg tea.KeyMsg, km KeyMap) (model.OutMsg, bool) {
	switch {
	case key.Matches(msg, km.Cancel):
		return model.MsgPopDialog{}, true
	case key.Matches(msg, km.Submit):
		return model.MsgConfirmYes{}, true
	}
	return nil, false
}
