package main

import (
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/gitlawb/duckhive/tui/model"
	"github.com/gitlawb/duckhive/tui/model/bridge"
	"github.com/gitlawb/duckhive/tui/model/components"
	"github.com/gitlawb/duckhive/tui/model/screens"
	"github.com/gitlawb/duckhive/tui/tui"
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

func TestSnapshotRequestParser(t *testing.T) {
	if !isSnapshotRequest([]string{"--snapshot"}) {
		t.Fatal("--snapshot should enable snapshot mode")
	}
	if !isSnapshotRequest([]string{"snapshot"}) {
		t.Fatal("snapshot should enable snapshot mode")
	}
	if isSnapshotRequest([]string{"--help"}) {
		t.Fatal("--help should not enable snapshot mode")
	}
}

func TestInputSmokeRequestParser(t *testing.T) {
	text, ok := inputSmokeRequest([]string{"--input-smoke", "hello tui"})
	if !ok {
		t.Fatal("--input-smoke should enable input smoke mode")
	}
	if text != "hello tui" {
		t.Fatalf("input smoke text = %q", text)
	}

	text, ok = inputSmokeRequest([]string{"input-smoke"})
	if !ok {
		t.Fatal("input-smoke should enable input smoke mode")
	}
	if text == "" {
		t.Fatal("input smoke default text should not be empty")
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
		{name: "agent alias opens super agent", input: "/agent", wantCommand: localTUICommandSuperAgent, wantHandled: true},
		{name: "teams opens super agent", input: "/teams", wantCommand: localTUICommandSuperAgent, wantHandled: true},
		{name: "runs opens agent run surface", input: "/runs", wantCommand: localTUICommandRuns, wantHandled: true},
		{name: "tasks opens agent run surface", input: "/tasks", wantCommand: localTUICommandRuns, wantHandled: true},
		{name: "goal opens goal surface", input: "/goal", wantCommand: localTUICommandGoal, wantHandled: true},
		{name: "goals opens goal surface", input: "/goals", wantCommand: localTUICommandGoal, wantHandled: true},
		{name: "council opens council", input: "/council", wantCommand: localTUICommandCouncil, wantHandled: true},
		{name: "providers alias opens provider card", input: "/providers", wantCommand: localTUICommandProvider, wantHandled: true},
		{name: "models alias opens provider card", input: "/models", wantCommand: localTUICommandProvider, wantHandled: true},
		{name: "search alias opens search provider card", input: "/search", wantCommand: localTUICommandSearch, wantHandled: true},
		{name: "search-providers alias opens search provider card", input: "/search-providers", wantCommand: localTUICommandSearch, wantHandled: true},
		{name: "computer-use opens computer-use card", input: "/computer-use", wantCommand: localTUICommandComputer, wantHandled: true},
		{name: "cu opens computer-use card", input: "/cu", wantCommand: localTUICommandComputer, wantHandled: true},
		{name: "computer-use with args passes through to backend", input: "/computer-use tools"},
		{name: "connect opens connector card", input: "/connect", wantCommand: localTUICommandConnect, wantHandled: true},
		{name: "telegram opens connector card", input: "/telegram", wantCommand: localTUICommandConnect, wantHandled: true},
		{name: "channel opens connector card", input: "/channel", wantCommand: localTUICommandConnect, wantHandled: true},
		{name: "telegram with args passes through to backend", input: "/telegram status"},
		{name: "checkpoint opens harness state", input: "/checkpoint", wantCommand: localTUICommandHarness, wantHandled: true},
		{name: "budget opens harness state", input: "/budget", wantCommand: localTUICommandHarness, wantHandled: true},
		{name: "mcp opens harness state", input: "/mcp", wantCommand: localTUICommandHarness, wantHandled: true},
		{name: "acp opens harness state", input: "/acp", wantCommand: localTUICommandHarness, wantHandled: true},
		{name: "permissions opens harness state", input: "/permissions", wantCommand: localTUICommandHarness, wantHandled: true},
		{name: "budget with args passes through to backend", input: "/budget set minimax 5"},
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

func TestHandleLocalTUICommandUsesBackendForProviderCommands(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantStatus string
	}{
		{name: "provider manager", input: "/provider", wantStatus: "opening provider manager"},
		{name: "model manager", input: "/model", wantStatus: "opening model manager"},
		{name: "search manager", input: "/search-provider", wantStatus: "opening search-provider manager"},
		{name: "run manager", input: "/run", wantStatus: "opening agent runs"},
		{name: "goal manager", input: "/goal", wantStatus: "opening goal status"},
		{name: "council manager", input: "/council", wantStatus: "opening council"},
		{name: "agents manager", input: "/agents", wantStatus: "opening agents"},
		{name: "doctor manager", input: "/doctor", wantStatus: "opening doctor"},
		{name: "computer-use manager", input: "/computer-use", wantStatus: "opening computer-use status"},
		{name: "connect manager", input: "/connect", wantStatus: "opening connector status"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := &MainModel{
				state:      model.NewAppState(),
				bridge:     bridge.NewSubprocessAdapter("duckhive"),
				msgList:    components.NewMessageList(80, 20),
				input:      components.NewInputArea(80, 3),
				transcript: screens.NewTranscriptPanel(),
			}
			m.state.BridgeConnected = true

			handled, cmd := m.handleLocalTUICommand(tt.input)
			if !handled {
				t.Fatal("expected command to be handled")
			}
			if cmd == nil {
				t.Fatal("expected backend dispatch command")
			}
			if msg := cmd(); msg != nil {
				t.Fatalf("expected nil bridge send result, got %#v", msg)
			}
			if m.state.StatusMsg != tt.wantStatus {
				t.Fatalf("StatusMsg = %q, want %q", m.state.StatusMsg, tt.wantStatus)
			}
			if len(m.state.Messages) != 0 {
				t.Fatalf("expected no local snapshot message, got %d", len(m.state.Messages))
			}
		})
	}
}

func TestHandleLocalTUICommandFallsBackLocallyWhenBridgeIsUnavailable(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		wantStatus    string
		wantSubstring string
	}{
		{name: "provider fallback", input: "/provider", wantStatus: "bridge unavailable; showing local provider card", wantSubstring: "Model providers"},
		{name: "run fallback", input: "/run", wantStatus: "bridge unavailable; showing local run card", wantSubstring: "AgentRun control plane"},
		{name: "goal fallback", input: "/goal", wantStatus: "bridge unavailable; showing local goal card", wantSubstring: "Persisted goals"},
		{name: "agents fallback", input: "/agents", wantStatus: "bridge unavailable; showing local agents card", wantSubstring: "Super Agent"},
		{name: "council fallback", input: "/council", wantStatus: "bridge unavailable; showing local council card", wantSubstring: "AI Council"},
		{name: "search fallback", input: "/search-provider", wantStatus: "bridge unavailable; showing local search card", wantSubstring: "Search providers"},
		{name: "computer-use fallback", input: "/computer-use", wantStatus: "bridge unavailable; showing local computer-use card", wantSubstring: "Computer use"},
		{name: "connect fallback", input: "/connect", wantStatus: "bridge unavailable; showing local connector card", wantSubstring: "Connectors"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := &MainModel{
				state:      model.NewAppState(),
				bridge:     bridge.NewSubprocessAdapter("duckhive"),
				msgList:    components.NewMessageList(80, 20),
				input:      components.NewInputArea(80, 3),
				transcript: screens.NewTranscriptPanel(),
			}

			handled, cmd := m.handleLocalTUICommand(tt.input)
			if !handled {
				t.Fatal("expected command to be handled")
			}
			if cmd != nil {
				t.Fatal("expected no backend dispatch command")
			}
			if m.state.StatusMsg != tt.wantStatus {
				t.Fatalf("StatusMsg = %q, want %q", m.state.StatusMsg, tt.wantStatus)
			}
			if len(m.state.Messages) == 0 {
				t.Fatal("expected local fallback message")
			}
			last := m.state.Messages[len(m.state.Messages)-1]
			if !strings.Contains(last.Content, tt.wantSubstring) {
				t.Fatalf("fallback content missing %q:\n%s", tt.wantSubstring, last.Content)
			}
		})
	}
}

