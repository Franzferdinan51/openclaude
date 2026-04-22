package screens

import (
	"github.com/charmbracelet/bubbletea"
	"github.com/gitlawb/duckhive/tui/model"
	"github.com/gitlawb/duckhive/tui/model/components"
)

// REPLScreen is the main chat interface.
type REPLScreen struct {
	msgList components.MessageListModel
	input   components.InputAreaModel
	width   int
	height  int
}

func NewREPLScreen() REPLScreen {
	return REPLScreen{
		msgList: components.NewMessageList(80, 20),
		input:   components.NewInputArea(80, 3),
	}
}

// Init implements tea.Model.
func (m REPLScreen) Init() tea.Cmd {
	return nil
}

// Update handles viewport scrolling and sub-component updates.
func (m *REPLScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}
	m.msgList.Update(msg)
	m.input.Update(msg)
	return m, nil
}

// View renders the REPL screen.
func (m *REPLScreen) View() string {
	return m.msgList.View() + "\n\n" + m.input.View()
}

// SetMessages replaces the message list.
func (m *REPLScreen) SetMessages(msgs []model.Message) {
	m.msgList.SetMessages(msgs)
}

// AppendMessage adds a message to the list.
func (m *REPLScreen) AppendMessage(msg model.Message) {
	m.msgList.AppendMessage(msg)
}

// StreamUpdate updates a streaming message.
func (m *REPLScreen) StreamUpdate(id, delta string) {
	m.msgList.StreamUpdate(id, delta)
}

// Finalize marks a streaming message as complete.
func (m *REPLScreen) Finalize(id string) {
	m.msgList.Finalize(id)
}