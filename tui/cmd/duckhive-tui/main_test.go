package main

import (
	"context"
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
		{name: "runs opens agent run surface", input: "/runs", wantCommand: localTUICommandRuns, wantHandled: true},
		{name: "tasks opens agent run surface", input: "/tasks", wantCommand: localTUICommandRuns, wantHandled: true},
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
		"AgentRun",
		"AI Council",
		"Search providers",
		"/search-provider",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("local command content missing %q:\n%s", want, content)
		}
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