func TestHandleLocalTUICommandDoctorExplainsOfflineBridge(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		bridge:     bridge.NewSubprocessAdapter("duckhive"),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		transcript: screens.NewTranscriptPanel(),
	}

	handled, cmd := m.handleLocalTUICommand("/doctor")
	if !handled {
		t.Fatal("expected command to be handled")
	}
	if cmd != nil {
		t.Fatal("expected no backend dispatch command")
	}
	if m.state.StatusMsg != "bridge unavailable; /doctor needs backend UI" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
	if len(m.state.Messages) == 0 {
		t.Fatal("expected offline guidance message")
	}
	last := m.state.Messages[len(m.state.Messages)-1]
	if !last.IsError {
		t.Fatal("expected offline doctor guidance to be marked as error")
	}
	if !strings.Contains(last.Content, "/status") || !strings.Contains(last.Content, "/repl") {
		t.Fatalf("unexpected guidance:\n%s", last.Content)
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
		"AgentRun",
		"Codex-style persisted goal status",
		"/goal",
		"AI Council",
		"Search providers",
		"/search-provider",
		"Computer use",
		"/computer-use tools",
		"Connectors",
		"/telegram status",
		"Harness state",
		"/checkpoint",
		"/budget",
		"/mcp",
		"/acp",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("local command content missing %q:\n%s", want, content)
		}
	}
}

