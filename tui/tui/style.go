package tui

import (
	"github.com/charmbracelet/lipgloss"
)

// Style definitions for all DuckHive TUI components.
// Keep this terminal-first: restrained chrome, no full-screen painted backdrop.

var (
	// Base
	ColorBG       = lipgloss.Color("#0F1115")
	ColorSurface  = lipgloss.Color("#151820")
	ColorSurface2 = lipgloss.Color("#1A1F29")
	ColorBorder   = lipgloss.Color("#303640")
	ColorText     = lipgloss.Color("#E7EAF0")
	ColorDim      = lipgloss.Color("#68707D")
	ColorMuted    = lipgloss.Color("#A5ADBA")

	// Brand
	ColorAccent = lipgloss.Color("#D6A84F")
	ColorDuck   = lipgloss.Color("#75B99C")

	// Semantic
	ColorError    = lipgloss.Color("#F87171")
	ColorSuccess  = lipgloss.Color("#6FD3A3")
	ColorThinking = lipgloss.Color("#C8A7FF")
	ColorWarning  = lipgloss.Color("#F3B33D")

	// Header / footer
	ColorHeaderBG = lipgloss.Color("#11141A")

	// Message bubbles
	ColorUserBubble  = ColorSurface2
	ColorAssistantBG = ColorSurface
	ColorSystemBG    = ColorSurface
	ColorToolBG      = ColorSurface2
)

// Header renders the top bar with logo, session info, and model name.
var Header = lipgloss.NewStyle().
	Foreground(ColorText).
	Padding(0, 1)

var HeaderTitle = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Bold(true)

var HeaderSubtitle = lipgloss.NewStyle().
	Foreground(ColorMuted)

// MessageArea is the scrollable viewport background.
var MessageArea = lipgloss.NewStyle().
	Foreground(ColorText).
	Padding(0, 1)

// UserBubble renders user messages.
var UserBubble = lipgloss.NewStyle().
	Foreground(lipgloss.Color("#F3F4F6")).
	Bold(true)

// AssistantBubble renders assistant messages.
var AssistantBubble = lipgloss.NewStyle().
	Foreground(ColorText)

// SystemBubble renders system messages centered/italic.
var SystemBubble = lipgloss.NewStyle().
	Foreground(ColorMuted).
	Italic(true)

// ToolBubble renders tool call messages.
var ToolBubble = lipgloss.NewStyle().
	Foreground(lipgloss.Color("#B8C0C8"))

// ProgressLine renders inline progress text.
var ProgressLine = lipgloss.NewStyle().
	Foreground(ColorDim).
	Italic(true)

// InputArea is the background behind the text input.
var InputArea = lipgloss.NewStyle().
	Foreground(ColorText).
	Padding(0, 0)

// InputField is the actual text input border/prompt area.
var InputField = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Border(lipgloss.NormalBorder()).
	BorderForeground(ColorBorder).
	Padding(0, 1)

// StatusBar is the bottom footer.
var StatusBar = lipgloss.NewStyle().
	Foreground(ColorMuted).
	Padding(0, 1)

var Card = lipgloss.NewStyle().
	Border(lipgloss.NormalBorder()).
	BorderForeground(ColorBorder).
	Padding(0, 1)

var CardTitle = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Bold(true)

var CardMuted = lipgloss.NewStyle().
	Foreground(ColorMuted)

var GoodBadge = lipgloss.NewStyle().
	Foreground(ColorSuccess).
	Padding(0, 1).
	Bold(true)

var WarnBadge = lipgloss.NewStyle().
	Foreground(ColorWarning).
	Padding(0, 1).
	Bold(true)

var SoftBadge = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Padding(0, 1)

var MainPane = lipgloss.NewStyle().
	Padding(0, 1, 1, 1)

var ComposerFrame = lipgloss.NewStyle().
	Border(lipgloss.NormalBorder()).
	BorderForeground(ColorBorder).
	Padding(0, 1)

var ModePill = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Padding(0, 1).
	Bold(true)

var MetaPill = lipgloss.NewStyle().
	Foreground(ColorMuted).
	Padding(0, 1)

var PillActive = lipgloss.NewStyle().
	Foreground(ColorDuck).
	Padding(0, 1).
	Bold(true)

var PillOk = lipgloss.NewStyle().
	Foreground(ColorSuccess).
	Padding(0, 1).
	Bold(true)

var PillWarn = lipgloss.NewStyle().
	Foreground(ColorWarning).
	Padding(0, 1).
	Bold(true)

var PillMuted = lipgloss.NewStyle().
	Foreground(ColorMuted).
	Border(lipgloss.NormalBorder()).
	BorderForeground(ColorBorder).
	Padding(0, 1)

var EmptyCard = lipgloss.NewStyle().
	Border(lipgloss.NormalBorder()).
	BorderForeground(ColorBorder).
	Padding(1, 1)

var SideCard = lipgloss.NewStyle().
	Border(lipgloss.NormalBorder()).
	BorderForeground(ColorBorder).
	Padding(1, 1)

var EmptyTitle = lipgloss.NewStyle().
	Foreground(ColorText).
	Bold(true)

var HeroTitle = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Bold(true)

var EmptyBody = lipgloss.NewStyle().
	Foreground(ColorMuted)

var SectionTitle = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Bold(true)

var EmptyItem = lipgloss.NewStyle().
	Foreground(ColorText)

var MessageLabelUser = lipgloss.NewStyle().
	Foreground(ColorMuted)

var MessageLabelAssistant = lipgloss.NewStyle().
	Foreground(ColorDuck)

var MessageLabelSystem = lipgloss.NewStyle().
	Foreground(ColorDim)

var MessageBody = lipgloss.NewStyle().
	Foreground(ColorText).
	PaddingLeft(1)

var ToolHeaderPending = lipgloss.NewStyle().
	Foreground(ColorWarning).
	Bold(true)

var ToolHeaderSuccess = lipgloss.NewStyle().
	Foreground(ColorSuccess).
	Bold(true)

var ToolHeaderError = lipgloss.NewStyle().
	Foreground(ColorError).
	Bold(true)

var ToolBody = lipgloss.NewStyle().
	Foreground(ColorMuted).
	Border(lipgloss.NormalBorder(), false, false, false, true).
	BorderForeground(ColorBorder).
	PaddingLeft(1)

var SpinnerStyle = lipgloss.NewStyle().
	Foreground(ColorAccent)

var ErrorText = lipgloss.NewStyle().
	Foreground(ColorError)

var DimText = lipgloss.NewStyle().
	Foreground(ColorDim)

// Dialog is a centered overlay panel.
var Dialog = lipgloss.NewStyle().
	Border(lipgloss.NormalBorder()).
	BorderForeground(ColorAccent).
	Padding(2, 4).
	MarginTop(4).
	Width(MaxWidth - 20).
	Align(lipgloss.Center)

var DialogTitle = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Bold(true)

var DialogBody = lipgloss.NewStyle().
	Foreground(ColorText).
	MarginTop(1)

var HelpText = lipgloss.NewStyle().
	Foreground(ColorDim).
	Padding(0, 2)

var ModeIndicator = lipgloss.NewStyle().
	Foreground(ColorAccent).
	Bold(true)

// Accent is a reusable accent color style.
var Accent = lipgloss.NewStyle().
	Foreground(ColorAccent)

const MaxWidth = 80
