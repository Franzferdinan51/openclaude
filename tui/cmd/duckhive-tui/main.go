package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/gitlawb/duckhive/tui/model"
	"github.com/gitlawb/duckhive/tui/model/bridge"
	"github.com/gitlawb/duckhive/tui/model/components"
	"github.com/gitlawb/duckhive/tui/model/screens"
	"github.com/gitlawb/duckhive/tui/tui"
)

const (
	minRailWidth     = 34
	maxRailWidth     = 42
	railBreakpoint   = 118
	shellOutputLimit = 12000
)

type workspaceCapabilities struct {
	hasAGENTS           bool
	hasGEMINI           bool
	hasCLAUDE           bool
	hasCheckpointEngine bool
	checkpointCount     int
	hasACP              bool
	hasMCP              bool
	hasCouncil          bool
	hasTeams            bool
	hasVoice            bool
	hasMedia            bool
	hasMercury          bool
	activeProvider      string
	configuredProviders []string
	searchProvider      string
	configuredSearch    []string
}

type featurePillar struct {
	Source  string
	Status  string
	Summary string
}

type shellCommandResultMsg struct {
	command  string
	output   string
	err      error
	duration time.Duration
	canceled bool
}

type externalEditorFinishedMsg struct {
	err error
}

type timerTickMsg struct{}

// MainModel is the root tea.Model coordinating the DuckHive shell.
type MainModel struct {
	state         model.AppState
	bridge        *bridge.Adapter
	msgList       components.MessageListModel
	input         components.InputAreaModel
	dialog        *components.DialogModel
	transcript    *screens.TranscriptPanel
	welcome       screens.WelcomeModel
	settings      *screens.SettingsScreen
	keys          tui.KeyMap
	width         int
	height        int
	showInspector bool
	cap           workspaceCapabilities
	shellCancel   context.CancelFunc
	shellRunning  bool
	editorPath    string
	editorCleanup func() error
	inputUndo     []string
	handoff       *uiHandoff
}

type uiSurface string

const (
	uiSurfaceTUI    uiSurface = "tui"
	uiSurfaceLegacy uiSurface = "legacy"
)

type uiHandoff struct {
	target uiSurface
}

type localTUICommand string

const (
	localTUICommandDeck       localTUICommand = "deck"
	localTUICommandStatus     localTUICommand = "status"
	localTUICommandSuperAgent localTUICommand = "super-agent"
	localTUICommandRuns       localTUICommand = "runs"
	localTUICommandGoal       localTUICommand = "goal"
	localTUICommandCouncil    localTUICommand = "council"
	localTUICommandProvider   localTUICommand = "provider"
	localTUICommandSearch     localTUICommand = "search"
	localTUICommandComputer   localTUICommand = "computer-use"
	localTUICommandConnect    localTUICommand = "connect"
	localTUICommandHarness    localTUICommand = "harness"
	localTUICommandExit       localTUICommand = "exit"
)

func main() {
	if isSnapshotRequest(os.Args[1:]) {
		runSnapshot()
		return
	}
	if text, ok := inputSmokeRequest(os.Args[1:]); ok {
		if err := runInputSmoke(text); err != nil {
			fmt.Fprintf(os.Stderr, "TUI input smoke failed: %v\n", err)
			os.Exit(1)
		}
		return
	}

	var adapter *bridge.Adapter
	if socketPath := os.Getenv("DUCKHIVE_BRIDGE_SOCKET"); socketPath != "" {
		adapter = bridge.NewAdapter(socketPath)
	} else if bridgeCmd := os.Getenv("DUCKHIVE_BRIDGE_CMD"); bridgeCmd != "" {
		adapter = bridge.NewSubprocessAdapter(bridgeCmd, strings.Fields(os.Getenv("DUCKHIVE_BRIDGE_ARGS"))...)
	} else {
		fmt.Println("warning: no DUCKHIVE_BRIDGE_SOCKET or DUCKHIVE_BRIDGE_CMD set")
	}

	m := &MainModel{
		state:         model.NewAppState(),
		bridge:        adapter,
		msgList:       components.NewMessageList(80, 20),
		input:         components.NewInputArea(80, 3),
		keys:          loadTUIKeyMap(),
		welcome:       screens.NewWelcomeModel(),
		transcript:    screens.NewTranscriptPanel(),
		showInspector: false,
	}
	m.settings = screens.NewSettingsScreen(&m.state)
	m.updateComposer()

	p := tea.NewProgram(
		m,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if err := p.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "TUI error: %v\n", err)
		os.Exit(1)
	}

	if m.handoff != nil {
		exitCode, err := m.handoff.Execute()
		if err != nil {
			fmt.Fprintf(os.Stderr, "UI handoff error: %v\n", err)
			os.Exit(1)
		}
		os.Exit(exitCode)
	}
}

func isSnapshotRequest(args []string) bool {
	for _, arg := range args {
		switch arg {
		case "--snapshot", "snapshot":
			return true
		}
	}
	return false
}

func inputSmokeRequest(args []string) (string, bool) {
	for i, arg := range args {
		switch arg {
		case "--input-smoke":
			if i+1 < len(args) && strings.TrimSpace(args[i+1]) != "" {
				return args[i+1], true
			}
			return "typed through duckhive tui", true
		case "input-smoke":
			if i+1 < len(args) && strings.TrimSpace(args[i+1]) != "" {
				return args[i+1], true
			}
			return "typed through duckhive tui", true
		}
	}
	return "", false
}

func runInputSmoke(text string) error {
	r, w := io.Pipe()
	defer r.Close()
	defer w.Close()

	m := &MainModel{
		state:      model.NewAppState(),
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		keys:       loadTUIKeyMap(),
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

	if _, err := w.Write([]byte(text)); err != nil {
		p.Kill()
		return err
	}
	if _, err := w.Write([]byte{0x03}); err != nil {
		p.Kill()
		return err
	}

	select {
	case err := <-errs:
		if err != nil {
			return err
		}
	case <-time.After(2 * time.Second):
		p.Kill()
		return errors.New("program did not exit after ctrl-c")
	}

	if got := m.input.Value(); got != text {
		return fmt.Errorf("composer value = %q, want %q", got, text)
	}

	fmt.Printf("DuckHive TUI input smoke passed: %q\n", text)
	return nil
}

func runSnapshot() {
	m := &MainModel{
		state:         model.NewAppState(),
		msgList:       components.NewMessageList(100, 28),
		input:         components.NewInputArea(100, 3),
		keys:          loadTUIKeyMap(),
		welcome:       screens.NewWelcomeModel(),
		transcript:    screens.NewTranscriptPanel(),
		showInspector: false,
		width:         100,
		height:        32,
	}
	m.settings = screens.NewSettingsScreen(&m.state)
	_ = m.Init()
	fmt.Print(m.View())
}

func loadTUIKeyMap() tui.KeyMap {
	keys, errs := tui.LoadKeyMapFromEnv()
	for _, err := range errs {
		fmt.Fprintf(os.Stderr, "warning: TUI keymap: %v\n", err)
	}
	return keys
}

// Init implements tea.Model.
func (m *MainModel) Init() tea.Cmd {
	wd, _ := os.Getwd()
	m.state.WorkingDir = wd
	m.state.ProjectRoot = wd
	m.state.ActiveScreen = model.ScreenREPL
	m.cap = detectWorkspaceCapabilities(wd)
	m.updateComposer()

	if m.width == 0 || m.height == 0 {
		m.width, m.height = 120, 40
	}
	m.msgList = components.NewMessageList(m.width, m.height-6)
	m.input = components.NewInputArea(m.width, 3)

	cmds := []tea.Cmd{
		startTimerCmd(),
		m.msgList.Init(),
		m.input.Init(),
		m.welcome.Init(),
		m.transcript.Init(),
		m.settings.Init(),
		func() tea.Msg { return tea.WindowSizeMsg{Width: m.width, Height: m.height} },
	}

	if m.bridge != nil {
		cmds = append(cmds, m.bridge.Start(), m.waitForBridgeMsg())
	}

	return tea.Batch(cmds...)
}

// Update implements tea.Model.
func (m *MainModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		_, _ = m.welcome.Update(msg)
		_, _ = m.settings.Update(msg)
		m.resizeLayout()
		return m, nil

	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			_, cmd := m.handleOutbound(model.MsgInterrupt{})
			return m, cmd
		}

		switch m.state.ActiveScreen {
		case model.ScreenWelcome:
			_, cmd := m.welcome.Update(msg)
			return m, cmd
		case model.ScreenSettings:
			_, cmd := m.settings.Update(msg)
			return m, cmd
		case model.ScreenModelPicker:
			switch msg.String() {
			case "escape", "esc", "ctrl+d":
				m.state.ActiveScreen = model.ScreenREPL
				m.state.StatusMsg = "model picker closed"
				return m, nil
			}
			return m, nil
		}

		if m.dialog != nil {
			updated, cmd := m.dialog.Update(msg)
			if cmd != nil {
				m.dialog = updated.(*components.DialogModel)
				return m, cmd
			}
		}

		if out, consumed := tui.HandleKey(msg, m.keys, m.currentContext()); consumed {
			_, cmd := m.handleOutbound(out)
			return m, cmd
		}

		previousInput := m.input.Value()
		m.input.Focus()
		_, cmd := m.input.Update(msg)
		m.recordInputUndoIfChanged(previousInput)
		return m, cmd

	case model.InMsg:
		_, cmd := m.handleBridgeMessage(msg)
		if m.bridge != nil {
			cmd = tea.Batch(cmd, m.waitForBridgeMsg())
		}
		return m, cmd

	case model.OutMsg:
		_, cmd := m.handleOutbound(msg)
		return m, cmd

	case shellCommandResultMsg:
		m.handleShellResult(msg)
		return m, nil

	case externalEditorFinishedMsg:
		m.handleExternalEditorFinished(msg)
		return m, nil

	case timerTickMsg:
		return m, startTimerCmd()

	case tea.ResumeMsg:
		m.state.IsSuspended = false
		m.state.StatusMsg = "resumed"
		return m, nil

	default:
		return m, nil
	}
}

// View implements tea.Model.
func (m *MainModel) View() string {
	if m.width == 0 || m.height == 0 {
		return "starting DuckHive..."
	}

	switch m.state.ActiveScreen {
	case model.ScreenWelcome:
		return m.welcome.View()
	case model.ScreenSettings:
		return m.settings.View()
	case model.ScreenModelPicker:
		return m.modelPickerView()
	default:
		return m.replView()
	}
}