func TestHarnessStateSnapshotSurfacesSharedState(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
		cap: workspaceCapabilities{
			hasCheckpointEngine: true,
			checkpointCount:     3,
			hasMCP:              true,
			hasACP:              true,
		},
	}
	m.state.PermissionMode = model.PermModeBypass
	m.state.TotalCostUSD = 1.25

	content := m.localCommandContent(localTUICommandHarness)
	for _, want := range []string{
		"Harness state",
		"Checkpoints: 3 saved; engine detected",
		"MCP services: detected",
		"ACP bridge: detected",
		"Permissions: bypass",
		"Budget spend: $1.2500 this session",
		"/checkpoint save|list|load|delete",
		"/budget set <provider|global> <usd>",
		"/acp status",
		"read-only",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("harness state snapshot missing %q:\n%s", want, content)
		}
	}
}

func TestCommandRailAdvertisesHarnessState(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}

	rail := m.renderCommandRail()
	for _, want := range []string{
		"/checkpoint harness state",
		"/provider models",
		"/computer-use tools",
	} {
		if !strings.Contains(rail, want) {
			t.Fatalf("command rail missing %q:\n%s", want, rail)
		}
	}
}

func TestGoalSnapshotSurfacesCodexGoalWorkflow(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}
	m.state.BridgeConnected = true

	content := m.localCommandContent(localTUICommandGoal)
	for _, want := range []string{
		"Persisted goals",
		"Codex-style goal tracking",
		"/goal <description>",
		"/goal step add",
		"Bridge: connected",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("goal snapshot missing %q:\n%s", want, content)
		}
	}
}

func TestComputerUseSnapshotSurfacesToolCatalogWorkflow(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}
	m.state.BridgeConnected = true

	content := m.localCommandContent(localTUICommandComputer)
	for _, want := range []string{
		"Computer use",
		"Codex-style computer-use",
		"/computer-use tools",
		"newest-desktop-control",
		"computer_use_*",
		"Bridge: connected",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("computer-use snapshot missing %q:\n%s", want, content)
		}
	}
}

