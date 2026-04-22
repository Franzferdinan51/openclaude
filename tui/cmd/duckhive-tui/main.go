package main

import (
	"fmt"
	"os"

	"github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/gitlawb/duckhive/tui/model"
	"github.com/gitlawb/duckhive/tui/model/bridge"
	"github.com/gitlawb/duckhive/tui/model/components"
	"github.com/gitlawb/duckhive/tui/model/screens"
	"github.com/gitlawb/duckhive/tui/tui"
)

// MainModel is the root tea.Model that coordinates all sub-components.
// It dispatches between screens (Welcome, REPL, Settings) and panels (Transcript).
type MainModel struct {
	state          model.AppState
	bridge         *bridge.Adapter
	msgList        components.MessageListModel
	input          components.InputAreaModel
	dialog         *components.DialogModel
	transcript     *screens.TranscriptPanel
	welcome        screens.WelcomeModel
	repl           screens.REPLScreen
	settings       *screens.SettingsScreen
	keys           tui.KeyMap
	width          int
	height         int
	footer         string
	showTranscript bool
	showTodos      bool
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
		state:      model.NewAppState(),
		bridge:     adapter,
		msgList:    components.NewMessageList(80, 20),
		input:      components.NewInputArea(80, 3),
		keys:       tui.DefaultKeyMap(),
		welcome:    screens.NewWelcomeModel(),
		repl:       screens.NewREPLScreen(),
		transcript: screens.NewTranscriptPanel(),
		settings:   screens.NewSettingsScreen(&model.AppState{}),
	}

	m.input.SetSubmitFn(func(text string) {
		msg := model.Message{
			Type:    model.MsgTypeUser,
			Content: text,
		}
		m.state.Messages = append(m.state.Messages, msg)
		m.msgList.AppendMessage(msg)
		m.state.InputHistory = append(m.state.InputHistory, text)
		m.input.SetHistory(m.state.InputHistory)
		m.transcript.SetMessages(m.state.Messages)
		if m.bridge != nil {
			bridge.SendUserMessageCmd(m.bridge, text)
		}
	})

	p := tea.NewProgram(m,
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
	m.state.WorkingDir, _ = os.Getwd()
	m.state.ProjectRoot = os.Getenv("PWD")
	m.state.ActiveScreen = model.ScreenWelcome

	var cmds []tea.Cmd
	cmds = append(cmds, m.msgList.Init())
	cmds = append(cmds, m.input.Init())
	cmds = append(cmds, m.welcome.Init())
	cmds = append(cmds, m.repl.Init())
	cmds = append(cmds, m.transcript.Init())
	cmds = append(cmds, m.settings.Init())
	if m.bridge != nil {
		cmds = append(cmds, m.bridge.Start())
	}
	return tea.Batch(cmds...)
}

// Update implements tea.Model.
func (m *MainModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.msgList.Update(msg)
		m.input.Update(msg)
		m.transcript.Update(msg)

	case tea.KeyMsg:
		out, consumed := tui.HandleKey(msg, m.keys, m.currentContext())
		if consumed && out != nil {
			_, cmd := m.handleOutbound(out)
			return m, cmd
		}

	case model.InMsg:
		return m.handleBridgeMessage(msg)

	case model.OutMsg:
		return m.handleOutbound(msg)
	}

	m.msgList.Update(msg)
	m.input.Update(msg)
	return m, nil
}

// View implements tea.Model.
func (m *MainModel) View() string {
	if m.width == 0 || m.height == 0 {
		return "loading..."
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
	var statusParts []string
	if m.state.IsThinking {
		statusParts = append(statusParts, tui.Accent.Render("thinking"))
	}
	if m.state.IsLoading {
		statusParts = append(statusParts, tui.Accent.Render("working"))
	}
	if m.state.TotalCostUSD > 0 {
		statusParts = append(statusParts, fmt.Sprintf("$%.4f", m.state.TotalCostUSD))
	}
	if m.state.BridgeConnected {
		statusParts = append(statusParts, tui.Accent.Render("●"))
	} else {
		statusParts = append(statusParts, tui.DimText.Render("○"))
	}

	statusBar := tui.StatusBar.Render(
		m.state.WorkingDir + " | " + m.state.Model + "  " +
			lipgloss.JoinHorizontal(0, statusParts...) + "  " +
			tui.DimText.Render("ctrl+c interrupt  ctrl+o transcript  ctrl+t todos"),
	)

	content := m.msgList.View() + "\n\n" + m.input.View()

	if m.dialog != nil {
		content += "\n" + m.dialog.View()
	}

	if m.transcript.IsVisible() {
		content += "\n\n" + m.transcript.View()
	}

	return tui.Header.Render("DuckHive") + "\n\n" + content + "\n" + statusBar
}

func (m *MainModel) handleBridgeMessage(msg model.InMsg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case model.MsgBridgeConnected:
		m.state.BridgeConnected = true
	case model.MsgBridgeDisconnected:
		m.state.BridgeConnected = false
	case model.MsgMessageReceived:
		m.msgList.AppendMessage(msg.Message)
		m.state.Messages = append(m.state.Messages, msg.Message)
		m.transcript.SetMessages(m.state.Messages)
		m.repl.AppendMessage(msg.Message)
	case model.MsgStreamDelta:
		m.msgList.StreamUpdate(msg.MessageID, msg.Delta)
		m.repl.StreamUpdate(msg.MessageID, msg.Delta)
	case model.MsgStreamEnd:
		m.msgList.Finalize(msg.MessageID)
		m.repl.Finalize(msg.MessageID)
	case model.MsgThinkingStarted:
		m.state.IsThinking = true
	case model.MsgThinkingEnded:
		m.state.IsThinking = false
	case model.MsgCostReceived:
		m.state.TotalCostUSD += msg.Cost
	case model.MsgTokensReceived:
		m.state.TokenUsage = msg.Usage
	case model.MsgError:
		m.state.StatusMsg = msg.Err.Error()
	case model.MsgPermissionRequest:
		m.state.PendingPermission = &msg.Request
		m.state.DialogOpen = true
		d := components.NewPermissionDialog(msg.Request)
		m.dialog = &d
	}
	return m, nil
}

func (m *MainModel) handleOutbound(msg model.OutMsg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case model.MsgInterrupt:
		if m.bridge != nil {
			return m, bridge.SendInterruptCmd(m.bridge)
		}
	case model.MsgExit:
		return m, tea.Quit
	case model.MsgRedraw:
		return m, nil
	case model.MsgToggleTranscript:
		m.transcript.Toggle()
	case model.MsgToggleTodos:
		m.showTodos = !m.showTodos
	case model.MsgToggleFastMode:
		m.state.IsFastMode = !m.state.IsFastMode
	case model.MsgPageUp:
		m.msgList.ScrollUp(10)
	case model.MsgPageDown:
		m.msgList.ScrollDown(10)
	case model.MsgCancelInput:
		m.input.SetValue("")
	case model.MsgConfirmYes, model.MsgConfirmNo:
		m.dialog = nil
		m.state.DialogOpen = false
	case model.MsgPopDialog:
		m.dialog = nil
		m.state.DialogOpen = false
	case model.MsgNavigate:
		m.state.ActiveScreen = msg.Screen
	case model.MsgPushDialog:
		m.state.DialogOpen = true
	case model.MsgSelectMessage:
		m.msgList.SetSelected(msg.ID)
	case model.MsgModelPicker:
		m.state.ActiveScreen = model.ScreenModelPicker
	}
	return m, nil
}

// currentContext returns the active keybinding context string.
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