func (m *MainModel) replView() string {
	mainWidth := m.mainPaneWidth()
	railWidth := 0
	if m.showRail() {
		railWidth = m.railWidth()
	}

	conversation := m.renderConversationPane(mainWidth)
	composer := m.renderComposerPane(mainWidth)
	body := lipgloss.JoinVertical(lipgloss.Left, conversation, composer)

	if railWidth > 0 {
		body = lipgloss.JoinHorizontal(lipgloss.Top, body, m.renderRail(railWidth))
	}

	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.renderHeader(),
		body,
		m.renderFooter(),
	) + m.renderPermissionOverlay()
}

func (m *MainModel) renderConversationPane(width int) string {
	var content string
	if len(m.state.Messages) == 0 {
		content = m.renderEmptyState(width)
	} else {
		content = m.msgList.View()
	}

	return tui.MainPane.Width(width).Render(content)
}

func (m *MainModel) renderComposerPane(width int) string {
	metaParts := []string{
		tui.CardMuted.Render("mode " + m.state.InputMode.String()),
	}
	if m.state.IsFastMode {
		metaParts = append(metaParts, tui.CardMuted.Render("fast"))
	}
	if m.state.IsThinking {
		metaParts = append(metaParts, tui.CardMuted.Render("thinking"))
	}
	if m.state.BridgeConnected {
		metaParts = append(metaParts, tui.CardMuted.Render("bridge"))
	} else {
		metaParts = append(metaParts, tui.CardMuted.Render("local"))
	}

	label := strings.Join(metaParts, "  ")
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		label,
		tui.ComposerFrame.Width(width).Render(m.input.View()),
	)

	return lipgloss.NewStyle().Width(width).Render(content)
}

func (m *MainModel) renderEmptyState(width int) string {
	cardWidth := maxInt(48, width-10)
	innerWidth := maxInt(40, cardWidth-8)
	quickStart := []string{
		"Ask for a code change, bug fix, repo review, or plan.",
		"/help opens this deck. /runs explains AgentRun control.",
		"/repl returns to the classic REPL without changing your default.",
	}
	superAgent := []string{
		"Agent platform: runs + teams + council + subagents.",
		"/orchestrate <task> --dry-run previews routing.",
		"/agents and /council open the live backend surfaces when the bridge is connected.",
	}
	system := []string{
		fmt.Sprintf("Provider: %s / %s", m.displayProvider(), truncate(m.displayModel(), 28)),
		fmt.Sprintf("Search: %s", m.displaySearchProvider()),
		fmt.Sprintf("Bridge: %s", boolLabel(m.state.BridgeConnected, "connected", "local safe mode")),
	}

	main := tui.EmptyCard.Width(cardWidth).Render(
		lipgloss.JoinVertical(
			lipgloss.Left,
			tui.HeroTitle.Render("DuckHive Super Agent"),
			tui.EmptyBody.Render("A quiet operator shell for coding, local tools, AgentRuns, council review, search, media, MCP, and provider routing."),
			"",
			m.renderMiniDeck(innerWidth, "Start", quickStart),
			"",
			m.renderMiniDeck(innerWidth, "Operate", superAgent),
			"",
			m.renderMiniDeck(innerWidth, "Session", system),
		),
	)

	return lipgloss.Place(
		width,
		maxInt(10, m.msgListHeight()),
		lipgloss.Center,
		lipgloss.Center,
		main,
	)
}

func (m *MainModel) renderMiniDeck(width int, title string, lines []string) string {
	rendered := []string{tui.SectionTitle.Render(title)}
	for _, line := range lines {
		rendered = append(rendered, tui.EmptyItem.Width(width).Render("- "+line))
	}
	return lipgloss.JoinVertical(lipgloss.Left, rendered...)
}

func (m *MainModel) handleBridgeMessage(msg model.InMsg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case model.MsgBridgeConnected:
		m.state.BridgeConnected = true
		m.state.StatusMsg = "bridge connected"

	case model.MsgBridgeDisconnected:
		m.state.BridgeConnected = false
		m.state.IsLoading = false
		m.state.IsThinking = false
		m.state.DialogOpen = false
		m.state.PendingPermission = nil
		m.dialog = nil
		m.clearTasks()
		if msg.Err != nil {
			m.appendMessage(model.Message{
				ID:        messageID("bridge"),
				Type:      model.MsgTypeSystem,
				Content:   "Bridge disconnected: " + msg.Err.Error(),
				IsError:   true,
				Timestamp: time.Now(),
			})
			m.state.StatusMsg = msg.Err.Error()
		}

	case model.MsgMessageReceived:
		m.state.IsLoading = false
		m.state.IsThinking = false
		m.appendMessage(msg.Message)

	case model.MsgStreamDelta:
		m.state.IsLoading = true
		m.msgList.StreamUpdate(msg.MessageID, msg.Delta)

	case model.MsgStreamEnd:
		m.state.IsLoading = false
		m.msgList.Finalize(msg.MessageID)

	case model.MsgThinkingStarted:
		m.state.IsThinking = true
		m.state.IsLoading = true
		m.state.StatusMsg = "thinking"

	case model.MsgThinkingEnded:
		m.state.IsThinking = false
		if !m.shellRunning {
			m.state.IsLoading = false
		}

	case model.MsgPermissionRequest:
		m.state.PendingPermission = &msg.Request
		m.state.DialogOpen = true
		m.state.StatusMsg = "permission required"

	case model.MsgStatusUpdate:
		if strings.TrimSpace(msg.Message) != "" {
			m.state.StatusMsg = msg.Message
		}

	case model.MsgModelChanged:
		if strings.TrimSpace(msg.Model) != "" {
			m.state.Model = msg.Model
		}

	case model.MsgCostReceived:
		m.state.TotalCostUSD += msg.Cost

	case model.MsgTokensReceived:
		m.state.TokenUsage = msg.Usage

	case model.MsgAPIDurationReceived:
		if msg.Duration >= 0 {
			m.state.TotalAPIDuration = msg.Duration
		}

	case model.MsgTaskStarted:
		m.startTask(msg.ID)

	case model.MsgTaskEnded:
		m.endTask(msg.ID)

	case model.MsgTasksCleared:
		m.clearTasks()

	case model.MsgError:
		m.state.IsLoading = false
		if msg.Err != nil {
			m.appendMessage(model.Message{
				ID:        messageID("error"),
				Type:      model.MsgTypeSystem,
				Content:   msg.Err.Error(),
				IsError:   true,
				Timestamp: time.Now(),
			})
			m.state.StatusMsg = msg.Err.Error()
		}
	}

	m.syncTranscript()
	return m, nil
}

func (m *MainModel) startTask(id string) {
	id = strings.TrimSpace(id)
	if id == "" {
		m.state.ActiveTaskCount++
		return
	}
	if m.state.ActiveTaskIDs == nil {
		m.state.ActiveTaskIDs = map[string]struct{}{}
	}
	if _, exists := m.state.ActiveTaskIDs[id]; exists {
		return
	}
	m.state.ActiveTaskIDs[id] = struct{}{}
	m.state.ActiveTaskCount = len(m.state.ActiveTaskIDs)
}

func (m *MainModel) endTask(id string) {
	id = strings.TrimSpace(id)
	if id != "" && len(m.state.ActiveTaskIDs) > 0 {
		if _, exists := m.state.ActiveTaskIDs[id]; exists {
			delete(m.state.ActiveTaskIDs, id)
			m.state.ActiveTaskCount = len(m.state.ActiveTaskIDs)
			return
		}
	}
	if id == "" || len(m.state.ActiveTaskIDs) == 0 {
		if m.state.ActiveTaskCount > 0 {
			m.state.ActiveTaskCount--
		}
	}
}

func (m *MainModel) clearTasks() {
	m.state.ActiveTaskCount = 0
	if m.state.ActiveTaskIDs == nil {
		m.state.ActiveTaskIDs = map[string]struct{}{}
		return
	}
	for id := range m.state.ActiveTaskIDs {
		delete(m.state.ActiveTaskIDs, id)
	}
}

func (m *MainModel) handleOutbound(msg model.OutMsg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case model.MsgInputSubmitted:
		return m, m.submitInput()

	case model.MsgHistoryUp:
		m.pushInputUndoSnapshot(m.input.Value())
		m.input.HistoryPrev()

	case model.MsgHistoryDown:
		m.pushInputUndoSnapshot(m.input.Value())
		m.input.HistoryNext()

	case model.MsgInterrupt:
		if m.shellRunning && m.shellCancel != nil {
			m.state.StatusMsg = "interrupting shell command"
			m.shellCancel()
			return m, nil
		}
		if m.bridge != nil && m.hasActiveBackendWork() {
			m.state.StatusMsg = "interrupt sent"
			return m, bridge.SendInterruptCmd(m.bridge)
		}
		m.state.StatusMsg = "exiting"
		return m, m.quitCmd()

	case model.MsgExit:
		return m, m.quitCmd()

	case model.MsgRedraw:
		m.resizeLayout()

	case model.MsgToggleTranscript:
		m.setTranscriptVisible(!m.transcript.IsVisible())
		m.resizeLayout()

	case model.MsgToggleTodos:
		m.showInspector = !m.showInspector
		m.resizeLayout()

	case model.MsgToggleFastMode:
		m.state.IsFastMode = !m.state.IsFastMode

	case model.MsgToggleShellMode:
		if m.state.InputMode == model.InputModeShell {
			m.state.InputMode = model.InputModeAgent
		} else {
			m.state.InputMode = model.InputModeShell
		}
		m.updateComposer()

	case model.MsgCycleMode:
		m.state.InputMode = m.state.InputMode.Next()
		m.updateComposer()

	case model.MsgPageUp:
		m.msgList.ScrollUp(maxInt(4, m.msgListHeight()/2))

	case model.MsgPageDown:
		m.msgList.ScrollDown(maxInt(4, m.msgListHeight()/2))

	case model.MsgCancelInput:
		m.pushInputUndoSnapshot(m.input.Value())
		m.input.Reset()

	case model.MsgConfirmYes, model.MsgConfirmNo:
		var cmd tea.Cmd
		if m.bridge != nil && m.state.PendingPermission != nil {
			approved := true
			if _, ok := msg.(model.MsgConfirmNo); ok {
				approved = false
			}
			cmd = bridge.SendPermissionResponseCmd(m.bridge, *m.state.PendingPermission, approved)
			if approved {
				m.state.StatusMsg = "permission granted"
			} else {
				m.state.StatusMsg = "permission denied"
			}
		}
		m.dialog = nil
		m.state.DialogOpen = false
		m.state.PendingPermission = nil
		return m, cmd

	case model.MsgPopDialog:
		m.dialog = nil
		m.state.DialogOpen = false
		m.state.PendingPermission = nil

	case model.MsgNavigate:
		m.state.ActiveScreen = msg.Screen
		if msg.Screen != model.ScreenREPL {
			m.state.StatusMsg = ""
		}
		// Clear any pending permission when navigating away
		m.state.DialogOpen = false
		m.state.PendingPermission = nil

	case model.MsgPushDialog:
		m.state.DialogOpen = true

	case model.MsgSelectMessage:
		if msg.ID != "" {
			m.msgList.SetSelected(msg.ID)
		}

	case model.MsgModelPicker:
		if m.bridge != nil {
			m.state.StatusMsg = "opening model picker"
			return m, bridge.SendUserMessageCmd(m.bridge, "/model")
		}
		m.state.ActiveScreen = model.ScreenModelPicker
		m.state.StatusMsg = "bridge unavailable; showing local model picker"

	case model.MsgSuspend:
		m.state.IsSuspended = true
		m.state.StatusMsg = "suspending"
		return m, tea.Suspend

	case model.MsgExternalEditor:
		return m, m.openExternalEditor()

	case model.MsgUndo:
		if m.applyInputUndo() {
			m.state.StatusMsg = "input restored"
		} else {
			m.state.StatusMsg = "nothing to undo"
		}
	}

	return m, nil
}