func TestConnectorSnapshotSurfacesTelegramWorkflow(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}
	m.state.BridgeConnected = true

	content := m.localCommandContent(localTUICommandConnect)
	for _, want := range []string{
		"Connectors",
		"Telegram",
		"/connect status",
		"/telegram status",
		"/channel status telegram",
		"Bridge: connected",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("connector snapshot missing %q:\n%s", want, content)
		}
	}
}

func TestProviderSnapshotUsesDuckHiveProviderSet(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
		cap: workspaceCapabilities{
			activeProvider:      "minimax",
			configuredProviders: []string{"minimax", "openrouter"},
		},
	}

	content := m.localCommandContent(localTUICommandProvider)
	for _, want := range []string{
		"Model providers",
		"MiniMax",
		"OpenRouter",
		"NVIDIA NIM",
		"Codex",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("provider snapshot missing %q:\n%s", want, content)
		}
	}
	if strings.Contains(content, "ChatGPT/OpenAI") {
		t.Fatalf("provider snapshot still advertises ChatGPT/OpenAI as the fallback preset:\n%s", content)
	}
}

func TestCheckpointCountPrefersDuckHiveConfigHome(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("HOME", tempDir)
	t.Setenv("USERPROFILE", tempDir)
	t.Setenv("CLAUDE_CONFIG_DIR", "")

	duckHiveCheckpoints := filepath.Join(tempDir, ".duckhive", "checkpoints")
	if err := os.MkdirAll(duckHiveCheckpoints, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(duckHiveCheckpoints, "active.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}

	legacyCheckpoints := filepath.Join(tempDir, ".config", "openclaude", "checkpoints")
	if err := os.MkdirAll(legacyCheckpoints, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyCheckpoints, "legacy.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}

	if got := checkpointCount(); got != 1 {
		t.Fatalf("checkpointCount() = %d, want DuckHive count 1", got)
	}
}

func TestCheckpointCountFallsBackToLegacyOpenClaudePath(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("HOME", tempDir)
	t.Setenv("USERPROFILE", tempDir)
	t.Setenv("CLAUDE_CONFIG_DIR", "")

	legacyCheckpoints := filepath.Join(tempDir, ".config", "openclaude", "checkpoints")
	if err := os.MkdirAll(legacyCheckpoints, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyCheckpoints, "legacy.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyCheckpoints, "notes.txt"), []byte("ignore"), 0o644); err != nil {
		t.Fatal(err)
	}

	if got := checkpointCount(); got != 1 {
		t.Fatalf("checkpointCount() = %d, want legacy fallback count 1", got)
	}
}

func TestRunsSnapshotSurfacesAgentRunLifecycle(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}
	m.state.ActiveTaskCount = 2
	m.state.BridgeConnected = true

	content := m.localCommandContent(localTUICommandRuns)
	for _, want := range []string{
		"AgentRun control plane",
		"queued -> preparing -> running",
		"Active task mirrors: 2",
		"Telegram can inspect/control runs",
		"verification handoff",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("runs snapshot missing %q:\n%s", want, content)
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

func TestBridgeDisconnectClearsLoadingThinkingAndTaskState(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		transcript: screens.NewTranscriptPanel(),
	}
	m.state.BridgeConnected = true
	m.state.IsLoading = true
	m.state.IsThinking = true
	m.state.DialogOpen = true
	m.state.PendingPermission = &model.PermissionRequest{ID: "perm-1", ToolName: "shell"}
	m.dialog = &components.DialogModel{}
	m.state.ActiveTaskIDs = map[string]struct{}{
		"task-1": {},
		"task-2": {},
	}
	m.state.ActiveTaskCount = 2

	m.handleBridgeMessage(model.MsgBridgeDisconnected{Err: context.Canceled})

	if m.state.BridgeConnected {
		t.Fatal("expected bridge to be marked disconnected")
	}
	if m.state.IsLoading {
		t.Fatal("expected loading to clear")
	}
	if m.state.IsThinking {
		t.Fatal("expected thinking to clear")
	}
	if m.state.DialogOpen {
		t.Fatal("expected dialog to close")
	}
	if m.state.PendingPermission != nil {
		t.Fatal("expected pending permission to clear")
	}
	if m.dialog != nil {
		t.Fatal("expected dialog model to clear")
	}
	if m.state.ActiveTaskCount != 0 {
		t.Fatalf("ActiveTaskCount = %d, want 0", m.state.ActiveTaskCount)
	}
	if len(m.state.ActiveTaskIDs) != 0 {
		t.Fatalf("ActiveTaskIDs = %d, want 0", len(m.state.ActiveTaskIDs))
	}
	if len(m.state.Messages) == 0 {
		t.Fatal("expected disconnect message")
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

func TestSuspendReturnsBubbleTeaSuspendCommand(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		transcript: screens.NewTranscriptPanel(),
	}

	_, cmd := m.handleOutbound(model.MsgSuspend{})
	if cmd == nil {
		t.Fatal("expected suspend command")
	}
	if _, ok := cmd().(tea.SuspendMsg); !ok {
		t.Fatalf("command did not return tea.SuspendMsg")
	}
	if !m.state.IsSuspended {
		t.Fatal("expected suspended state")
	}
	if m.state.StatusMsg != "suspending" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
}

func TestResumeMsgClearsSuspendedState(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}
	m.state.IsSuspended = true

	_, _ = m.Update(tea.ResumeMsg{})

	if m.state.IsSuspended {
		t.Fatal("expected suspended state to clear on resume")
	}
	if m.state.StatusMsg != "resumed" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
}

func TestComposerRefocusesBeforeTyping(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		keys:       tui.DefaultKeyMap(),
		transcript: screens.NewTranscriptPanel(),
	}
	m.state.ActiveScreen = model.ScreenREPL
	m.input.Blur()

	_, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'o', 'k'}})

	if got := m.input.Value(); got != "ok" {
		t.Fatalf("input value = %q", got)
	}
	if !m.input.Focused() {
		t.Fatal("expected composer to remain focused")
	}
}

