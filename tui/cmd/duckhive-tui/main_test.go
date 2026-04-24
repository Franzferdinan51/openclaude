package main

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/gitlawb/duckhive/tui/model"
	"github.com/gitlawb/duckhive/tui/model/bridge"
	"github.com/gitlawb/duckhive/tui/model/components"
	"github.com/gitlawb/duckhive/tui/model/screens"
)

func TestParseUISwitchCommandUsesExplicitTargets(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		wantTarget  uiSurface
		wantHandled bool
		wantErr     bool
	}{
		{
			name:        "bare tui opens tui",
			input:       "/tui",
			wantTarget:  uiSurfaceTUI,
			wantHandled: true,
		},
		{
			name:        "ui legacy switches back to repl",
			input:       "/ui legacy",
			wantTarget:  uiSurfaceLegacy,
			wantHandled: true,
		},
		{
			name:        "repl alias switches back to repl",
			input:       "/repl",
			wantTarget:  uiSurfaceLegacy,
			wantHandled: true,
		},
		{
			name:        "invalid target returns usage error",
			input:       "/tui nope",
			wantHandled: true,
			wantErr:     true,
		},
		{
			name:  "normal prompt is ignored",
			input: "fix the bug",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, handled, err := parseUISwitchCommand(tt.input)
			if handled != tt.wantHandled {
				t.Fatalf("handled = %v, want %v", handled, tt.wantHandled)
			}
			if target != tt.wantTarget {
				t.Fatalf("target = %q, want %q", target, tt.wantTarget)
			}
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestBuildLauncherEnvStripsTUIOnlyStateForLegacyHandoff(t *testing.T) {
	t.Setenv("DUCKHIVE_AUTO_TUI", "1")
	t.Setenv("DUCKHIVE_DEFAULT_UI_SURFACE", "tui")
	t.Setenv("DUCKHIVE_NO_AUTO_TUI", "0")
	t.Setenv("DUCKHIVE_BRIDGE_CMD", "node")
	t.Setenv("DUCKHIVE_BRIDGE_ARGS", "dist/cli.mjs --print")
	t.Setenv("DUCKHIVE_BRIDGE_SOCKET", "/tmp/duckhive.sock")
	t.Setenv("DUCKHIVE_LAUNCHER_CMD", "node")
	t.Setenv("DUCKHIVE_LAUNCHER_ENTRY", "dist/cli.mjs")

	env := envSliceToMap(buildLauncherEnv(uiSurfaceLegacy))

	if got := env["DUCKHIVE_DEFAULT_UI_SURFACE"]; got != "legacy" {
		t.Fatalf("DUCKHIVE_DEFAULT_UI_SURFACE = %q, want %q", got, "legacy")
	}
	if got := env["DUCKHIVE_NO_AUTO_TUI"]; got != "1" {
		t.Fatalf("DUCKHIVE_NO_AUTO_TUI = %q, want %q", got, "1")
	}

	for _, key := range []string{
		"DUCKHIVE_AUTO_TUI",
		"DUCKHIVE_BRIDGE_CMD",
		"DUCKHIVE_BRIDGE_ARGS",
		"DUCKHIVE_BRIDGE_SOCKET",
		"DUCKHIVE_LAUNCHER_CMD",
		"DUCKHIVE_LAUNCHER_ENTRY",
	} {
		if _, ok := env[key]; ok {
			t.Fatalf("%s should be removed from legacy handoff env", key)
		}
	}
}

func TestParseLocalTUICommand(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		wantCommand localTUICommand
		wantHandled bool
	}{
		{name: "help opens command deck", input: "/help", wantCommand: localTUICommandDeck, wantHandled: true},
		{name: "deck alias opens command deck", input: "/deck", wantCommand: localTUICommandDeck, wantHandled: true},
		{name: "status opens status", input: "/status", wantCommand: localTUICommandStatus, wantHandled: true},
		{name: "doctor opens status", input: "/doctor", wantCommand: localTUICommandStatus, wantHandled: true},
		{name: "agents opens super agent", input: "/agents", wantCommand: localTUICommandSuperAgent, wantHandled: true},
		{name: "teams opens super agent", input: "/teams", wantCommand: localTUICommandSuperAgent, wantHandled: true},
		{name: "council opens council", input: "/council", wantCommand: localTUICommandCouncil, wantHandled: true},
		{name: "provider opens provider card", input: "/provider", wantCommand: localTUICommandProvider, wantHandled: true},
		{name: "search opens search provider card", input: "/search-provider", wantCommand: localTUICommandSearch, wantHandled: true},
		{name: "normal input passes through", input: "fix the bug"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			command, handled := parseLocalTUICommand(tt.input)
			if handled != tt.wantHandled {
				t.Fatalf("handled = %v, want %v", handled, tt.wantHandled)
			}
			if command != tt.wantCommand {
				t.Fatalf("command = %q, want %q", command, tt.wantCommand)
			}
		})
	}
}