func (m *MainModel) hasActiveBackendWork() bool {
	return m.state.IsLoading || m.state.IsThinking || m.state.ActiveTaskCount > 0
}

func (m *MainModel) quitCmd() tea.Cmd {
	return func() tea.Msg {
		if m.bridge != nil {
			_ = m.bridge.Close()
		}
		if m.shellCancel != nil {
			m.shellCancel()
		}
		return tea.Quit()
	}
}

func (m *MainModel) submitInput() tea.Cmd {
	text := strings.TrimSpace(m.input.Value())
	if text == "" {
		return nil
	}

	displayText := text
	payload := text

	switch m.state.InputMode {
	case model.InputModeCouncil:
		displayText = "[council] " + text
		payload = "Use multi-model deliberation when helpful.\n\n" + text
	case model.InputModeMedia:
		displayText = "[media] " + text
		payload = "Treat this as a multimodal or media-oriented request when relevant.\n\n" + text
	case model.InputModeShell:
		displayText = "$ " + text
	}

	m.appendMessage(model.Message{
		ID:        messageID("user"),
		Type:      model.MsgTypeUser,
		Content:   displayText,
		Timestamp: time.Now(),
	})

	m.state.InputHistory = append(m.state.InputHistory, text)
	m.input.SetHistory(m.state.InputHistory)
	m.input.Reset()

	if m.state.InputMode == model.InputModeShell {
		return m.runShellCommand(text)
	}

	if handled, cmd := m.handleUISwitchCommand(text); handled {
		return cmd
	}

	if handled, cmd := m.handleLocalTUICommand(text); handled {
		return cmd
	}

	if m.bridge == nil {
		m.appendMessage(model.Message{
			ID:        messageID("system"),
			Type:      model.MsgTypeSystem,
			Content:   "No backend bridge is configured. Set DUCKHIVE_BRIDGE_SOCKET or DUCKHIVE_BRIDGE_CMD.",
			IsError:   true,
			Timestamp: time.Now(),
		})
		return nil
	}

	m.state.IsLoading = true
	m.state.StatusMsg = "dispatching request"
	return bridge.SendUserMessageCmd(m.bridge, payload)
}

func (m *MainModel) handleUISwitchCommand(text string) (bool, tea.Cmd) {
	target, handled, err := parseUISwitchCommand(text)
	if !handled {
		return false, nil
	}

	if err != nil {
		m.appendMessage(model.Message{
			ID:        messageID("system"),
			Type:      model.MsgTypeSystem,
			Content:   err.Error(),
			IsError:   true,
			Timestamp: time.Now(),
		})
		m.state.StatusMsg = err.Error()
		return true, nil
	}

	if target == uiSurfaceTUI {
		if err := setDuckHiveUISurfacePreference(target); err != nil {
			msg := fmt.Sprintf("Failed to save default UI: %v", err)
			m.appendMessage(model.Message{
				ID:        messageID("system"),
				Type:      model.MsgTypeSystem,
				Content:   msg,
				IsError:   true,
				Timestamp: time.Now(),
			})
			m.state.StatusMsg = msg
			return true, nil
		}

		msg := "Default UI set to Go TUI. Already using it in this session. Use /repl or /tui legacy to switch back."
		m.appendMessage(model.Message{
			ID:        messageID("system"),
			Type:      model.MsgTypeSystem,
			Content:   msg,
			Timestamp: time.Now(),
		})
		m.state.StatusMsg = msg
		return true, nil
	}

	m.handoff = &uiHandoff{target: target}
	m.state.StatusMsg = "switching to classic REPL"
	return true, tea.Quit
}

func parseUISwitchCommand(text string) (uiSurface, bool, error) {
	fields := strings.Fields(strings.TrimSpace(text))
	if len(fields) == 0 {
		return "", false, nil
	}

	switch strings.ToLower(fields[0]) {
	case "/repl":
		if len(fields) > 1 {
			return "", true, fmt.Errorf("Usage: /repl")
		}
		return uiSurfaceLegacy, true, nil
	case "/tui", "/ui":
		if len(fields) == 1 {
			return uiSurfaceTUI, true, nil
		}

		switch strings.ToLower(fields[1]) {
		case "tui", "go", "bubbletea":
			return uiSurfaceTUI, true, nil
		case "legacy", "repl", "classic", "ink":
			return uiSurfaceLegacy, true, nil
		default:
			return "", true, fmt.Errorf("Usage: /tui [tui|legacy]")
		}
	default:
		return "", false, nil
	}
}

func parseLocalTUICommand(text string) (localTUICommand, bool) {
	fields := strings.Fields(strings.TrimSpace(text))
	if len(fields) == 0 {
		return "", false
	}

	command := strings.ToLower(fields[0])
	hasArgs := len(fields) > 1
	switch command {
	case "/help", "/?", "/deck":
		return localTUICommandDeck, true
	case "/status":
		return localTUICommandStatus, true
	case "/agent", "/teams", "/super", "/super-agent":
		if hasArgs {
			return "", false
		}
		return localTUICommandSuperAgent, true
	case "/runs", "/run", "/tasks", "/agent-runs":
		if hasArgs {
			return "", false
		}
		return localTUICommandRuns, true
	case "/goal", "/goals":
		if hasArgs {
			return "", false
		}
		return localTUICommandGoal, true
	case "/council":
		if hasArgs {
			return "", false
		}
		return localTUICommandCouncil, true
	case "/provider", "/providers", "/model", "/models":
		if hasArgs {
			return "", false
		}
		return localTUICommandProvider, true
	case "/search-provider", "/search-providers", "/search", "/web":
		if hasArgs {
			return "", false
		}
		return localTUICommandSearch, true
	case "/computer-use", "/cu":
		if hasArgs {
			return "", false
		}
		return localTUICommandComputer, true
	case "/connect", "/telegram", "/channel":
		if hasArgs {
			return "", false
		}
		return localTUICommandConnect, true
	case "/checkpoint", "/checkpoints", "/budget", "/mcp", "/dmcp", "/acp", "/permission", "/permissions":
		if hasArgs {
			return "", false
		}
		return localTUICommandHarness, true
	case "/exit", "/quit":
		if hasArgs {
			return "", false
		}
		return localTUICommandExit, true
	default:
		return "", false
	}
}

func (m *MainModel) handleLocalTUICommand(text string) (bool, tea.Cmd) {
	if cmdText, ok := bridgeBackedLocalCommand(text); ok {
		if m.bridge != nil && m.state.BridgeConnected {
			m.state.StatusMsg = bridgeBackedLocalCommandStatus(cmdText)
			return true, bridge.SendUserMessageCmd(m.bridge, cmdText)
		}

		if fallbackCommand, ok := bridgeBackedLocalFallback(cmdText); ok {
			content := m.localCommandContent(fallbackCommand)
			m.appendMessage(model.Message{
				ID:        messageID("system"),
				Type:      model.MsgTypeSystem,
				Content:   content,
				Timestamp: time.Now(),
			})
			m.state.StatusMsg = bridgeBackedLocalFallbackStatus(cmdText)
			return true, nil
		}

		m.appendMessage(model.Message{
			ID:        messageID("system"),
			Type:      model.MsgTypeSystem,
			Content:   "Bridge unavailable. `/doctor` needs the backend diagnostic UI. Use `/status` for the local snapshot or `/repl` for the classic REPL.",
			IsError:   true,
			Timestamp: time.Now(),
		})
		m.state.StatusMsg = "bridge unavailable; /doctor needs backend UI"
		return true, nil
	}

	command, handled := parseLocalTUICommand(text)
	if !handled {
		return false, nil
	}

	if command == localTUICommandExit {
		m.state.StatusMsg = "exiting"
		return true, m.quitCmd()
	}

	content := m.localCommandContent(command)
	m.appendMessage(model.Message{
		ID:        messageID("system"),
		Type:      model.MsgTypeSystem,
		Content:   content,
		Timestamp: time.Now(),
	})
	m.state.StatusMsg = localCommandStatus(command)
	return true, nil
}

func bridgeBackedLocalCommand(text string) (string, bool) {
	trimmed := strings.TrimSpace(text)
	fields := strings.Fields(trimmed)
	if len(fields) == 0 {
		return "", false
	}

	head := strings.ToLower(fields[0])
	if len(fields) > 1 {
		switch head {
		case "/agents", "/council", "/run", "/runs", "/tasks", "/agent-runs",
			"/goal", "/goals", "/provider", "/providers", "/model", "/models",
			"/search-provider", "/search-providers", "/search", "/web",
			"/computer-use", "/cu", "/connect", "/telegram", "/channel",
			"/checkpoint", "/checkpoints", "/budget", "/mcp", "/dmcp", "/acp",
			"/permission", "/permissions":
			return trimmed, true
		default:
			return "", false
		}
	}

	switch head {
	case "/doctor":
		return "/doctor", true
	case "/agents":
		return "/agents", true
	case "/council":
		return "/council", true
	case "/run":
		return "/run", true
	case "/goal", "/goals":
		return "/goal", true
	case "/provider", "/model", "/search-provider":
		return strings.ToLower(strings.TrimSpace(text)), true
	case "/computer-use", "/cu":
		return "/computer-use", true
	case "/connect", "/telegram", "/channel":
		return "/connect", true
	default:
		return "", false
	}
}

