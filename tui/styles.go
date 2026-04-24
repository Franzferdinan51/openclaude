package tui

import (
	"github.com/charmbracelet/lipgloss"
)

var Styles = struct {
	Header           lipgloss.Style
	HeaderTitle      lipgloss.Style
	HeaderSubtitle   lipgloss.Style
	MessageArea      lipgloss.Style
	UserBubble       lipgloss.Style
	AssistantBubble  lipgloss.Style
	SystemBubble     lipgloss.Style
	ToolBubble       lipgloss.Style
	InputArea        lipgloss.Style
	InputField       lipgloss.Style
	StatusBar        lipgloss.Style
	Spinner          lipgloss.Style
	ErrorText        lipgloss.Style
	DimText          lipgloss.Style
	Border           lipgloss.Style
	MutedBorder      lipgloss.Style
	Footer           lipgloss.Style
	HelpText         lipgloss.Style
	ModeIndicator    lipgloss.Style
	// New: tool display modes
	ToolEmojiOK    lipgloss.Style
	ToolEmojiFail  lipgloss.Style
	ToolEmojiHeader lipgloss.Style
	// New: input area styles
	InputBordered lipgloss.Style
	InputBlock    lipgloss.Style
	// New: banner
	BannerAccent lipgloss.Style
	BannerMuted  lipgloss.Style
	// New: loader
	WorkingDots lipgloss.Style
	// New: slash command help
	HelpCmd  lipgloss.Style
	HelpDesc lipgloss.Style
	CostInfo lipgloss.Style
}{
	Header: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FAFAFA")).
		Background(lipgloss.Color("#1A1A2E")).
		Padding(0, 1),

	HeaderTitle: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFCB6B")).
		Bold(true),

	HeaderSubtitle: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#8792A6")),

	MessageArea: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#E0E0E0")).
		Padding(1, 2),

	UserBubble: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FAFAFA")).
		Background(lipgloss.Color("#2D5A8A")).
		Padding(0, 1).
		MarginLeft(4),

	AssistantBubble: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#E0E0E0")).
		Background(lipgloss.Color("#1E1E2E")).
		Padding(0, 1).
		MarginRight(4),

	SystemBubble: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#8792A6")).
		Background(lipgloss.Color("#1A1A2E")).
		Padding(0, 1).
		Italic(true),

	ToolBubble: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#A6ACCD")).
		Background(lipgloss.Color("#252535")).
		Padding(0, 1),

	InputArea: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FAFAFA")).
		Background(lipgloss.Color("#16161E")).
		Padding(1, 2),

	InputField: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FAFAFA")).
		Background(lipgloss.Color("#252535")).
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("#3D3D5C")).
		Padding(0, 1),

	StatusBar: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#8792A6")).
		Background(lipgloss.Color("#1A1A2E")).
		Padding(0, 2),

	Spinner: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFCB6B")),

	ErrorText: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FF5370")),

	DimText: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#4A4A6A")),

	// Tool display modes
	ToolEmojiOK: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6FD3A3")).
		Bold(true),

	ToolEmojiFail: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FF5370")).
		Bold(true),

	ToolEmojiHeader: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFCB6B")).
		Bold(true),

	// Input area styles
	InputBordered: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FAFAFA")).
		Background(lipgloss.Color("#252535")).
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("#3D3D5C")).
		Padding(0, 1),

	InputBlock: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FAFAFA")).
		Background(lipgloss.Color("#252535")).
		Width(MaxWidth).
		Padding(0, 2),

	// Banner styles
	BannerAccent: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#F3B33D")).
		Bold(true),

	BannerMuted: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#8792A6")),

	// Loader animation
	WorkingDots: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFCB6B")).
		Italic(true),

	// Slash command help
	HelpCmd: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFCB6B")),

	HelpDesc: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#8792A6")),

	CostInfo: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6FD3A3")).
		Bold(true),

	Border: lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("#3D3D5C")),

	MutedBorder: lipgloss.NewStyle(),

	Footer: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#4A4A6A")).
		Padding(0, 2),

	HelpText: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#4A4A6A")),

	ModeIndicator: lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFCB6B")).
		Bold(true),
}

const (
	MaxWidth     = 80
	InputHeight  = 3
	StatusHeight = 1
)