func TestTeaProgramInputStreamTypesIntoComposer(t *testing.T) {
	r, w := io.Pipe()
	defer r.Close()
	defer w.Close()

	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		keys:       tui.DefaultKeyMap(),
		welcome:    screens.NewWelcomeModel(),
		transcript: screens.NewTranscriptPanel(),
		width:      80,
		height:     24,
	}
	m.settings = screens.NewSettingsScreen(&m.state)

	p := tea.NewProgram(
		m,
		tea.WithInput(r),
		tea.WithOutput(io.Discard),
		tea.WithoutRenderer(),
	)

	errs := make(chan error, 1)
	go func() {
		_, err := p.Run()
		errs <- err
	}()

	if _, err := w.Write([]byte("typed through tea input")); err != nil {
		t.Fatalf("write input: %v", err)
	}
	if _, err := w.Write([]byte{0x03}); err != nil {
		t.Fatalf("write ctrl-c: %v", err)
	}

	select {
	case err := <-errs:
		if err != nil {
			t.Fatalf("program returned error: %v", err)
		}
	case <-time.After(2 * time.Second):
		p.Kill()
		t.Fatal("program did not exit after ctrl-c")
	}

	if got := m.input.Value(); got != "typed through tea input" {
		t.Fatalf("input value = %q", got)
	}
}

func TestRunInputSmokeTypesThroughProgramPath(t *testing.T) {
	if err := runInputSmoke("typed through input smoke"); err != nil {
		t.Fatalf("runInputSmoke returned error: %v", err)
	}
}