func TestLocalCommandContentSurfacesCoreAgentFeatures(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
		cap: workspaceCapabilities{
			hasCouncil:          true,
			hasTeams:            true,
			hasMCP:              true,
			activeProvider:      "minimax",
			configuredProviders: []string{"minimax", "openrouter"},
			searchProvider:      "tavily",
			configuredSearch:    []string{"tavily", "duckduckgo"},
		},
	}

	content := m.localCommandContent(localTUICommandDeck)
	for _, want := range []string{
		"Super Agent",
		"Agent Teams",
		"AI Council",
		"Search providers",
		"/search-provider",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("local command content missing %q:\n%s", want, content)
		}
	}
}

func TestTaskLifecycleDeduplicatesAndClearsByID(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		transcript: screens.NewTranscriptPanel(),
	}

	m.handleBridgeMessage(model.MsgTaskStarted{ID: "task-1", Desc: "first"})
	m.handleBridgeMessage(model.MsgTaskStarted{ID: "task-1", Desc: "duplicate"})
	if m.state.ActiveTaskCount != 1 {
		t.Fatalf("ActiveTaskCount after duplicate start = %d, want 1", m.state.ActiveTaskCount)
	}

	m.handleBridgeMessage(model.MsgTaskEnded{ID: "task-1"})
	if m.state.ActiveTaskCount != 0 {
		t.Fatalf("ActiveTaskCount after task end = %d, want 0", m.state.ActiveTaskCount)
	}
}

func TestTaskLifecycleClearsStaleTasksOnIdle(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		transcript: screens.NewTranscriptPanel(),
	}

	m.handleBridgeMessage(model.MsgTaskStarted{ID: "task-1"})
	m.handleBridgeMessage(model.MsgTaskStarted{ID: "task-2"})
	m.handleBridgeMessage(model.MsgTasksCleared{})

	if m.state.ActiveTaskCount != 0 {
		t.Fatalf("ActiveTaskCount after clear = %d, want 0", m.state.ActiveTaskCount)
	}
	if len(m.state.ActiveTaskIDs) != 0 {
		t.Fatalf("ActiveTaskIDs after clear = %d, want 0", len(m.state.ActiveTaskIDs))
	}
}

func TestCtrlCQuitsFromSettingsScreen(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		transcript: screens.NewTranscriptPanel(),
	}
	m.state.ActiveScreen = model.ScreenSettings
	m.settings = screens.NewSettingsScreen(&m.state)

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})
	if !commandReturnsQuit(cmd) {
		t.Fatal("ctrl+c from settings did not return tea.Quit")
	}
}

func TestInterruptExitsWhenIdleEvenWithBridge(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		bridge:     bridge.NewSubprocessAdapter("duckhive"),
		msgList:    components.NewMessageList(80, 20),
		transcript: screens.NewTranscriptPanel(),
	}

	_, cmd := m.handleOutbound(model.MsgInterrupt{})
	if !commandReturnsQuit(cmd) {
		t.Fatal("idle interrupt did not return tea.Quit")
	}
}

func envSliceToMap(entries []string) map[string]string {
	out := make(map[string]string, len(entries))
	for _, entry := range entries {
		for i := 0; i < len(entry); i++ {
			if entry[i] != '=' {
				continue
			}
			out[entry[:i]] = entry[i+1:]
			break
		}
	}
	return out
}

func commandReturnsQuit(cmd tea.Cmd) bool {
	if cmd == nil {
		return false
	}
	_, ok := cmd().(tea.QuitMsg)
	return ok
}
