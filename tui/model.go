package tui

import (
	"time"

	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

// MessageType distinguishes user, assistant, system, tool.
type MessageType int

const (
	MsgTypeUser       MessageType = iota
	MsgTypeAssistant
	MsgTypeSystem
	MsgTypeToolUse
	MsgTypeToolResult
	MsgTypeProgress
)

// Message represents a single message in the conversation.
type Message struct {
	ID        string
	Type      MessageType
	Content   string
	Timestamp time.Time
	Model     string // e.g. "claude-opus-4.6"
	ToolName  string // for tool_use messages
	IsStreaming bool
	IsError   bool
}

// AppContext is the active keybinding context.
type AppContext int

const (
	CtxGlobal AppContext = iota
	CtxChat
	CtxAutocomplete
	CtxConfirmation
	CtxSettings
	CtxSelect
)

// ToolDisplayMode controls how tool calls are rendered.
type ToolDisplayMode int

const (
	ToolDisplayGrouped  ToolDisplayMode = iota // bold label + full content (default)
	ToolDisplayEmoji                           // ⚡ tool_name → ✓/✗ result with timing
	ToolDisplayMinimal                         // → ran tool_name inline
	ToolDisplayHidden                          // suppress tool output entirely
)

// InputStyle controls the appearance of the input area.
type InputStyle int

const (
	InputStylePlain    InputStyle = iota // simple prompt (default)
	InputStyleBordered                   // ─ lines above/below
	InputStyleBlock                     // full-width background box
)

// Model is the main Bubble Tea model for DuckHive.
type Model struct {
	// Messages
	messages []Message
	viewport viewport.Model

	// Input
	input textinput.Model

	// UI state
	ctx           AppContext
	spinner       spinner.Model
	isLoading     bool
	isStreaming   bool
	isSuspended   bool
	width         int
	height        int

	// Session
	sessionId  string
	modelName  string
	totalCost  float64

	// Display preferences
	toolDisplay ToolDisplayMode
	inputStyle  InputStyle

	// Pending confirmations / dialogs
	pendingConfirmation bool
	confirmationMsg     string
	onConfirm           func(bool)
}

// NewModel creates a fresh DuckHive TUI model.
func NewModel(width, height int) *Model {
	sp := spinner.New(spinner.WithSpinner(spinner.Dot))
	sp.Style = Styles.Spinner

	ti := textinput.New()
	ti.Prompt = "> "
	ti.Placeholder = "Ask DuckHive..."
	ti.Focus()
	ti.TextStyle = Styles.InputField

	vp := viewport.New(width, height-StatusHeight-InputHeight)
	vp.Style = Styles.MessageArea

	return &Model{
		messages:   []Message{},
		viewport:   vp,
		input:      ti,
		ctx:        CtxChat,
		spinner:    sp,
		isLoading:  false,
		width:      width,
		height:     height,
		modelName:   "claude-opus-4.6",
		sessionId:   "",
		toolDisplay: ToolDisplayGrouped,
		inputStyle:  InputStylePlain,
	}
}

// ToolDisplayModeToString converts a ToolDisplayMode to a display string.
func ToolDisplayModeToString(m ToolDisplayMode) string {
	switch m {
	case ToolDisplayGrouped:
		return "grouped"
	case ToolDisplayEmoji:
		return "emoji"
	case ToolDisplayMinimal:
		return "minimal"
	case ToolDisplayHidden:
		return "hidden"
	default:
		return "grouped"
	}
}

// InputStyleToString converts an InputStyle to a display string.
func InputStyleToString(s InputStyle) string {
	switch s {
	case InputStylePlain:
		return "plain"
	case InputStyleBordered:
		return "bordered"
	case InputStyleBlock:
		return "block"
	default:
		return "plain"
	}
}

// MaxMessages is the maximum number of messages to keep in the TUI history.
// When exceeded, the oldest non-system messages are dropped to prevent OOM
// on long-running heavy sessions. System and user messages are preserved.
const MaxMessages = 500

// AddMessage appends a message to the list.
// Truncates oldest non-essential messages if MaxMessages is exceeded.
func (m *Model) AddMessage(msg Message) {
	m.messages = append(m.messages, msg)

	// Safety cap: prevent unbounded growth on very long sessions.
	// Keep the most recent MaxMessages; drop oldest user/assistant/tool
	// messages but always preserve system messages.
	if len(m.messages) > MaxMessages {
		m.truncateMessages()
	}
}

// truncateMessages removes old user/assistant/tool messages beyond MaxMessages,
// preserving all system messages and the most recent messages of other types.
func (m *Model) truncateMessages() {
	if len(m.messages) <= MaxMessages {
		return
	}

	// Always keep system messages; find the cutoff index so total <= MaxMessages
	// by dropping the oldest non-system messages first.
	var systemMsgs []Message
	var otherMsgs []Message
	for _, msg := range m.messages {
		if msg.Type == MsgTypeSystem {
			systemMsgs = append(systemMsgs, msg)
		} else {
			otherMsgs = append(otherMsgs, msg)
		}
	}

	// Keep at most MaxMessages total: keep all systems + newest others
	keepOthers := MaxMessages - len(systemMsgs)
	if keepOthers < 0 {
		keepOthers = 0
	}
	if keepOthers >= len(otherMsgs) {
		m.messages = append(systemMsgs, otherMsgs...)
	} else {
		// Keep the newest `keepOthers` messages
		m.messages = append(systemMsgs, otherMsgs[len(otherMsgs)-keepOthers:]...)
	}
}

// AddStreamingMessage adds or updates a streaming message.
func (m *Model) AddStreamingMessage(id, content string, msgType MessageType) {
	for i := range m.messages {
		if m.messages[i].ID == id {
			m.messages[i].Content = content
			return
		}
	}
	m.AddMessage(Message{
		ID:          id,
		Type:        msgType,
		Content:     content,
		Timestamp:   time.Now(),
		IsStreaming: true,
	})
}

// FinalizeMessage marks a streaming message as complete.
func (m *Model) FinalizeMessage(id string) {
	for i := range m.messages {
		if m.messages[i].ID == id {
			m.messages[i].IsStreaming = false
			return
		}
	}
}

// Init is called once at startup.
func (m *Model) Init() tea.Cmd {
	return func() tea.Msg { return m.spinner.Tick() }
}
