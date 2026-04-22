package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
	hasVoice            bool
	hasMedia            bool
	hasMercury          bool
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
}

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
}

func main() {
	var adapter *bridge.Adapter
	if socketPath := os.Getenv("DUCKHIVE_BRIDGE_SOCKET"); socketPath != "" {
		adapter = bridge.NewAdapter(socketPath)
	} else if bridgeCmd := os.Getenv("DUCKHIVE_BRIDGE_CMD"); bridgeCmd != "" {
		adapter = bridge.NewSubprocessAdapter(bridgeCmd)
	} else {
		fmt.Println("warning: no DUCKHIVE_BRIDGE_SOCKET or DUCKHIVE_BRIDGE_CMD set")
	}

	m := &MainModel{
		state:         model.NewAppState(),
		bridge:        adapter,
		msgList:       components.NewMessageList(80, 20),
		input:         components.NewInputArea(80, 3),
		keys:          tui.DefaultKeyMap(),
		welcome:       screens.NewWelcomeModel(),
		transcript:    screens.NewTranscriptPanel(),
		showInspector: true,
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
}

// Init implements tea.Model.
func (m *MainModel) Init() tea.Cmd {
	wd, _ := os.Getwd()
	m.state.WorkingDir = wd
	m.state.ProjectRoot = wd
	m.state.ActiveScreen = model.ScreenWelcome
	m.cap = detectWorkspaceCapabilities(wd)
	m.updateComposer()

	if m.width == 0 || m.height == 0 {
		m.width, m.height = 120, 40
	}
	m.msgList = components.NewMessageList(m.width, m.height-6)
	m.input = components.NewInputArea(m.width, 3)

	cmds := []tea.Cmd{
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
		switch m.state.ActiveScreen {
		case model.ScreenWelcome:
			_, cmd := m.welcome.Update(msg)
			return m, cmd
		case model.ScreenSettings:
			_, cmd := m.settings.Update(msg)
			return m, cmd
		}

		if m.dialog != nil {
			_, _ = m.dialog.Update(msg)
		}

		if out, consumed := tui.HandleKey(msg, m.keys, m.currentContext()); consumed {
			_, cmd := m.handleOutbound(out)
			return m, cmd
		}

		_, cmd := m.input.Update(msg)
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

	conversation := renderCard("Conversation", m.msgList.View(), mainWidth)
	composerTitle := fmt.Sprintf("Composer [%s]", m.state.InputMode.String())
	composer := renderCard(composerTitle, m.input.View(), mainWidth)
	body := lipgloss.JoinVertical(lipgloss.Left, conversation, composer)

	if railWidth > 0 {
		body = lipgloss.JoinHorizontal(lipgloss.Top, body, m.renderRail(railWidth))
	}

	return lipgloss.JoinVertical(
		lipgloss.Left,
		m.renderHeader(),
		body,
		m.renderFooter(),
	)
}

func (m *MainModel) handleBridgeMessage(msg model.InMsg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case model.MsgBridgeConnected:
		m.state.BridgeConnected = true
		m.state.StatusMsg = "bridge connected"

	case model.MsgBridgeDisconnected:
		m.state.BridgeConnected = false
		m.state.IsLoading = false
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
		d := components.NewPermissionDialog(msg.Request)
		m.dialog = &d
		m.state.StatusMsg = "permission required"

	case model.MsgCostReceived:
		m.state.TotalCostUSD += msg.Cost

	case model.MsgTokensReceived:
		m.state.TokenUsage = msg.Usage

	case model.MsgTaskStarted:
		m.state.ActiveTaskCount++

	case model.MsgTaskEnded:
		if m.state.ActiveTaskCount > 0 {
			m.state.ActiveTaskCount--
		}

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

func (m *MainModel) handleOutbound(msg model.OutMsg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case model.MsgInputSubmitted:
		return m, m.submitInput()

	case model.MsgHistoryUp:
		m.input.HistoryPrev()

	case model.MsgHistoryDown:
		m.input.HistoryNext()

	case model.MsgInterrupt:
		if m.shellRunning && m.shellCancel != nil {
			m.state.StatusMsg = "interrupting shell command"
			m.shellCancel()
			return m, nil
		}
		if m.bridge != nil {
			m.state.StatusMsg = "interrupt sent"
			return m, bridge.SendInterruptCmd(m.bridge)
		}

	case model.MsgExit:
		return m, tea.Quit

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
		m.input.Reset()

	case model.MsgConfirmYes, model.MsgConfirmNo:
		m.dialog = nil
		m.state.DialogOpen = false
		m.state.PendingPermission = nil

	case model.MsgPopDialog:
		m.dialog = nil
		m.state.DialogOpen = false
		m.state.PendingPermission = nil

	case model.MsgNavigate:
		m.state.ActiveScreen = msg.Screen
		if msg.Screen != model.ScreenREPL {
			m.state.StatusMsg = ""
		}

	case model.MsgPushDialog:
		m.state.DialogOpen = true

	case model.MsgSelectMessage:
		if msg.ID != "" {
			m.msgList.SetSelected(msg.ID)
		}

	case model.MsgModelPicker:
		m.state.ActiveScreen = model.ScreenSettings
		m.state.StatusMsg = "model presets live in settings for now"

	case model.MsgSuspend:
		m.state.StatusMsg = "suspend is not wired yet in the Go TUI"

	case model.MsgExternalEditor:
		m.state.StatusMsg = "external editor is not wired yet in the Go TUI"

	case model.MsgUndo:
		m.state.StatusMsg = "undo is not wired yet in the Go TUI"
	}

	return m, nil
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

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/zsh"
	}

	workdir := m.state.WorkingDir

	return func() tea.Msg {
		start := time.Now()
		cmd := exec.CommandContext(ctx, shell, "-lc", command)
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
		}
	}
}