func bridgeBackedCommandHead(command string) string {
	fields := strings.Fields(strings.TrimSpace(command))
	if len(fields) == 0 {
		return ""
	}
	return strings.ToLower(fields[0])
}

func bridgeBackedLocalCommandStatus(command string) string {
	switch bridgeBackedCommandHead(command) {
	case "/doctor":
		return "opening doctor"
	case "/agents":
		return "opening agents"
	case "/council":
		return "opening council"
	case "/run", "/runs", "/tasks", "/agent-runs":
		return "opening agent runs"
	case "/goal", "/goals":
		return "opening goal status"
	case "/provider", "/providers":
		return "opening provider manager"
	case "/model", "/models":
		return "opening model manager"
	case "/search-provider", "/search-providers", "/search", "/web":
		return "opening search-provider manager"
	case "/computer-use", "/cu":
		return "opening computer-use status"
	case "/connect", "/telegram", "/channel":
		return "opening connector status"
	case "/checkpoint", "/checkpoints", "/budget", "/mcp", "/dmcp", "/acp", "/permission", "/permissions":
		return "dispatching harness command"
	default:
		return "dispatching command"
	}
}

func bridgeBackedLocalFallback(command string) (localTUICommand, bool) {
	switch bridgeBackedCommandHead(command) {
	case "/agents":
		return localTUICommandSuperAgent, true
	case "/council":
		return localTUICommandCouncil, true
	case "/run", "/runs", "/tasks", "/agent-runs":
		return localTUICommandRuns, true
	case "/goal", "/goals":
		return localTUICommandGoal, true
	case "/provider", "/providers", "/model", "/models":
		return localTUICommandProvider, true
	case "/search-provider", "/search-providers", "/search", "/web":
		return localTUICommandSearch, true
	case "/computer-use", "/cu":
		return localTUICommandComputer, true
	case "/connect", "/telegram", "/channel":
		return localTUICommandConnect, true
	case "/checkpoint", "/checkpoints", "/budget", "/mcp", "/dmcp", "/acp", "/permission", "/permissions":
		return localTUICommandHarness, true
	default:
		return "", false
	}
}

func bridgeBackedLocalFallbackStatus(command string) string {
	switch bridgeBackedCommandHead(command) {
	case "/agents":
		return "bridge unavailable; showing local agents card"
	case "/council":
		return "bridge unavailable; showing local council card"
	case "/run", "/runs", "/tasks", "/agent-runs":
		return "bridge unavailable; showing local run card"
	case "/goal", "/goals":
		return "bridge unavailable; showing local goal card"
	case "/provider", "/providers", "/model", "/models":
		return "bridge unavailable; showing local provider card"
	case "/search-provider", "/search-providers", "/search", "/web":
		return "bridge unavailable; showing local search card"
	case "/computer-use", "/cu":
		return "bridge unavailable; showing local computer-use card"
	case "/connect", "/telegram", "/channel":
		return "bridge unavailable; showing local connector card"
	case "/checkpoint", "/checkpoints", "/budget", "/mcp", "/dmcp", "/acp", "/permission", "/permissions":
		return "bridge unavailable; showing local harness card"
	default:
		return "bridge unavailable"
	}
}

func localCommandStatus(command localTUICommand) string {
	switch command {
	case localTUICommandDeck:
		return "command deck"
	case localTUICommandStatus:
		return "status snapshot"
	case localTUICommandSuperAgent:
		return "super agent surface"
	case localTUICommandRuns:
		return "agent run surface"
	case localTUICommandGoal:
		return "goal surface"
	case localTUICommandCouncil:
		return "council surface"
	case localTUICommandProvider:
		return "provider surface"
	case localTUICommandSearch:
		return "search provider surface"
	case localTUICommandComputer:
		return "computer-use surface"
	case localTUICommandConnect:
		return "connector surface"
	case localTUICommandHarness:
		return "harness state surface"
	default:
		return "ready"
	}
}

func (m *MainModel) localCommandContent(command localTUICommand) string {
	switch command {
	case localTUICommandStatus:
		return m.statusSnapshot()
	case localTUICommandSuperAgent:
		return m.superAgentSnapshot()
	case localTUICommandRuns:
		return m.runsSnapshot()
	case localTUICommandGoal:
		return m.goalSnapshot()
	case localTUICommandCouncil:
		return m.councilSnapshot()
	case localTUICommandProvider:
		return m.providerSnapshot()
	case localTUICommandSearch:
		return m.searchSnapshot()
	case localTUICommandComputer:
		return m.computerUseSnapshot()
	case localTUICommandConnect:
		return m.connectorSnapshot()
	case localTUICommandHarness:
		return m.harnessStateSnapshot()
	default:
		return m.commandDeckText()
	}
}

func (m *MainModel) commandDeckText() string {
	return strings.Join([]string{
		"DuckHive command deck",
		"",
		"Super Agent",
		"  /agents - open the real backend agent surface; /agent, /teams, /super keep the local TUI Agent Teams card.",
		"  /run - open the real AgentRun command surface; /runs and /tasks keep the local TUI card.",
		"  /goal - show Codex-style persisted goal status; /goal <description> creates one in a bridged session.",
		"  /orchestrate <task> --dry-run - analyze complexity, council need, and team plan in the JS backend.",
		"  /team templates - list Agent Team templates; /team spawn <name> <type> starts one when Hive Nation is online.",
		"",
		"AI Council",
		"  /council - open the real backend council surface when the bridge is connected.",
		"  /council <question> - starts backend deliberation when the bridge is connected.",
		"  Shift+Tab cycles composer modes; council mode prefixes prompts for deliberation.",
		"",
		"Search providers",
		"  /search-provider - open the real backend search-provider manager when the bridge is connected.",
		"  /search-provider <mode> - in a bridged session, persist auto/native/ddg/searxng/tavily/exa/you/jina/bing/mojeek/linkup/custom.",
		"",
		"Computer use",
		"  /computer-use - open the backend computer-use status surface; /computer-use tools lists native Codex and fallback tools.",
		"  /cu tools - provider-free shortcut for Codex computer-use and newest-desktop-control tool discovery.",
		"",
		"Connectors",
		"  /connect - open Telegram/channel connector status when the bridge is connected.",
		"  /telegram status and /channel status telegram stay available in the backend while provider setup is broken.",
		"",
		"Harness state",
		"  /checkpoint, /budget, /mcp, /acp, and /permissions keep local readiness visible in the TUI.",
		"  Bridged sessions should still use the backend slash commands for mutation and full detail.",
		"",
		"Session controls",
		"  /status - status snapshot. /goal - goal status. /doctor - backend diagnostic UI when the bridge is connected. /repl - return to the classic REPL.",
		"  Ctrl+T toggles the side deck. Ctrl+O toggles transcript. Ctrl+X toggles local shell mode.",
	}, "\n")
}

func (m *MainModel) statusSnapshot() string {
	return strings.Join([]string{
		"DuckHive status",
		"",
		fmt.Sprintf("Workspace: %s", filepath.Base(m.state.WorkingDir)),
		fmt.Sprintf("Bridge: %s", boolLabel(m.state.BridgeConnected, "connected", "local only")),
		fmt.Sprintf("Provider: %s", m.displayProvider()),
		fmt.Sprintf("Model: %s", m.displayModel()),
		fmt.Sprintf("Search: %s", m.displaySearchProvider()),
		fmt.Sprintf("Mode: %s", m.state.InputMode.String()),
		fmt.Sprintf("Fast mode: %s", boolLabel(m.state.IsFastMode, "on", "off")),
		fmt.Sprintf("Active tasks: %d", m.state.ActiveTaskCount),
		fmt.Sprintf("AgentRun control: %s", boolLabel(true, "enabled", "disabled")),
		fmt.Sprintf("Checkpoints: %d", m.cap.checkpointCount),
		"",
		"Use /doctor when the bridge is connected for the full backend diagnostic UI.",
	}, "\n")
}

func (m *MainModel) superAgentSnapshot() string {
	lines := []string{
		"Super Agent",
		"",
		fmt.Sprintf("Meta agents: %s", boolLabel(envIsNotFalse("DUCKHIVE_META_ENABLED"), "enabled", "disabled")),
		fmt.Sprintf("Agent Teams: %s", boolLabel(m.cap.hasTeams, "wired", "not detected")),
		fmt.Sprintf("AI Council: %s", boolLabel(m.cap.hasCouncil, "wired", "not detected")),
		fmt.Sprintf("MCP services: %s", boolLabel(m.cap.hasMCP, "detected", "not detected")),
		fmt.Sprintf("ACP bridge: %s", boolLabel(m.cap.hasACP, "detected", "not detected")),
		fmt.Sprintf("AgentRun control: %s", boolLabel(true, "wired", "missing")),
		"",
		"Backend commands:",
		"  /runs",
		"  /orchestrate <task> --dry-run",
		"  /orchestrate <task> --council --team=code",
		"  /team templates",
		"  /team spawn <name> code",
		"  /spawn <agent>",
	}
	return strings.Join(lines, "\n")
}

func (m *MainModel) runsSnapshot() string {
	lines := []string{
		"AgentRun control plane",
		"",
		"Lifecycle: queued -> preparing -> running -> awaiting_approval -> paused -> recovering -> completed|failed|cancelled.",
		fmt.Sprintf("Active task mirrors: %d", m.state.ActiveTaskCount),
		fmt.Sprintf("Bridge: %s", boolLabel(m.state.BridgeConnected, "connected", "local only")),
		fmt.Sprintf("Provider/model: %s / %s", m.displayProvider(), m.displayModel()),
		"",
		"Surfaces:",
		"  Local agent tasks mirror into AgentRuns.",
		"  Hybrid orchestration creates coordinator and child runs.",
		"  Telegram can inspect/control runs with /runs, /run, /tail, /pause, /resume, /stop, /approve.",
		"",
		"Next useful upgrades:",
		"  show live run tree in this rail, dependency-aware worker retries, and verification handoff per child run.",
	}
	return strings.Join(lines, "\n")
}