func TestModelPickerUsesBackendWhenBridgeIsConfigured(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		bridge:     bridge.NewSubprocessAdapter("duckhive"),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		transcript: screens.NewTranscriptPanel(),
	}

	_, cmd := m.handleOutbound(model.MsgModelPicker{})
	if cmd == nil {
		t.Fatal("expected model picker command")
	}
	if msg := cmd(); msg != nil {
		t.Fatalf("expected nil bridge send result, got %#v", msg)
	}
	if m.state.ActiveScreen != model.ScreenREPL {
		t.Fatalf("ActiveScreen = %v", m.state.ActiveScreen)
	}
	if m.state.StatusMsg != "opening model picker" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
}

func TestModelPickerFallsBackToLocalPickerWithoutBridge(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		transcript: screens.NewTranscriptPanel(),
	}

	_, cmd := m.handleOutbound(model.MsgModelPicker{})
	if cmd != nil {
		t.Fatal("expected no backend command")
	}
	if m.state.ActiveScreen != model.ScreenModelPicker {
		t.Fatalf("ActiveScreen = %v", m.state.ActiveScreen)
	}
	if m.state.StatusMsg != "bridge unavailable; showing local model picker" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
}

func TestModelPickerViewShowsRoutingPresets(t *testing.T) {
	m := &MainModel{
		state:  model.NewAppState(),
		width:  100,
		height: 32,
	}
	m.cap.activeProvider = "minimax"
	m.cap.configuredProviders = []string{"minimax", "codex"}

	view := m.modelPickerView()
	for _, want := range []string{
		"Model Picker",
		"Provider: minimax",
		"Fast: local/Ollama or MiniMax",
		"Coding: Codex, Kimi, Gemini",
		"Reasoning: Codex plan",
		"Vision: Kimi/Gemini/OpenAI-compatible",
		"/provider opens the full provider manager",
	} {
		if !strings.Contains(view, want) {
			t.Fatalf("model picker missing %q:\n%s", want, view)
		}
	}
}

func TestModelPickerEscapeReturnsToRepl(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}
	m.state.ActiveScreen = model.ScreenModelPicker

	_, _ = m.Update(tea.KeyMsg{Type: tea.KeyEsc})

	if m.state.ActiveScreen != model.ScreenREPL {
		t.Fatalf("ActiveScreen = %v", m.state.ActiveScreen)
	}
	if m.state.StatusMsg != "model picker closed" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
}

func TestExternalEditorLoadsEditedContentBackIntoInput(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		transcript: screens.NewTranscriptPanel(),
	}

	tempDir := t.TempDir()
	editorPath := filepath.Join(tempDir, "draft.md")
	if err := os.WriteFile(editorPath, []byte("edited from external editor"), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	cleanupCalled := false
	m.editorPath = editorPath
	m.editorCleanup = func() error {
		cleanupCalled = true
		return os.Remove(editorPath)
	}

	m.handleExternalEditorFinished(externalEditorFinishedMsg{})

	if got := m.input.Value(); got != "edited from external editor" {
		t.Fatalf("input value = %q", got)
	}
	if m.state.StatusMsg != "external editor applied" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
	if !cleanupCalled {
		t.Fatal("expected cleanup to be called")
	}
	if _, err := os.Stat(editorPath); !os.IsNotExist(err) {
		t.Fatalf("expected temp file removed, stat err = %v", err)
	}
}

func TestExternalEditorFailureDoesNotOverwriteInput(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		transcript: screens.NewTranscriptPanel(),
	}
	m.input.SetValue("keep me")

	m.handleExternalEditorFinished(externalEditorFinishedMsg{err: exec.ErrNotFound})

	if got := m.input.Value(); got != "keep me" {
		t.Fatalf("input value = %q", got)
	}
	if !strings.Contains(m.state.StatusMsg, "external editor failed") {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
}

func TestUndoRestoresPreviousTypedInput(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		transcript: screens.NewTranscriptPanel(),
	}
	m.input.SetValue("hello")
	m.pushInputUndoSnapshot("")

	_, _ = m.handleOutbound(model.MsgUndo{})

	if got := m.input.Value(); got != "" {
		t.Fatalf("input value = %q", got)
	}
	if m.state.StatusMsg != "input restored" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
}

