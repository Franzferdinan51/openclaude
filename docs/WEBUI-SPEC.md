# DuckHive WebUI Specification

**Project:** DuckHive — Merged WebUI Design
**Author:** DuckBot Research Sub-Agent
**Date:** 2026-05-09
**Status:** Draft v1.0

---

## 1. Design Concept

### Visual Identity
- **Name:** DuckHive WebUI ("Hive Control")
- **Philosophy:** Desktop-class agent command center — professional, dense-but-readable, built for power users
- **Theme:** Dark-first, high-contrast. Inspired by Codex Desktop + OpenClaw's `claw` theme
- **Personality:** Sharp, technical, efficient. Not soft or consumer-friendly — this is a control room.

### Color Palette
```
Background (deep):    #0d0d12  (near-black, slight blue tint)
Background (panel):   #14141b  (elevated surfaces)
Background (hover):   #1c1c26
Border:              #2a2a3a
Primary accent:       #FFD700  (gold — Duck CLI brand)
Secondary accent:    #00d4ff  (cyan — agent/AI indicators)
Success:             #22c55e
Warning:             #f59e0b
Error:               #ef4444
Text primary:         #f0f0f5
Text secondary:       #8888a0
Text dim:            #555566
```

### Typography
- **Font:** `JetBrains Mono` (monospace) for code/terminal — distinctive, readable
- **Font:** `Inter` or `SF Pro` for UI labels — clean, system-like
- **Font size:** Compact — 13px base for dense information display
- **Line height:** Tight (1.4) for data-heavy panels