func (m *MainModel) goalSnapshot() string {
	return strings.Join([]string{
		"Persisted goals",
		"",
		"Codex-style goal tracking is available through the DuckHive backend.",
		fmt.Sprintf("Bridge: %s", boolLabel(m.state.BridgeConnected, "connected", "local only")),
		"",
		"Common commands:",
		"  /goal <description>          create and attach a goal",
		"  /goal list                   list persisted goals",
		"  /goal status [goal-id]       show current or selected goal",
		"  /goal step add <description> add a step to the active goal",
		"  /goal pause|resume|complete  move the goal lifecycle",
		"",
		"Use bare /goal in a bridged TUI session to open the live backend status.",
		"Use /repl if you need the classic REPL goal workflow while the bridge is offline.",
	}, "\n")
}

func (m *MainModel) computerUseSnapshot() string {
	return strings.Join([]string{
		"Computer use",
		"",
		"Codex-style computer-use inspection is available through the DuckHive backend.",
		fmt.Sprintf("Bridge: %s", boolLabel(m.state.BridgeConnected, "connected", "local only")),
		"",
		"Common commands:",
		"  /computer-use status       inspect native Codex computer-use wiring",
		"  /computer-use tools        list native Codex and newest-desktop-control tools",
		"  /computer-use disable      remove stale project MCP config",
		"  /cu tools                  shortcut for the provider-free tool catalog",
		"",
		"Fallback gateway:",
		"  newest-desktop-control exposes desktop_*, android_*, and computer_use_* MCP aliases.",
		"Use /repl if you need the classic REPL computer-use workflow while the bridge is offline.",
	}, "\n")
}

func (m *MainModel) connectorSnapshot() string {
	return strings.Join([]string{
		"Connectors",
		"",
		"Telegram and channel status are available through provider-free backend commands.",
		fmt.Sprintf("Bridge: %s", boolLabel(m.state.BridgeConnected, "connected", "local only")),
		"",
		"Common commands:",
		"  /connect status            show Telegram connector status",
		"  /telegram status           Telegram status alias",
		"  /channel status telegram   channel adapter status",
		"  /channel send telegram ... send through the Telegram adapter",
		"",
		"Use /repl if you need the classic REPL connector setup flow while the bridge is offline.",
	}, "\n")
}

func (m *MainModel) harnessStateSnapshot() string {
	return strings.Join([]string{
		"Harness state",
		"",
		fmt.Sprintf("Checkpoints: %d saved; engine %s", m.cap.checkpointCount, boolLabel(m.cap.hasCheckpointEngine, "detected", "not detected")),
		fmt.Sprintf("MCP services: %s", boolLabel(m.cap.hasMCP, "detected", "not detected")),
		fmt.Sprintf("ACP bridge: %s", boolLabel(m.cap.hasACP, "detected", "not detected")),
		fmt.Sprintf("Permissions: %s", permissionModeLabel(m.state.PermissionMode)),
		fmt.Sprintf("Budget spend: $%.4f this session", m.state.TotalCostUSD),
		"",
		"Backend commands:",
		"  /checkpoint save|list|load|delete",
		"  /budget, /budget set <provider|global> <usd>, /budget reset",
		"  /mcp or duckhive dmcp list|add|remove|health",
		"  /acp, /acp status, /acp stop",
		"  /permissions or /doctor for full policy diagnostics",
		"",
		"Local TUI status is read-only. Mutations stay in backend slash commands so REPL, TUI, print, and automation share one state path.",
	}, "\n")
}

func permissionModeLabel(mode model.PermissionMode) string {
	switch mode {
	case model.PermModeAcceptAll:
		return "accept all"
	case model.PermModeBypass:
		return "bypass"
	default:
		return "review tools"
	}
}

func (m *MainModel) councilSnapshot() string {
	return strings.Join([]string{
		"AI Council",
		"",
		fmt.Sprintf("Council files: %s", boolLabel(m.cap.hasCouncil, "wired", "not detected")),
		fmt.Sprintf("Council env: %s", boolLabel(envIsNotFalse("DUCKHIVE_COUNCIL_ENABLED"), "enabled", "disabled")),
		"Roles include governance, technology, ethics, practical review, skepticism, coding, security, QA, vision, and specialist councilors.",
		"",
		"Use /council <question> in a bridged session to start deliberation.",
		"Use /council --status in a bridged session for active deliberation state.",
	}, "\n")
}

func (m *MainModel) providerSnapshot() string {
	configured := "none"
	if len(m.cap.configuredProviders) > 0 {
		configured = strings.Join(m.cap.configuredProviders, ", ")
	}
	return strings.Join([]string{
		"Model providers",
		"",
		fmt.Sprintf("Active: %s", m.displayProvider()),
		fmt.Sprintf("Model: %s", m.displayModel()),
		fmt.Sprintf("Configured keys: %s", configured),
		"First-class DuckHive presets: MiniMax, OpenRouter, NVIDIA NIM, LM Studio, Ollama, Kimi, Gemini, and Codex.",
		"",
		"Use /provider in a bridged session for the full provider manager.",
		"Use --provider <provider> for one session or ~/.duckhive/config.json for defaults.",
	}, "\n")
}

func (m *MainModel) modelPickerView() string {
	width := m.width
	if width == 0 {
		width = 100
	}
	cardWidth := maxInt(58, min(width-8, 104))
	configured := "none"
	if len(m.cap.configuredProviders) > 0 {
		configured = strings.Join(m.cap.configuredProviders, ", ")
	}
	presets := []string{
		"Fast: local/Ollama or MiniMax for low-latency edits",
		"Coding: Codex, Kimi, Gemini, or MiniMax routes for repo work",
		"Reasoning: Codex plan or higher-context provider profiles",
		"Vision: Kimi/Gemini/OpenAI-compatible vision-capable routes",
	}
	lines := []string{
		tui.HeaderTitle.Render("Model Picker"),
		"",
		tui.HeaderSubtitle.Render("Current route"),
		fmt.Sprintf("  Provider: %s", m.displayProvider()),
		fmt.Sprintf("  Model: %s", m.displayModel()),
		fmt.Sprintf("  Configured keys: %s", configured),
		"",
		tui.HeaderSubtitle.Render("DuckHive presets"),
	}
	for _, preset := range presets {
		lines = append(lines, "  - "+preset)
	}
	lines = append(lines,
		"",
		tui.HeaderSubtitle.Render("How to change"),
		"  /model opens the backend model selector when the bridge is connected.",
		"  /provider opens the full provider manager.",
		"  duckhive provider status is available before the REPL starts.",
		"  Set DUCKHIVE_PROVIDER or OPENAI_MODEL for one-session routing.",
		"",
		tui.DimText.Render("press esc or ctrl+d to return to the TUI"),
	)
	card := tui.Card.Width(cardWidth).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
	return lipgloss.Place(width, maxInt(12, m.height-2), lipgloss.Center, lipgloss.Center, card)
}

func (m *MainModel) searchSnapshot() string {
	configured := "duckduckgo"
	if len(m.cap.configuredSearch) > 0 {
		configured = strings.Join(m.cap.configuredSearch, ", ")
	}
	return strings.Join([]string{
		"Search providers",
		"",
		fmt.Sprintf("Active: %s", m.displaySearchProvider()),
		fmt.Sprintf("Configured: %s", configured),
		"Modes: auto, native, ddg, searxng, tavily, exa, you, jina, bing, mojeek, linkup, custom.",
		"MiniMax CLI is also expected as a first-class media/search companion when mmx-cli is installed.",
		"",
		"Provider env keys:",
		"  TAVILY_API_KEY, EXA_API_KEY, YOU_API_KEY, JINA_API_KEY, BING_API_KEY, MOJEEK_API_KEY, LINKUP_API_KEY",
		"Custom env:",
		"  WEB_PROVIDER, WEB_SEARCH_API, WEB_URL_TEMPLATE, WEB_KEY",
		"SearXNG:",
		"  /search-provider searxng --url http://localhost:8080/search",
		"",
		"Use /search-provider <mode> in a bridged session to persist the default.",
	}, "\n")
}

func (m *MainModel) runShellCommand(command string) tea.Cmd {
	ctx, cancel := context.WithCancel(context.Background())
	m.shellCancel = cancel
	m.shellRunning = true
	m.state.IsLoading = true
	m.state.StatusMsg = "running shell command"

	m.appendMessage(model.Message{
		ID:        messageID("tool"),
		Type:      model.MsgTypeToolUse,
		Content:   command,
		Timestamp: time.Now(),
		ToolCalls: []model.ToolCall{{
			Name:   "shell",
			Status: model.ToolStatusPending,
		}},
	})

	workdir := m.state.WorkingDir
	shell, shellArgs := localShellCommand(command)

	return func() tea.Msg {
		start := time.Now()
		cmd := exec.CommandContext(ctx, shell, shellArgs...)
		cmd.Dir = workdir
		output, err := cmd.CombinedOutput()

		rendered := strings.TrimSpace(string(output))
		if rendered == "" && err == nil {
			rendered = "(no output)"
		}
		if len(rendered) > shellOutputLimit {
			rendered = rendered[:shellOutputLimit] + "\n... output truncated ..."
		}

		return shellCommandResultMsg{
			command:  command,
			output:   rendered,
			err:      err,
			duration: time.Since(start),
			canceled: errors.Is(ctx.Err(), context.Canceled),
		}
	}
}

func (m *MainModel) handleShellResult(msg shellCommandResultMsg) {
	m.shellRunning = false
	m.shellCancel = nil
	m.state.IsLoading = false

	status := model.ToolStatusCompleted
	if msg.err != nil || msg.canceled {
		status = model.ToolStatusFailed
	}

	content := msg.output
	if msg.canceled && content == "" {
		content = "(interrupted)"
	}
	if msg.err != nil && content == "" {
		content = msg.err.Error()
	}

	m.appendMessage(model.Message{
		ID:        messageID("tool"),
		Type:      model.MsgTypeToolResult,
		Content:   content,
		Timestamp: time.Now(),
		IsError:   msg.err != nil && !msg.canceled,
		ToolCalls: []model.ToolCall{{
			Name:   "shell",
			Output: content,
			Status: status,
		}},
	})

	if msg.canceled {
		m.state.StatusMsg = fmt.Sprintf("shell interrupted after %s", msg.duration.Round(time.Millisecond))
		return
	}
	if msg.err != nil {
		m.state.StatusMsg = fmt.Sprintf("shell failed after %s", msg.duration.Round(time.Millisecond))
		return
	}
	m.state.StatusMsg = fmt.Sprintf("shell finished in %s", msg.duration.Round(time.Millisecond))
}

