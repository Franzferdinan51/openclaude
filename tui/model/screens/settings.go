package screens

import (
	"fmt"

	"github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/gitlawb/duckhive/tui/model"
	"github.com/gitlawb/duckhive/tui/tui"
)

// SettingsScreen shows configuration and stats.
type SettingsScreen struct {
	state  *model.AppState
	width  int
	height int
}

func NewSettingsScreen(s *model.AppState) *SettingsScreen {
	return &SettingsScreen{state: s}
}

// Init implements tea.Model.
func (m *SettingsScreen) Init() tea.Cmd {
	return nil
}

// Update handles input for settings.
func (m *SettingsScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	case tea.KeyMsg:
		switch msg.String() {
		case "escape", "ctrl+d":
			return m, func() tea.Msg { return model.MsgNavigate{Screen: model.ScreenREPL} }
		}
	}
	return m, nil
}

// View renders the settings screen.
func (m *SettingsScreen) View() string {
	if m.width == 0 {
		m.width = 100
	}

	s := m.state
	lines := []string{
		tui.HeaderTitle.Render("Settings"),
		"",
		tui.HeaderSubtitle.Render("Model"),
		fmt.Sprintf("  Current: %s", s.Model),
		fmt.Sprintf("  Mode: %s", modeStr(s.IsFastMode)),
		fmt.Sprintf("  Composer: %s", s.InputMode.String()),
		"",
		tui.HeaderSubtitle.Render("Costs"),
		fmt.Sprintf("  Total: $%.4f", s.TotalCostUSD),
		fmt.Sprintf("  Input tokens: %d", s.TokenUsage.InputTokens),
		fmt.Sprintf("  Output tokens: %d", s.TokenUsage.OutputTokens),
		"",
		tui.HeaderSubtitle.Render("Imported Capability Goals"),
		"  Codex: repo instructions and local coding loop",
		"  Gemini: checkpoints and resume",
		"  Kimi: shell mode and ACP",
		"  OpenClaw: voice, channels, and multi-agent routing",
		"  duck-cli: council, orchestration, Android/phone workflows",
		"  MiniMax + Mercury: multimodal media, budgets, daemon posture",
		"",
		tui.HeaderSubtitle.Render("Keybindings"),
		"  ctrl+c  exit (interrupts active work first)",
		"  ctrl+x  toggle shell mode",
		"  ctrl+o  toggle transcript",
		"  ctrl+t  toggle todos",
		"  ctrl+r  search history",
		"  ctrl+p  model picker",
		"  ctrl+f  fast mode",
		"  shift+tab  cycle mode",
		"  esc  back",
		"",
		tui.DimText.Render("press esc or ctrl+d to go back"),
	}

	return lipgloss.JoinVertical(0, lines...)
}

func modeStr(fast bool) string {
	if fast {
		return "fast (speculative)"
	}
	return "standard"
}