func TestUndoRestoresCanceledComposerInput(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		transcript: screens.NewTranscriptPanel(),
	}
	m.input.SetValue("draft command")

	_, _ = m.handleOutbound(model.MsgCancelInput{})
	if got := m.input.Value(); got != "" {
		t.Fatalf("input after cancel = %q", got)
	}

	_, _ = m.handleOutbound(model.MsgUndo{})
	if got := m.input.Value(); got != "draft command" {
		t.Fatalf("input after undo = %q", got)
	}
}

func TestUndoReportsEmptyStack(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		transcript: screens.NewTranscriptPanel(),
	}

	_, _ = m.handleOutbound(model.MsgUndo{})

	if m.state.StatusMsg != "nothing to undo" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
}

func TestRenderHeaderShowsElapsedSessionClock(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}
	m.width = 120
	m.state.WorkingDir = `C:\repo\duckhive`
	m.state.SessionStartedAt = time.Now().Add(-(65 * time.Second))

	header := m.renderHeader()
	if !strings.Contains(header, "01:05") {
		t.Fatalf("header missing elapsed clock:\n%s", header)
	}
}

func TestRenderEmptyStateUsesAsciiMarkers(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}

	rendered := m.renderEmptyState(100)
	if strings.Contains(rendered, "•") || strings.Contains(rendered, "·") {
		t.Fatalf("empty state contains non-ASCII markers:\n%s", rendered)
	}
	for _, want := range []string{
		"- Ask for a code change",
		"- Agent platform:",
		"- Provider:",
	} {
		if !strings.Contains(rendered, want) {
			t.Fatalf("empty state missing %q:\n%s", want, rendered)
		}
	}
}

func TestRenderFooterUsesAsciiStatusSeparators(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
		keys:  tui.DefaultKeyMap(),
		width: 120,
	}

	rendered := m.renderFooter()
	if strings.Contains(rendered, "•") || strings.Contains(rendered, "·") {
		t.Fatalf("footer contains non-ASCII markers:\n%s", rendered)
	}
	if !strings.Contains(rendered, "ready | /help deck | /goal status") {
		t.Fatalf("footer missing ASCII status rail:\n%s", rendered)
	}
}

func TestRenderSessionCardShowsElapsedAndAPITime(t *testing.T) {
	m := &MainModel{
		state: model.NewAppState(),
	}
	m.state.WorkingDir = `C:\repo\duckhive`
	m.state.SessionStartedAt = time.Now().Add(-(2*time.Minute + 3*time.Second))
	m.state.TotalAPIDuration = 1500 * time.Millisecond

	card := m.renderSessionCard(36)
	for _, want := range []string{
		"elapsed    02:03",
		"api time   1.5s",
	} {
		if !strings.Contains(card, want) {
			t.Fatalf("session card missing %q:\n%s", want, card)
		}
	}
}

func TestHandleBridgeMessageTracksAPIDurationFromBridge(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		transcript: screens.NewTranscriptPanel(),
	}

	m.handleBridgeMessage(model.MsgAPIDurationReceived{Duration: 2250 * time.Millisecond})

	if m.state.TotalAPIDuration != 2250*time.Millisecond {
		t.Fatalf("TotalAPIDuration = %s, want %s", m.state.TotalAPIDuration, 2250*time.Millisecond)
	}
}

func TestLocalShellCommandUsesPlatformAppropriateFallback(t *testing.T) {
	shell, args := localShellCommand("echo hi")
	if len(args) == 0 {
		t.Fatalf("args should not be empty")
	}
	if runtime.GOOS == "windows" {
		if shell == "/bin/zsh" {
			t.Fatalf("windows shell fallback should not use unix zsh")
		}
		last := args[len(args)-1]
		if last != "echo hi" {
			t.Fatalf("last arg = %q, want command payload", last)
		}
		return
	}
	if args[0] != "-lc" {
		t.Fatalf("args[0] = %q, want -lc", args[0])
	}
}