func (m *MainModel) openExternalEditor() tea.Cmd {
	editorCmd, editorPath, cleanup, err := prepareExternalEditorLaunch(runtime.GOOS, m.input.Value())
	if err != nil {
		m.state.StatusMsg = fmt.Sprintf("external editor unavailable: %v", err)
		return nil
	}

	m.editorPath = editorPath
	m.editorCleanup = cleanup
	m.state.StatusMsg = "editing in external editor"

	return tea.ExecProcess(editorCmd, func(err error) tea.Msg {
		return externalEditorFinishedMsg{err: err}
	})
}

func (m *MainModel) handleExternalEditorFinished(msg externalEditorFinishedMsg) {
	editorPath := m.editorPath
	cleanup := m.editorCleanup
	m.editorPath = ""
	m.editorCleanup = nil
	defer func() {
		if cleanup != nil {
			_ = cleanup()
		}
	}()

	if msg.err != nil {
		m.state.StatusMsg = fmt.Sprintf("external editor failed: %v", msg.err)
		return
	}
	if editorPath == "" {
		m.state.StatusMsg = "external editor finished"
		return
	}

	content, err := os.ReadFile(editorPath)
	if err != nil {
		m.state.StatusMsg = fmt.Sprintf("external editor read failed: %v", err)
		return
	}

	m.pushInputUndoSnapshot(m.input.Value())
	m.input.SetValue(string(content))
	m.state.StatusMsg = "external editor applied"
}

func (m *MainModel) recordInputUndoIfChanged(previous string) {
	current := m.input.Value()
	if current == previous {
		return
	}
	m.pushInputUndoSnapshot(previous)
}

func (m *MainModel) pushInputUndoSnapshot(previous string) {
	if len(m.inputUndo) > 0 && m.inputUndo[len(m.inputUndo)-1] == previous {
		return
	}
	m.inputUndo = append(m.inputUndo, previous)
	if len(m.inputUndo) > 100 {
		m.inputUndo = append([]string(nil), m.inputUndo[len(m.inputUndo)-100:]...)
	}
}

func (m *MainModel) applyInputUndo() bool {
	if len(m.inputUndo) == 0 {
		return false
	}
	previous := m.inputUndo[len(m.inputUndo)-1]
	m.inputUndo = m.inputUndo[:len(m.inputUndo)-1]
	m.input.SetValue(previous)
	return true
}

func prepareExternalEditorLaunch(goos, initialContent string) (*exec.Cmd, string, func() error, error) {
	tmpFile, err := os.CreateTemp("", "duckhive-editor-*.md")
	if err != nil {
		return nil, "", nil, err
	}
	cleanup := func() error {
		return os.Remove(tmpFile.Name())
	}
	if _, err := tmpFile.WriteString(initialContent); err != nil {
		_ = tmpFile.Close()
		_ = cleanup()
		return nil, "", nil, err
	}
	if err := tmpFile.Close(); err != nil {
		_ = cleanup()
		return nil, "", nil, err
	}

	editorName, editorArgs, err := resolveExternalEditorCommand(goos)
	if err != nil {
		_ = cleanup()
		return nil, "", nil, err
	}

	cmd := exec.Command(editorName, append(editorArgs, tmpFile.Name())...)
	return cmd, tmpFile.Name(), cleanup, nil
}

func resolveExternalEditorCommand(goos string) (string, []string, error) {
	for _, candidate := range []string{
		strings.TrimSpace(os.Getenv("VISUAL")),
		strings.TrimSpace(os.Getenv("EDITOR")),
	} {
		if candidate == "" {
			continue
		}
		parts, err := splitCommandLine(candidate)
		if err != nil {
			return "", nil, err
		}
		if len(parts) == 0 {
			continue
		}
		return parts[0], parts[1:], nil
	}

	if goos == "windows" {
		if resolved, err := exec.LookPath("notepad.exe"); err == nil {
			return resolved, nil, nil
		}
		return "notepad.exe", nil, nil
	}

	for _, candidate := range []string{"nano", "vim", "vi"} {
		if resolved, err := exec.LookPath(candidate); err == nil {
			return resolved, nil, nil
		}
	}

	return "", nil, fmt.Errorf("set VISUAL or EDITOR")
}

func splitCommandLine(input string) ([]string, error) {
	var (
		args      []string
		current   []rune
		inQuote   rune
		hadQuoted bool
	)

	flush := func() {
		if len(current) == 0 && !hadQuoted {
			return
		}
		args = append(args, string(current))
		current = current[:0]
		hadQuoted = false
	}

	for _, r := range input {
		switch {
		case inQuote != 0:
			if r == inQuote {
				inQuote = 0
				hadQuoted = true
			} else {
				current = append(current, r)
			}
		case r == '"' || r == '\'':
			inQuote = r
		case r == ' ' || r == '\t' || r == '\n' || r == '\r':
			flush()
		default:
			current = append(current, r)
		}
	}

	if inQuote != 0 {
		return nil, fmt.Errorf("unterminated quote in editor command")
	}
	flush()
	return args, nil
}

func localShellCommand(command string) (string, []string) {
	return localShellCommandForOS(runtime.GOOS, command)
}

func localShellCommandForOS(goos, command string) (string, []string) {
	if goos == "windows" {
		if shell := strings.TrimSpace(os.Getenv("SHELL")); shell != "" {
			return shell, shellArgsForExecutable(shell, command)
		}
		for _, candidate := range []string{"pwsh.exe", "powershell.exe"} {
			if resolved, err := exec.LookPath(candidate); err == nil {
				return resolved, shellArgsForExecutable(resolved, command)
			}
		}
		if comspec := strings.TrimSpace(os.Getenv("COMSPEC")); comspec != "" {
			return comspec, shellArgsForExecutable(comspec, command)
		}
		return "cmd.exe", shellArgsForExecutable("cmd.exe", command)
	}

	shell := strings.TrimSpace(os.Getenv("SHELL"))
	if shell == "" {
		shell = "/bin/zsh"
	}
	return shell, shellArgsForExecutable(shell, command)
}

func shellArgsForExecutable(shellPath, command string) []string {
	name := strings.ToLower(filepath.Base(strings.TrimSpace(shellPath)))
	switch name {
	case "pwsh", "pwsh.exe", "powershell", "powershell.exe":
		return []string{"-NoLogo", "-NoProfile", "-Command", command}
	case "cmd", "cmd.exe":
		return []string{"/d", "/s", "/c", command}
	default:
		return []string{"-lc", command}
	}
}

func (m *MainModel) waitForBridgeMsg() tea.Cmd {
	if m.bridge == nil {
		return nil
	}
	return func() tea.Msg {
		msg, ok := <-m.bridge.Subscription()
		if !ok {
			return model.MsgBridgeDisconnected{Err: fmt.Errorf("bridge closed")}
		}
		return msg
	}
}

func (m *MainModel) currentContext() string {
	if m.state.DialogOpen || m.dialog != nil {
		return "Confirmation"
	}
	switch m.state.ActiveScreen {
	case model.ScreenSettings:
		return "Settings"
	case model.ScreenWelcome:
		return "Global"
	default:
		return "Chat"
	}
}

func (m *MainModel) appendMessage(msg model.Message) {
	if msg.ID == "" {
		msg.ID = messageID("msg")
	}
	if msg.Timestamp.IsZero() {
		msg.Timestamp = time.Now()
	}
	m.state.Messages = append(m.state.Messages, msg)
	m.msgList.AppendMessage(msg)
	m.syncTranscript()
}

func (m *MainModel) syncTranscript() {
	m.transcript.SetMessages(m.state.Messages)
}

func (m *MainModel) updateComposer() {
	switch m.state.InputMode {
	case model.InputModeShell:
		m.input.SetPrompt("$ ")
		m.input.SetPlaceholder("Run a local shell command. Ctrl+X returns to agent mode")
	case model.InputModeCouncil:
		m.input.SetPrompt("? ")
		m.input.SetPlaceholder("Ask for council-style deliberation, or use /council for status")
	case model.InputModeMedia:
		m.input.SetPrompt("* ")
		m.input.SetPlaceholder("MiniMax/media/search/vision task. Try /search-provider")
	default:
		m.input.SetPrompt("> ")
		m.input.SetPlaceholder("Ask DuckHive, /help, /goal, /agents, /council, /status")
	}
}

func (m *MainModel) setTranscriptVisible(visible bool) {
	if m.transcript.IsVisible() == visible {
		return
	}
	m.transcript.Toggle()
}

func (m *MainModel) showRail() bool {
	return m.width >= railBreakpoint && (m.showInspector || m.transcript.IsVisible())
}

func (m *MainModel) railWidth() int {
	width := m.width / 3
	if width < minRailWidth {
		width = minRailWidth
	}
	if width > maxRailWidth {
		width = maxRailWidth
	}
	return width
}

func (m *MainModel) mainPaneWidth() int {
	if !m.showRail() {
		return m.width
	}
	return maxInt(48, m.width-m.railWidth()-1)
}

func (m *MainModel) msgListHeight() int {
	height := m.height - 12
	if height < 8 {
		height = 8
	}
	return height
}

func (m *MainModel) resizeLayout() {
	if m.width == 0 || m.height == 0 {
		return
	}

	mainWidth := m.mainPaneWidth()
	contentHeight := maxInt(12, m.height-7)
	inputHeight := 3
	msgHeight := maxInt(8, contentHeight-inputHeight-2)

	m.msgList.SetSize(maxInt(24, mainWidth-4), msgHeight)
	m.input.SetSize(maxInt(24, mainWidth-6), inputHeight)
	m.transcript.SetSize(maxInt(20, m.railWidth()-4), maxInt(8, contentHeight/3))
}