### Layout Model
Three-column layout ( Codex-inspired, with OpenClaw's settings refinement):

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER: Logo · Status · Model selector · Theme toggle        │
├────────────┬─────────────────────────────┬────────────────────┤
│  SIDEBAR   │       MAIN AREA             │   RIGHT PANEL      │
│  (220px)   │   (flex: 1)                │   (320px, toggle)  │
│            │                             │                    │
│  • Agents  │   ┌─────────────────────┐   │  • Tools          │
│  • Tasks   │   │  Chat / Terminal    │   │  • MCP Servers    │
│  • Teams   │   │                     │   │  • Agent Status   │
│  • Sessions│   │                     │   │  • Memory         │
│  • Files   │   │                     │   │                   │
│  • Settings│   └─────────────────────┘   │                   │
│            │   ┌─────────────────────┐   │                   │
│            │   │  INPUT BAR          │   │                   │
└────────────┴───┴─────────────────────────┴───┴─────────────────┘
```

### Motion & Interaction
- **Transitions:** 150ms ease-out for panel toggles (fast, not distracting)
- **Hover states:** Subtle background shift (#1c1c26), no bouncing
- **Loading states:** Pulsing dots, not spinners — matches the terminal aesthetic
- **No excess animation** — this is a command center, not a marketing page

---

## 2. Key Features

### 2.1 Agent Management (from DuckHive)
- **Agents List Panel** — Browse, select, create agents
- **Agent Detail View** — See tools, model, memory scope, color
- **Agent Editor** — Change model, tools, color (color picker)
- **Built-in vs Custom vs Plugin** — Grouped by source with visual distinction

### 2.2 Session Management (from Codex + OpenClaw)
- **Session Tabs** — Multiple concurrent chat sessions (like browser tabs)
- **Session History** — Search past conversations (OpenClaw's history dialog pattern)
- **Session Preview** — Compact summary of each session in the sidebar
- **Resume / Interrupt** — Ability to pause and resume long tasks

### 2.3 Chat Interface (from OpenClaw)
- **Message Types:** User text, assistant text, tool use, thinking, error, system
- **Markdown Rendering** — Full markdown with syntax highlighting
- **Streaming** — Real-time token streaming display
- **Attachment Support** — Images, files dropped into chat
- **Code Blocks** — Syntax-highlighted, copyable

### 2.4 Terminal / REPL (from DuckHive + Codex)
- **Integrated Terminal** — Bash command input with output
- **Background Task Monitor** — See running processes
- **Shell Progress Indicators** — Real-time command progress
- **tmux-aware** — Shows when running inside tmux

### 2.5 Teams & Teammates (from DuckHive)
- **Team Status** — Footer indicator showing teammate count
- **Teams Dialog** — View all teams and their members
- **Teammate Detail** — Per-member status, activity, mode
- **Multi-Agent Orchestration** — Spawn/manage teammates

### 2.6 Task & Background Jobs (from DuckHive)
- **Task List** — All active background tasks
- **Task Progress** — Per-task progress with tool activity
- **Dream Tasks** — Long-running autonomous tasks (KAIROS integration)
- **Local/Remote distinction** — Visual indicator for local vs remote tasks

### 2.7 MCP Server Management (from DuckHive)
- **MCP List Panel** — All configured MCP servers
- **Tool Browser** — Browse tools available via MCP
- **Server Status** — Connected/disconnected state per server
- **Add/Edit/Remove servers** — Full CRUD dialog

### 2.8 File Browser (from Codex Desktop)
- **Directory Tree** — Sidebar file browser
- **File Preview** — Read files without leaving the UI
- **Open in Editor** — Launch local editor for file editing
- **Git integration** — Branch, commit, status indicators

### 2.9 Settings & Preferences (from OpenClaw)
- **Theme Picker** — `claw` (default), `knot`, `dash` with light/dark variants
- **Provider Manager** — Configure API keys and model providers
- **Permission Mode** — Auto-approve, ask, deny patterns
- **Keybindings** — View and customize shortcuts
- **Cost Tracking** — Per-session and aggregate cost display

---

## 3. Component Breakdown

### Header Bar
- Logo + app name ("DuckHive")
- Agent selector dropdown
- Active model badge
- Theme toggle (dark/light)
- Settings gear icon
- Connection status indicator

### Sidebar (left, 220px)
```
[DuckHive]
──────────
◈ Chat
◈ Agents
◈ Tasks
◈ Teams
◈ Files
◈ MCP
──────────
◈ History
◈ Settings
```

- Collapsible to icon-only mode (48px)
- Active item: gold left border (#FFD700)
- Hover: subtle bg shift

### Main Area
**Tab bar** (if multiple sessions):
- Session tab + close button
- "+" to start new session

**Message list:**
- Auto-scroll to bottom on new messages
- Load more on scroll up (pagination)
- Date separators between days
- Thinking blocks collapsible

**Input bar:**
- Textarea with markdown support
- Send button (gold accent)
- Attachment button (paperclip)
- Models dropdown (select which model to use)
- Keyboard shortcut hint (Cmd+Enter to send)

### Right Panel (320px, toggleable)
Four tabs:
1. **Tools** — Available tools, search/filter
2. **Agents** — Agent status, switch active agent
3. **MCP** — Server list, tool browser
4. **Memory** — Memory file selector, recent recalls

### Dialogs
- **Global Search** (Cmd+K) — Search all sessions, agents, tools
- **Agent Editor** — Full agent configuration
- **Teams Dialog** — Team and teammate management
- **MCP Server Dialog** — Add/edit MCP servers
- **Settings Dialog** — All preferences

---

## 4. Technical Approach

### Stack
- **Framework:** React 18 + TypeScript (strict mode)
- **Build:** Vite
- **Styling:** CSS Modules + CSS custom properties (theme variables)
- **State:** React Context + `useReducer` for app state (OpenClaw pattern)
- **Routing:** React Router (session tabs as routes)
- **Markdown:** `react-markdown` + `highlight.js` for code blocks
- **Icons:** Lucide React (consistent, minimal)
- **Fonts:** Google Fonts (JetBrains Mono, Inter)

### File Structure
```
web/
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   ├── theme.css          # CSS variables for claw/knot/dash themes
│   │   ├── global.css
│   │   └── components/       # Per-component CSS modules
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── RightPanel.tsx
│   │   │   └── MainArea.tsx
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── Message.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── TypingIndicator.tsx
│   │   ├── agents/
│   │   │   ├── AgentsList.tsx
│   │   │   ├── AgentDetail.tsx
│   │   │   └── AgentEditor.tsx
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx
│   │   │   └── TaskItem.tsx
│   │   ├── teams/
│   │   │   ├── TeamsDialog.tsx
│   │   │   └── TeamStatus.tsx
│   │   ├── mcp/
│   │   │   ├── MCPServerList.tsx
│   │   │   └── MCPToolBrowser.tsx
│   │   └── shared/
│   │       ├── Dialog.tsx
│   │       ├── Tabs.tsx
│   │       └── ThemeProvider.tsx
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useAgents.ts
│   │   └── useTheme.ts
│   ├── services/
│   │   ├── api.ts            # Backend communication
│   │   └── websocket.ts      # Real-time updates
│   └── types/
│       └── index.ts
├── vite.config.ts
└── package.json
```

### Backend Communication
- **HTTP REST** for stateless requests (agents, tasks, settings)
  - Base URL: `http://localhost:3017` by default via `VITE_DUCKHIVE_API_BASE`
  - The API is DuckHive-owned; `OPENCLAW_GATEWAY_URL` is optional status/diagnostics input only.
- **WebSocket** for streaming chat responses and real-time task updates
- **SSE** as fallback for streaming (simpler than WebSocket)

### Integration Points
| Feature | Source | Integration |
|---------|--------|-------------|
| Agent list/detail | DuckHive `src/components/agents/` | Port to React, adapt from Ink to DOM |
| Task/background jobs | DuckHive `src/components/tasks/` | Same pattern |
| Teams dialog | DuckHive `src/components/teams/` | Same pattern |
| MCP management | DuckHive `src/components/mcp/` | Same pattern |
| Chat messages | DuckHive WebUI API (`localhost:3017`) | Register chat requests in AgentRun and mirror events |
| Theme system | OpenClaw WebUI (claw/knot/dash) | Adopt CSS variable approach |
| Session management | OpenClaw WebUI | Implement tabs/routing for sessions |
| Settings/provider config | OpenClaw WebUI | Adopt provider manager UI |

### API Endpoints (Expected)
```
GET    /api/agents              → list all agents
GET    /api/agents/:id          → agent detail
POST   /api/agents              → create agent
PUT    /api/agents/:id          → update agent

GET    /api/sessions            → list sessions
GET    /api/sessions/:id        → session messages
POST   /api/sessions            → create new session
DELETE /api/sessions/:id        → close session

GET    /api/tasks               → list background tasks
GET    /api/tasks/:id           → task detail

GET    /api/teams               → list teams
GET    /api/mcp/servers         → list MCP servers

POST   /api/chat/completions    → send message (streaming)
GET    /api/status              → system/agent status

WS     /ws/stream              → real-time streaming
```

### Theme System (CSS Variables)
```css
[data-theme="claw:dark"] {
  --bg-deep: #0d0d12;
  --bg-panel: #14141b;
  --bg-hover: #1c1c26;
  --border: #2a2a3a;
  --accent: #FFD700;
  --accent-secondary: #00d4ff;
  --text-primary: #f0f0f5;
  --text-secondary: #8888a0;
  --text-dim: #555566;
}
```

### Responsive Strategy
- **Desktop-first** (minimum 1024px width)
- **Tablet (768-1023px):** Right panel collapses to slide-out drawer
- **Mobile (<768px):** Single-column, sidebar becomes hamburger menu
- No mobile app needed — this is a desktop power tool

---

## 5. Phased Implementation Plan

### Phase 1: Core Shell
- [ ] Vite + React + TypeScript setup
- [ ] Layout components (Header, Sidebar, MainArea, RightPanel)
- [ ] Theme CSS variables (claw dark theme)
- [ ] Basic routing (single session for now)

### Phase 2: Chat Interface
- [ ] Message rendering (user, assistant, tool use)
- [ ] Input bar with send
- [ ] Markdown rendering
- [ ] WebSocket connection to backend
- [ ] Streaming response display

### Phase 3: Agent & Task Panels
- [ ] Agent list and selection
- [ ] Agent detail sidebar
- [ ] Task list panel
- [ ] MCP server panel
- [ ] Right panel tab navigation

### Phase 4: Sessions & History
- [ ] Multi-session tab bar
- [ ] Session history search
- [ ] Resume session
- [ ] Session switching

### Phase 5: Advanced Features
- [ ] File browser
- [ ] Teams dialog
- [ ] Global search (Cmd+K)
- [ ] Settings dialog
- [ ] Full theme picker (claw/knot/dash + light/dark)

---

## 6. Design Inspiration

| Reference | What to Borrow |
|-----------|---------------|
| Codex Desktop app | Session tabs, file browser, terminal integration, dense professional layout |
| OpenClaw WebUI | Theme concepts, settings/dialog patterns, permission-mode inspiration only |
| DuckHive TUI (Ink components) | Agent/task/team management logic, color picker, model selector, MCP tool browser |
| VS Code | Activity bar + sidebar pattern, panel toggles, status bar |
| Warp Terminal | Command palette (Cmd+K), terminal aesthetics |

---

## 7. Out of Scope (Not for WebUI)

These remain in the DuckHive CLI/TUI — not in the WebUI:
- Interactive REPL input (stdin capture) — too complex for web
- Vim keybindings — TUI-specific
- Full file editor (edit-in-editor) — use local IDE instead
- Plugin installation from web — security risk
- Direct backend code access — web UI is a viewer/controller, not a development environment

---

*This spec defines the merged vision: Codex's desktop-class features + DuckHive's agent management + OpenClaw's polished UI → one powerful WebUI for DuckHive.*