func TestShellArgsForExecutableUsesPlatformSpecificFlags(t *testing.T) {
	tests := []struct {
		name      string
		shellPath string
		wantArgs  []string
	}{
		{
			name:      "pwsh uses powershell flags",
			shellPath: `C:\Program Files\PowerShell\7\pwsh.exe`,
			wantArgs:  []string{"-NoLogo", "-NoProfile", "-Command", "echo hi"},
		},
		{
			name:      "powershell uses powershell flags",
			shellPath: `powershell.exe`,
			wantArgs:  []string{"-NoLogo", "-NoProfile", "-Command", "echo hi"},
		},
		{
			name:      "cmd uses cmd flags",
			shellPath: `C:\Windows\System32\cmd.exe`,
			wantArgs:  []string{"/d", "/s", "/c", "echo hi"},
		},
		{
			name:      "unix shell uses lc",
			shellPath: `/bin/zsh`,
			wantArgs:  []string{"-lc", "echo hi"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			args := shellArgsForExecutable(tt.shellPath, "echo hi")
			if strings.Join(args, "\x00") != strings.Join(tt.wantArgs, "\x00") {
				t.Fatalf("args = %#v, want %#v", args, tt.wantArgs)
			}
		})
	}
}

func TestResolveExternalEditorCommandUsesQuotedVisual(t *testing.T) {
	t.Setenv("VISUAL", `"C:\Program Files\Neovim\bin\nvim.exe" --wait`)

	name, args, err := resolveExternalEditorCommand("windows")
	if err != nil {
		t.Fatalf("resolveExternalEditorCommand: %v", err)
	}
	if name != `C:\Program Files\Neovim\bin\nvim.exe` {
		t.Fatalf("name = %q", name)
	}
	wantArgs := []string{"--wait"}
	if strings.Join(args, "\x00") != strings.Join(wantArgs, "\x00") {
		t.Fatalf("args = %#v, want %#v", args, wantArgs)
	}
}

func TestSplitCommandLineRejectsUnterminatedQuotes(t *testing.T) {
	if _, err := splitCommandLine(`"C:\Program Files\Neovim\bin\nvim.exe`); err == nil {
		t.Fatal("expected unterminated quote error")
	}
}

func TestLocalShellCommandForOSRespectsWindowsShellEnv(t *testing.T) {
	t.Setenv("SHELL", `C:\Program Files\PowerShell\7\pwsh.exe`)

	shell, args := localShellCommandForOS("windows", "echo hi")
	if shell != `C:\Program Files\PowerShell\7\pwsh.exe` {
		t.Fatalf("shell = %q", shell)
	}
	wantArgs := []string{"-NoLogo", "-NoProfile", "-Command", "echo hi"}
	if strings.Join(args, "\x00") != strings.Join(wantArgs, "\x00") {
		t.Fatalf("args = %#v, want %#v", args, wantArgs)
	}
}

func TestHandleShellResultTreatsCancellationAsInterrupt(t *testing.T) {
	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		transcript: screens.NewTranscriptPanel(),
	}

	m.handleShellResult(shellCommandResultMsg{
		command:  "sleep 5",
		err:      context.Canceled,
		duration: 1500 * time.Millisecond,
		canceled: true,
	})

	if m.state.StatusMsg != "shell interrupted after 1.5s" {
		t.Fatalf("StatusMsg = %q", m.state.StatusMsg)
	}
	if len(m.state.Messages) == 0 {
		t.Fatal("expected a tool result message")
	}
	last := m.state.Messages[len(m.state.Messages)-1]
	if last.IsError {
		t.Fatal("canceled shell result should not be marked as error")
	}
	if last.Content != "(interrupted)" {
		t.Fatalf("Content = %q", last.Content)
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