func (m *MainModel) renderHeader() string {
	leftParts := []string{
		tui.HeaderTitle.Render("DuckHive"),
		tui.HeaderSubtitle.Render(filepath.Base(m.state.WorkingDir)),
		tui.HeaderSubtitle.Render(m.displayProvider() + "/" + truncate(m.displayModel(), 28)),
		tui.HeaderSubtitle.Render("search:" + m.displaySearchProvider()),
	}
	left := strings.Join(leftParts, " ")

	rightParts := []string{}
	rightParts = append(rightParts, tui.CardMuted.Render(formatElapsed(time.Since(m.state.SessionStartedAt))))
	if m.state.TotalCostUSD > 0 {
		rightParts = append(rightParts, tui.CardMuted.Render(fmt.Sprintf("$%.4f", m.state.TotalCostUSD)))
	}
	if m.state.TotalAPIDuration > 0 {
		rightParts = append(rightParts, tui.CardMuted.Render("api "+formatDurationCompact(m.state.TotalAPIDuration)))
	}
	if m.state.ActiveTaskCount > 0 {
		rightParts = append(rightParts, tui.CardMuted.Render(fmt.Sprintf("%d tasks", m.state.ActiveTaskCount)))
	}
	if m.state.BridgeConnected {
		rightParts = append(rightParts, tui.GoodBadge.Render("bridge"))
	} else {
		rightParts = append(rightParts, tui.WarnBadge.Render("local"))
	}
	right := strings.Join(rightParts, "  ")

	spacer := strings.Repeat(" ", maxInt(1, m.width-lipgloss.Width(left)-lipgloss.Width(right)-2))
	return tui.Header.Width(m.width).Render(left + spacer + right)
}

func (m *MainModel) renderRail(width int) string {
	sections := []string{}

	if m.transcript.IsVisible() {
		sections = append(sections, renderCard("Transcript", m.transcript.View(), width))
	}

	if m.showInspector {
		sections = append(sections, renderCard("Status", m.renderSessionCard(width), width))
		sections = append(sections, renderCard("Capabilities", m.renderFeatureCard(width), width))
		sections = append(sections, renderCard("Command Deck", m.renderCommandRail(), width))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

func (m *MainModel) renderSessionCard(width int) string {
	instructions := []string{}
	if m.cap.hasAGENTS {
		instructions = append(instructions, "AGENTS")
	}
	if m.cap.hasGEMINI {
		instructions = append(instructions, "GEMINI")
	}
	if m.cap.hasCLAUDE {
		instructions = append(instructions, "CLAUDE")
	}
	if len(instructions) == 0 {
		instructions = append(instructions, "none")
	}

	lines := []string{
		fmt.Sprintf("workspace  %s", filepath.Base(m.state.WorkingDir)),
		fmt.Sprintf("elapsed    %s", formatElapsed(time.Since(m.state.SessionStartedAt))),
		fmt.Sprintf("provider   %s", m.displayProvider()),
		fmt.Sprintf("model      %s", truncate(m.displayModel(), width-12)),
		fmt.Sprintf("search     %s", m.displaySearchProvider()),
		fmt.Sprintf("mode       %s", m.state.InputMode.String()),
		fmt.Sprintf("fast       %s", boolLabel(m.state.IsFastMode, "on", "off")),
		fmt.Sprintf("bridge     %s", boolLabel(m.state.BridgeConnected, "up", "local")),
		fmt.Sprintf("api time   %s", formatDurationCompact(m.state.TotalAPIDuration)),
		fmt.Sprintf("tasks      %d", m.state.ActiveTaskCount),
		fmt.Sprintf("checkpts   %d", m.cap.checkpointCount),
		fmt.Sprintf("docs       %s", strings.Join(instructions, ", ")),
		fmt.Sprintf("keys       %s", strings.Join(nonEmptyOrDefault(m.cap.configuredProviders, "none"), ", ")),
	}

	if m.state.StatusMsg != "" {
		lines = append(lines, "", tui.CardMuted.Render(truncate(m.state.StatusMsg, width-6)))
	}

	return lipgloss.JoinVertical(lipgloss.Left, renderMutedLines(lines)...)
}

func (m *MainModel) renderFeatureCard(width int) string {
	lines := []string{}
	for _, pillar := range m.featurePillars() {
		line := lipgloss.JoinHorizontal(
			lipgloss.Left,
			renderStatusBadge(pillar.Status),
			" ",
			tui.CardTitle.Render(pillar.Source),
		)
		lines = append(lines, line)
		lines = append(lines, tui.CardMuted.Render(truncate(pillar.Summary, width-6)))
	}
	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

func (m *MainModel) renderCommandRail() string {
	return lipgloss.JoinVertical(
		lipgloss.Left,
		tui.CardMuted.Render("/help deck"),
		tui.CardMuted.Render("/status snapshot"),
		tui.CardMuted.Render("/goal status"),
		tui.CardMuted.Render("/runs agent runs"),
		tui.CardMuted.Render("/provider models"),
		tui.CardMuted.Render("/search-provider search"),
		tui.CardMuted.Render("/computer-use tools"),
		tui.CardMuted.Render("/connect status"),
		tui.CardMuted.Render("/checkpoint harness state"),
		tui.CardMuted.Render("/agents super agent"),
		tui.CardMuted.Render("/council deliberation"),
		tui.CardMuted.Render("/repl classic UI"),
	)
}

func (m *MainModel) renderFooter() string {
	status := m.state.StatusMsg
	if status == "" {
		status = "ready | /help deck | /goal status | /runs agent runs | /agents super agent | /repl classic"
	}

	help := formatHelp(tui.ActiveBindings(m.keys, m.currentContext()))
	spacer := strings.Repeat(" ", maxInt(1, m.width-len(stripANSI(status))-len(stripANSI(help))-4))
	return tui.StatusBar.Width(m.width).Render(status + spacer + help)
}

func (m *MainModel) renderPermissionOverlay() string {
	if !m.state.DialogOpen || m.state.PendingPermission == nil {
		return ""
	}

	req := m.state.PendingPermission
	body := lipgloss.JoinVertical(
		lipgloss.Left,
		tui.DialogTitle.Render("Permission request"),
		"",
		tui.DialogBody.Render(fmt.Sprintf("Tool: %s", req.ToolName)),
		tui.DialogBody.Render(truncate(req.Meta, maxInt(30, m.width-18))),
		"",
		tui.DimText.Render("y allow  n deny"),
	)

	return "\n" + lipgloss.Place(
		m.width,
		8,
		lipgloss.Center,
		lipgloss.Center,
		tui.Dialog.Render(body),
	)
}

func (m *MainModel) featurePillars() []featurePillar {
	return []featurePillar{
		{
			Source:  "Codex",
			Status:  statusFromBool(m.cap.hasAGENTS || m.cap.hasCLAUDE),
			Summary: "repo instructions, local coding loop, and additive project guidance",
		},
		{
			Source:  "Gemini",
			Status:  statusFromBool(m.cap.hasCheckpointEngine),
			Summary: fmt.Sprintf("checkpoint-ready shell with %d saved checkpoints detected", m.cap.checkpointCount),
		},
		{
			Source:  "Kimi",
			Status:  statusFromBool(true),
			Summary: "shell mode in the composer plus ACP and MCP-oriented workflow surfaces",
		},
		{
			Source:  "OpenClaw",
			Status:  statusFromBool(m.cap.hasACP || m.cap.hasVoice),
			Summary: "multi-agent, remote, and voice-oriented surfaces on top of DuckHive's bridge",
		},
		{
			Source:  "duck-cli",
			Status:  statusFromBool(m.cap.hasCouncil || m.cap.hasTeams),
			Summary: "status-first orchestration, council routing, and multi-agent team posture across the harness",
		},
		{
			Source:  "MiniMax",
			Status:  statusFromBool(m.cap.hasMedia),
			Summary: "media mode for text, image, video, speech, music, search, and vision workflows",
		},
		{
			Source:  "Mercury",
			Status:  statusFromBool(m.cap.hasMercury),
			Summary: "budget, daemon, permissions, and soul-driven operator surfaces are planned into the shell",
		},
	}
}

func detectWorkspaceCapabilities(root string) workspaceCapabilities {
	return workspaceCapabilities{
		hasAGENTS:           nearestFileExists(root, "AGENTS.md"),
		hasGEMINI:           nearestFileExists(root, "GEMINI.md"),
		hasCLAUDE:           nearestFileExists(root, "CLAUDE.md"),
		hasCheckpointEngine: fileExists(filepath.Join(root, "src/orchestrator/checkpoint/checkpoint-manager.ts")),
		checkpointCount:     checkpointCount(),
		hasACP:              fileExists(filepath.Join(root, "src/orchestrator/acp/acp-bridge.ts")),
		hasMCP:              dirExists(filepath.Join(root, "src/services/mcp")),
		hasCouncil:          fileExists(filepath.Join(root, "src/orchestrator/hybrid/hybrid-orchestrator.ts")),
		hasTeams:            fileExists(filepath.Join(root, "src/utils/agentSwarmsEnabled.ts")) || fileExists(filepath.Join(root, "src/commands/hive-team/index.ts")),
		hasVoice:            fileExists(filepath.Join(root, "src/services/voice.ts")),
		hasMedia:            fileExists(filepath.Join(root, "src/orchestrator/multi-model/multi-model-router.ts")),
		hasMercury:          true,
		activeProvider:      detectActiveProvider(),
		configuredProviders: detectConfiguredProviders(),
		searchProvider:      detectSearchProvider(),
		configuredSearch:    detectConfiguredSearchProviders(),
	}
}

func (m *MainModel) displayModel() string {
	model := strings.TrimSpace(m.state.Model)
	if model == "" {
		return "auto"
	}
	return model
}

func (m *MainModel) displayProvider() string {
	if provider := strings.TrimSpace(m.cap.activeProvider); provider != "" {
		return provider
	}
	return "auto"
}

func (m *MainModel) displaySearchProvider() string {
	if provider := strings.TrimSpace(m.cap.searchProvider); provider != "" {
		return provider
	}
	return "auto"
}

func (h *uiHandoff) Execute() (int, error) {
	if h == nil {
		return 0, nil
	}

	if err := setDuckHiveUISurfacePreference(h.target); err != nil {
		return 1, err
	}

	switch h.target {
	case uiSurfaceLegacy:
		return launchLegacyREPL()
	default:
		return 0, nil
	}
}

func launchLegacyREPL() (int, error) {
	launcherCmd := strings.TrimSpace(os.Getenv("DUCKHIVE_LAUNCHER_CMD"))
	if launcherCmd == "" {
		launcherCmd = strings.TrimSpace(os.Getenv("DUCKHIVE_BRIDGE_CMD"))
	}
	if launcherCmd == "" {
		return 1, fmt.Errorf("missing DUCKHIVE_LAUNCHER_CMD")
	}

	launcherEntry := strings.TrimSpace(os.Getenv("DUCKHIVE_LAUNCHER_ENTRY"))
	if launcherEntry == "" {
		root, err := runtimeRoot()
		if err != nil {
			return 1, err
		}
		launcherEntry = filepath.Join(root, "dist", "cli.mjs")
	}

	cmd := exec.Command(launcherCmd, launcherEntry)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = buildLauncherEnv(uiSurfaceLegacy)

	err := cmd.Run()
	if err == nil {
		return 0, nil
	}
	if exitErr, ok := err.(*exec.ExitError); ok {
		return exitErr.ExitCode(), nil
	}
	return 1, err
}

func buildLauncherEnv(target uiSurface) []string {
	env := make([]string, 0, len(os.Environ())+2)
	for _, entry := range os.Environ() {
		if shouldDropLauncherEnv(entry) {
			continue
		}
		env = append(env, entry)
	}

	env = append(env, fmt.Sprintf("DUCKHIVE_DEFAULT_UI_SURFACE=%s", target))
	if target == uiSurfaceLegacy {
		env = append(env, "DUCKHIVE_NO_AUTO_TUI=1")
	}
	return env
}

func shouldDropLauncherEnv(entry string) bool {
	for _, prefix := range []string{
		"DUCKHIVE_AUTO_TUI=",
		"DUCKHIVE_BRIDGE_ARGS=",
		"DUCKHIVE_BRIDGE_CMD=",
		"DUCKHIVE_BRIDGE_SOCKET=",
		"DUCKHIVE_DEFAULT_UI_SURFACE=",
		"DUCKHIVE_LAUNCHER_CMD=",
		"DUCKHIVE_LAUNCHER_ENTRY=",
		"DUCKHIVE_NO_AUTO_TUI=",
	} {
		if strings.HasPrefix(entry, prefix) {
			return true
		}
	}
	return false
}

func runtimeRoot() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(filepath.Dir(exePath)), nil
}

func setDuckHiveUISurfacePreference(surface uiSurface) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	configDir := filepath.Join(home, ".duckhive")
	configPath := filepath.Join(configDir, "config.json")

	data := map[string]any{}
	if raw, readErr := os.ReadFile(configPath); readErr == nil {
		_ = json.Unmarshal(raw, &data)
	}

	uiSection, ok := data["ui"].(map[string]any)
	if !ok {
		uiSection = map[string]any{}
	}
	uiSection["defaultSurface"] = string(surface)
	data["ui"] = uiSection

	encoded, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return err
	}

	return os.WriteFile(configPath, append(encoded, '\n'), 0o644)
}