func (m *MainModel) handleShellResult(msg shellCommandResultMsg) {
	m.shellRunning = false
	m.shellCancel = nil
	m.state.IsLoading = false

	status := model.ToolStatusCompleted
	if msg.err != nil {
		status = model.ToolStatusFailed
	}

	content := msg.output
	if msg.err != nil && content == "" {
		content = msg.err.Error()
	}

	m.appendMessage(model.Message{
		ID:        messageID("tool"),
		Type:      model.MsgTypeToolResult,
		Content:   content,
		Timestamp: time.Now(),
		IsError:   msg.err != nil,
		ToolCalls: []model.ToolCall{{
			Name:   "shell",
			Output: content,
			Status: status,
		}},
	})

	if msg.err != nil {
		m.state.StatusMsg = fmt.Sprintf("shell failed after %s", msg.duration.Round(time.Millisecond))
		return
	}
	m.state.StatusMsg = fmt.Sprintf("shell finished in %s", msg.duration.Round(time.Millisecond))
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
		m.input.SetPlaceholder("Run a local shell command")
	case model.InputModeCouncil:
		m.input.SetPrompt("? ")
		m.input.SetPlaceholder("Route a task through council-style deliberation")
	case model.InputModeMedia:
		m.input.SetPrompt("* ")
		m.input.SetPlaceholder("Describe image, video, speech, music, or search work")
	default:
		m.input.SetPrompt("> ")
		m.input.SetPlaceholder("Ask DuckHive to code, plan, search, or reason")
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
	title := lipgloss.JoinHorizontal(
		lipgloss.Left,
		tui.HeaderTitle.Render("DuckHive"),
		" ",
		tui.SoftBadge.Render(m.state.InputMode.String()),
	)

	rightParts := []string{
		tui.CardMuted.Render(filepath.Base(m.state.WorkingDir)),
		tui.CardMuted.Render(m.state.Model),
	}
	if m.state.TotalCostUSD > 0 {
		rightParts = append(rightParts, tui.CardMuted.Render(fmt.Sprintf("$%.4f", m.state.TotalCostUSD)))
	}
	if m.state.BridgeConnected {
		rightParts = append(rightParts, tui.GoodBadge.Render("BRIDGE"))
	} else {
		rightParts = append(rightParts, tui.WarnBadge.Render("LOCAL"))
	}
	right := strings.Join(rightParts, "  ")

	spacer := strings.Repeat(" ", maxInt(1, m.width-lipgloss.Width(title)-lipgloss.Width(right)-2))
	headline := tui.Header.Width(m.width).Render(title + spacer + right)
	subtitle := tui.CardMuted.Render("Codex + Gemini + Kimi + OpenClaw + duck-cli + MiniMax + Mercury")
	return lipgloss.JoinVertical(lipgloss.Left, headline, subtitle)
}

func (m *MainModel) renderRail(width int) string {
	sections := []string{}

	if m.transcript.IsVisible() {
		sections = append(sections, renderCard("Transcript", m.transcript.View(), width))
	}

	sections = append(sections, renderCard("Session", m.renderSessionCard(width), width))
	sections = append(sections, renderCard("Feature Merge", m.renderFeatureCard(width), width))
	if m.showInspector {
		sections = append(sections, renderCard("Tracking", m.renderTrackingCard(), width))
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
		fmt.Sprintf("mode       %s", m.state.InputMode.String()),
		fmt.Sprintf("fast       %t", m.state.IsFastMode),
		fmt.Sprintf("thinking   %t", m.state.IsThinking),
		fmt.Sprintf("bridge     %t", m.state.BridgeConnected),
		fmt.Sprintf("tasks      %d", m.state.ActiveTaskCount),
		fmt.Sprintf("checkpts   %d", m.cap.checkpointCount),
		fmt.Sprintf("docs       %s", strings.Join(instructions, ", ")),
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

func (m *MainModel) renderTrackingCard() string {
	return lipgloss.JoinVertical(
		lipgloss.Left,
		tui.CardMuted.Render("Tracked in:"),
		tui.Accent.Render("tui/TODO.md"),
		tui.Accent.Render("tui/KANBAN.md"),
		tui.Accent.Render("tui/FEATURE_MATRIX.md"),
	)
}

func (m *MainModel) renderFooter() string {
	status := m.state.StatusMsg
	if status == "" {
		status = "agent shell ready"
	}

	help := formatHelp(tui.ActiveBindings(m.keys, m.currentContext()))
	spacer := strings.Repeat(" ", maxInt(1, m.width-len(stripANSI(status))-len(stripANSI(help))-4))
	return tui.StatusBar.Width(m.width).Render(status + spacer + help)
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
			Status:  statusFromBool(m.cap.hasCouncil),
			Summary: "council-style routing, orchestration, and Android/vision specialist posture",
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
		hasVoice:            fileExists(filepath.Join(root, "src/services/voice.ts")),
		hasMedia:            fileExists(filepath.Join(root, "src/orchestrator/multi-model/multi-model-router.ts")),
		hasMercury:          true,
	}
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
	dir := filepath.Join(home, ".config", "openclaude", "checkpoints")
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

func statusFromBool(ok bool) string {
	if ok {
		return "ready"
	}
	return "later"
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
	if max < 8 || len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

func messageID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