func nearestFileExists(root, name string) bool {
	dir := root
	for {
		if fileExists(filepath.Join(dir, name)) {
			return true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return false
		}
		dir = parent
	}
}

func checkpointCount() int {
	home, err := os.UserHomeDir()
	if err != nil {
		return 0
	}

	configDir := strings.TrimSpace(os.Getenv("CLAUDE_CONFIG_DIR"))
	if configDir == "" {
		configDir = filepath.Join(home, ".duckhive")
	}

	count := countCheckpointFiles(filepath.Join(configDir, "checkpoints"))
	if count > 0 {
		return count
	}

	return countCheckpointFiles(filepath.Join(home, ".config", "openclaude", "checkpoints"))
}

func countCheckpointFiles(dir string) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	count := 0
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			count++
		}
	}
	return count
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func renderCard(title, body string, width int) string {
	return tui.Card.Width(width).Render(
		lipgloss.JoinVertical(
			lipgloss.Left,
			tui.CardTitle.Render(title),
			body,
		),
	)
}

func renderMutedLines(lines []string) []string {
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		if line == "" {
			out = append(out, "")
			continue
		}
		out = append(out, tui.CardMuted.Render(line))
	}
	return out
}

func renderStatusBadge(status string) string {
	switch status {
	case "ready":
		return tui.GoodBadge.Render("READY")
	case "partial":
		return tui.WarnBadge.Render("PART")
	default:
		return tui.SoftBadge.Render("LATER")
	}
}

func boolLabel(ok bool, yes, no string) string {
	if ok {
		return yes
	}
	return no
}

func nonEmptyOrDefault(values []string, fallback string) []string {
	if len(values) > 0 {
		return values
	}
	return []string{fallback}
}

func statusFromBool(ok bool) string {
	if ok {
		return "ready"
	}
	return "later"
}

func detectConfiguredProviders() []string {
	checks := []struct {
		name string
		envs []string
	}{
		{name: "anthropic", envs: []string{"ANTHROPIC_API_KEY"}},
		{name: "openai", envs: []string{"OPENAI_API_KEY"}},
		{name: "openrouter", envs: []string{"OPENROUTER_API_KEY"}},
		{name: "gemini", envs: []string{"GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"}},
		{name: "kimi", envs: []string{"KIMI_API_KEY", "MOONSHOT_API_KEY"}},
		{name: "minimax", envs: []string{"MINIMAX_API_KEY"}},
		{name: "lmstudio", envs: []string{"LMSTUDIO_API_KEY", "LM_STUDIO_API_KEY"}},
	}

	providers := make([]string, 0, len(checks))
	for _, check := range checks {
		if envAnySet(check.envs...) {
			providers = append(providers, check.name)
		}
	}
	return providers
}

func detectConfiguredSearchProviders() []string {
	checks := []struct {
		name string
		envs []string
	}{
		{name: "firecrawl", envs: []string{"FIRECRAWL_API_KEY"}},
		{name: "tavily", envs: []string{"TAVILY_API_KEY"}},
		{name: "exa", envs: []string{"EXA_API_KEY"}},
		{name: "you", envs: []string{"YOU_API_KEY"}},
		{name: "jina", envs: []string{"JINA_API_KEY"}},
		{name: "bing", envs: []string{"BING_API_KEY"}},
		{name: "mojeek", envs: []string{"MOJEEK_API_KEY"}},
		{name: "linkup", envs: []string{"LINKUP_API_KEY"}},
		{name: "custom", envs: []string{"WEB_SEARCH_API", "WEB_URL_TEMPLATE", "WEB_PROVIDER"}},
		{name: "minimax-cli", envs: []string{"MINIMAX_API_KEY", "MINIMAX_OAUTH_TOKEN"}},
	}

	providers := make([]string, 0, len(checks)+1)
	for _, check := range checks {
		if envAnySet(check.envs...) {
			providers = append(providers, check.name)
		}
	}
	providers = append(providers, "duckduckgo")
	return providers
}

func detectSearchProvider() string {
	if provider := strings.TrimSpace(os.Getenv("WEB_SEARCH_PROVIDER")); provider != "" {
		return provider
	}
	return "auto"
}

func detectActiveProvider() string {
	if provider := strings.TrimSpace(os.Getenv("DUCKHIVE_PROVIDER")); provider != "" {
		return provider
	}
	if provider := strings.TrimSpace(os.Getenv("DUCK_PROVIDER")); provider != "" {
		return provider
	}

	baseURL := strings.ToLower(strings.TrimSpace(os.Getenv("OPENAI_BASE_URL")))
	openAIModel := strings.ToLower(strings.TrimSpace(os.Getenv("OPENAI_MODEL")))

	switch {
	case strings.TrimSpace(os.Getenv("GEMINI_MODEL")) != "" || envAnySet("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"):
		return "gemini"
	case strings.Contains(baseURL, "moonshot") || envAnySet("KIMI_API_KEY", "MOONSHOT_API_KEY"):
		return "kimi"
	case strings.TrimSpace(os.Getenv("MINIMAX_MODEL")) != "" || strings.Contains(openAIModel, "minimax") || envAnySet("MINIMAX_API_KEY"):
		return "minimax"
	case strings.Contains(baseURL, "localhost:1234") || strings.Contains(baseURL, "127.0.0.1:1234") || envAnySet("LMSTUDIO_API_KEY", "LM_STUDIO_API_KEY"):
		return "lmstudio"
	case strings.Contains(openAIModel, "codex"):
		return "codex"
	case strings.HasPrefix(openAIModel, "github:copilot") || os.Getenv("CLAUDE_CODE_USE_GITHUB") == "1":
		return "github"
	case strings.TrimSpace(os.Getenv("OPENAI_MODEL")) != "" || envAnySet("OPENAI_API_KEY"):
		return "openai"
	case strings.TrimSpace(os.Getenv("ANTHROPIC_MODEL")) != "" || envAnySet("ANTHROPIC_API_KEY"):
		return "anthropic"
	default:
		return "auto"
	}
}

func envAnySet(keys ...string) bool {
	for _, key := range keys {
		if strings.TrimSpace(os.Getenv(key)) != "" {
			return true
		}
	}
	return false
}

func envIsNotFalse(key string) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	return value != "0" && value != "false" && value != "no" && value != "off"
}

func formatHelp(bindings []key.Binding) string {
	parts := []string{}
	for i, binding := range bindings {
		if i >= 6 {
			break
		}
		help := binding.Help()
		if help.Key == "" || help.Desc == "" {
			continue
		}
		parts = append(parts, tui.Accent.Render(help.Key)+" "+help.Desc)
	}
	return strings.Join(parts, "  ")
}

func stripANSI(s string) string {
	inEscape := false
	var b strings.Builder
	for _, r := range s {
		if r == '\x1b' {
			inEscape = true
			continue
		}
		if inEscape {
			if r == 'm' {
				inEscape = false
			}
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func truncate(s string, max int) string {
	if max < 8 {
		return s
	}
	// Use rune count for proper multi-byte character handling (CJK, emoji)
	rs := []rune(s)
	if len(rs) <= max {
		return s
	}
	return string(rs[:max-3]) + "..."
}

func messageID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func startTimerCmd() tea.Cmd {
	return tea.Tick(time.Second, func(time.Time) tea.Msg {
		return timerTickMsg{}
	})
}

func formatElapsed(duration time.Duration) string {
	if duration < 0 {
		duration = 0
	}
	totalSeconds := int(duration.Round(time.Second) / time.Second)
	hours := totalSeconds / 3600
	minutes := (totalSeconds % 3600) / 60
	seconds := totalSeconds % 60
	if hours > 0 {
		return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
	}
	return fmt.Sprintf("%02d:%02d", minutes, seconds)
}

func formatDurationCompact(duration time.Duration) string {
	if duration <= 0 {
		return "0s"
	}
	return duration.Round(time.Millisecond).String()
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
