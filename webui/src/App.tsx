import './styles/globals.css'
import './styles/theme.css'
import React from 'react'
import {
  Activity,
  Bot,
  Check,
  ChevronRight,
  Cpu,
  GitBranch,
  Hammer,
  MessageSquare,
  MessageSquarePlus,
  MonitorCog,
  Pause,
  Play,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Square,
  TerminalSquare,
  Undo2,
  Workflow,
  Zap,
} from 'lucide-react'
import { GatewayProvider, useGateway } from './context/GatewayContext'
import { ChatProvider, useChat } from './context/ChatContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { RightPanel } from './components/RightPanel/RightPanel'
import { MessageList } from './components/Chat/MessageList'
import { InputBar } from './components/Chat/InputBar'

const EXAMPLE_PROMPTS = [
  'Review this project and create a verification run',
  'Plan a swarm of workers for the next feature',
  'Inspect Telegram and desktop control readiness',
  'Summarize the active AgentRun graph',
]

const navItems = [
  { id: 'sessions', label: 'Sessions', icon: MessageSquare },
  { id: 'runs', label: 'Runs', icon: Workflow },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'tools', label: 'Tools', icon: Hammer },
  { id: 'mcp', label: 'MCP', icon: GitBranch },
  { id: 'desktop', label: 'Desktop', icon: MonitorCog },
  { id: 'ops', label: 'Ops', icon: Cpu },
  { id: 'settings', label: 'Settings', icon: Settings },
]

type NavId = (typeof navItems)[number]['id']

function AppInner() {
  const { theme, setTheme } = useTheme()
  const {
    activeSession,
    activeRunId,
    cancelLoading,
    clearMessages,
    createSession,
    isLoading,
    messages,
    sendMessage,
    sessions,
    setActiveSession,
  } = useChat()
  const {
    agents,
    connected,
    controlRun,
    eventsByRun,
    health,
    mcpServers,
    refresh,
    runs,
    selectedRun,
    selectedRunId,
    selectRun,
    status,
    tools,
  } = useGateway()
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [activeNav, setActiveNav] = React.useState<NavId>('runs')

  React.useEffect(() => {
    if (activeRunId) selectRun(activeRunId)
  }, [activeRunId, selectRun])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(value => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const activeEvents = selectedRunId ? eventsByRun[selectedRunId] ?? [] : []
  const runningCount = runs.filter(run => ['running', 'awaiting_approval', 'recovering'].includes(run.status)).length
  const pendingApprovals = runs.reduce((total, run) => total + (run.permissionState?.pendingApprovalIds?.length ?? 0), 0)
  const selectedApprovalId = selectedRun?.permissionState?.pendingApprovalIds?.[0]

  const handleNewChat = React.useCallback(() => {
    void createSession('New WebUI session')
    setActiveNav('sessions')
  }, [createSession])

  const runCommand = React.useCallback((command: () => void | Promise<void>) => {
    void Promise.resolve(command()).finally(() => setCommandOpen(false))
  }, [])

  const sendPrompt = React.useCallback((prompt: string) => {
    void sendMessage(prompt)
    setActiveNav('runs')
  }, [sendMessage])

  const approveSelectedRun = React.useCallback(() => {
    if (!selectedRun) return
    const approvalId = selectedRun.permissionState?.pendingApprovalIds?.[0]
    return controlRun(
      selectedRun.id,
      'approve',
      approvalId ? { approvalId } : {},
    )
  }, [controlRun, selectedRun])

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">DH</div>
          <div>
            <div className="brand-title">DuckHive</div>
            <div className="brand-subtitle">Hybrid Agent Console</div>
          </div>
        </div>
        <div className="topbar-metrics">
          <StatusPill tone={connected ? 'good' : 'bad'} label={connected ? 'API online' : 'API offline'} />
          <StatusPill label={`${runningCount} active runs`} />
          <StatusPill tone={pendingApprovals ? 'warn' : 'neutral'} label={`${pendingApprovals} approvals`} />
          <StatusPill label={status?.provider?.model ?? 'auto model'} />
        </div>
        <div className="topbar-actions">
          <button className="icon-button" title="Open command palette" onClick={() => setCommandOpen(true)}>
            <Search size={16} />
          </button>
          <button className="icon-button" title="Refresh gateway data" onClick={refresh}>
            <RefreshCw size={16} />
          </button>
          <select
            className="theme-picker"
            aria-label="Theme"
            value={theme}
            onChange={event => setTheme(event.target.value as 'claw' | 'knot' | 'dash')}
          >
            <option value="claw">Claw</option>
            <option value="knot">Knot</option>
            <option value="dash">Dash</option>
          </select>
        </div>
      </header>

      <div className="console-layout">
        <aside className="activity-rail" aria-label="DuckHive workspace navigation">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`rail-button ${activeNav === item.id ? 'active' : ''}`}
                title={item.label}
                onClick={() => setActiveNav(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </aside>

        <aside className="left-panel">
          {activeNav === 'sessions' && (
            <section className="panel-section">
              <div className="section-heading">
                <span>Sessions</span>
                <button className="mini-action" onClick={handleNewChat}>
                  <MessageSquarePlus size={13} /> New
                </button>
              </div>
              <div className="panel-list">
                {sessions.length === 0 ? (
                  <EmptyPanel title="No saved sessions" detail="Create a new chat or send a prompt." />
                ) : sessions.map(session => (
                  <button
                    key={session.id}
                    className={`list-row ${session.id === activeSession ? 'active' : ''}`}
                    onClick={() => setActiveSession(session.id)}
                  >
                    <MessageSquare size={15} />
                    <span>
                      <strong>{session.title}</strong>
                      <small>{new Date(session.updatedAt).toLocaleTimeString()}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeNav === 'runs' && (
            <section className="panel-section">
              <div className="section-heading">
                <span>Agent Runs</span>
                <span className="muted">{runs.length}</span>
              </div>
              <div className="run-list">
                {runs.length === 0 ? (
                  <EmptyPanel title="No runs yet" detail="Send a prompt to register the first AgentRun." />
                ) : runs.slice(0, 12).map(run => (
                  <button
                    key={run.id}
                    className={`run-row ${run.id === selectedRunId ? 'active' : ''}`}
                    onClick={() => selectRun(run.id)}
                  >
                    <span className={`status-dot ${run.status}`} />
                    <span className="run-row-main">
                      <span className="run-title">{run.title}</span>
                      <span className="run-meta">{run.runtimeHarness} · {run.model ?? 'auto'}</span>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeNav === 'agents' && (
            <section className="panel-section">
              <div className="section-heading"><span>Agents</span><span className="muted">{agents.length}</span></div>
              <div className="panel-list">
                {agents.map(agent => (
                  <button key={agent.id} className="list-row" onClick={() => sendPrompt(`Inspect agent ${agent.name} and summarize its current work queue.`)}>
                    <Bot size={15} />
                    <span><strong>{agent.name}</strong><small>{agent.status} · {agent.model ?? 'auto'}</small></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeNav === 'tools' && (
            <section className="panel-section">
              <div className="section-heading"><span>Tools</span><span className="muted">{tools.length}</span></div>
              <div className="panel-list">
                {tools.map(tool => (
                  <button key={tool.name} className="list-row" onClick={() => sendPrompt(`Explain when to use the ${tool.name} tool and whether it is safe for this workspace.`)}>
                    <Hammer size={15} />
                    <span><strong>{tool.name}</strong><small>{tool.category ?? 'tool'}{tool.dangerous ? ' · approval needed' : ''}</small></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeNav === 'mcp' && (
            <section className="panel-section">
              <div className="section-heading"><span>MCP Servers</span><span className="muted">{mcpServers.length}</span></div>
              <div className="panel-list">
                {mcpServers.map(server => (
                  <button key={server.id} className="list-row" onClick={() => sendPrompt(`Check MCP server ${server.name} and list available capabilities.`)}>
                    <GitBranch size={15} />
                    <span><strong>{server.name}</strong><small>{server.status} · {server.tools} tools</small></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeNav === 'desktop' && (
            <section className="panel-section">
              <div className="section-heading"><span>Desktop Control</span><span className="muted">{status?.desktopControl?.version ?? 'local'}</span></div>
              <div className="ops-card">
                <strong>{status?.desktopControl?.configured ? 'Newest Desktop Control is bundled' : 'Desktop control not detected'}</strong>
                <span>{status?.desktopControl?.packagePath ?? 'No package path reported'}</span>
                <button onClick={() => sendPrompt('Run a desktop and Android control readiness check and report any missing permissions or ADB setup.')}>
                  <MonitorCog size={14} /> Check readiness
                </button>
              </div>
            </section>
          )}

          {activeNav === 'ops' && (
            <section className="panel-section">
              <div className="section-heading"><span>Operations</span><span className="muted">{connected ? 'online' : 'offline'}</span></div>
              <div className="ops-card">
                <strong>Provider: {status?.provider?.provider ?? 'auto'}</strong>
                <span>Model: {status?.provider?.model ?? 'auto'}</span>
                <span>Telegram: {status?.telegram?.configured ? 'configured' : 'not configured'}</span>
                <span>Memory: {status?.system?.memory.percent ?? 0}% used</span>
                <button onClick={refresh}><RefreshCw size={14} /> Refresh diagnostics</button>
              </div>
            </section>
          )}

          {activeNav === 'settings' && (
            <section className="panel-section">
              <div className="section-heading"><span>Settings</span><span className="muted">{theme}</span></div>
              <div className="panel-list">
                {(['claw', 'knot', 'dash'] as const).map(nextTheme => (
                  <button key={nextTheme} className={`list-row ${theme === nextTheme ? 'active' : ''}`} onClick={() => setTheme(nextTheme)}>
                    <Settings size={15} />
                    <span><strong>{nextTheme}</strong><small>Switch console accent theme</small></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="panel-section">
            <div className="section-heading">
              <span>Provider</span>
              <span className="muted">{health?.version ?? 'dev'}</span>
            </div>
            <div className="provider-card">
              <div className="provider-model">{status?.provider?.model ?? 'auto'}</div>
              <div className="muted">{status?.provider?.provider ?? 'DuckHive API'}</div>
            </div>
          </section>

          <section className="panel-section compact-grid">
            <Metric label="Agents" value={agents.length} onClick={() => setActiveNav('agents')} />
            <Metric label="Tools" value={tools.length} onClick={() => setActiveNav('tools')} />
            <Metric label="MCP" value={mcpServers.length} onClick={() => setActiveNav('mcp')} />
            <Metric label="Memory" value="ready" onClick={() => setActiveNav('ops')} />
          </section>
        </aside>

        <main className="workspace">
          <div className="session-strip">
              <button className="session-chip active" onClick={() => setActiveNav('sessions')}>
                <TerminalSquare size={14} />
                Console Session
              </button>
            {selectedRun && (
              <button className="session-chip" onClick={() => setActiveNav('runs')}>
                <Activity size={14} />
                {selectedRun.status}
              </button>
            )}
          </div>

          <div className="messages-area">
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <div className="welcome-kicker">Agent control plane ready</div>
                <h1>Command DuckHive from one console.</h1>
                <p>
                  Start a run, inspect harness state, approve work, and keep Telegram, MCP,
                  desktop control, and provider routing in view.
                </p>
                <div className="welcome-examples">
                  {EXAMPLE_PROMPTS.map(prompt => (
                    <button key={prompt} onClick={() => sendPrompt(prompt)}>
                      <Send size={14} />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <MessageList messages={messages} />
            )}
          </div>

          <InputBar
            onSendMessage={sendMessage}
            isLoading={isLoading}
            onCancel={isLoading ? cancelLoading : undefined}
          />
        </main>

        <aside className="inspector">
          <section className="inspector-hero">
            <div>
              <div className="muted">Selected Run</div>
              <h2>{selectedRun?.title ?? 'No active run'}</h2>
              <p>{selectedRun?.progress?.summary ?? 'Run details will appear here as work starts.'}</p>
            </div>
            {selectedRun && <span className={`status-badge ${selectedRun.status}`}>{selectedRun.status}</span>}
          </section>

          {selectedRun && (
            <section className="run-controls">
              <button onClick={() => controlRun(selectedRun.id, 'resume')} title="Resume run">
                <Play size={15} /> Resume
              </button>
              <button onClick={() => controlRun(selectedRun.id, 'pause')} title="Pause run">
                <Pause size={15} /> Pause
              </button>
              <button onClick={() => controlRun(selectedRun.id, 'stop')} title="Stop run">
                <Square size={15} /> Stop
              </button>
              <button
                onClick={approveSelectedRun}
                title={selectedApprovalId ? `Approve pending request ${selectedApprovalId}` : 'Approve pending run request'}
              >
                <Check size={15} /> Approve
              </button>
              <button onClick={() => controlRun(selectedRun.id, 'recover', { summary: 'Recovery requested from DuckHive WebUI' })} title="Mark run for recovery">
                <Undo2 size={15} /> Recover
              </button>
            </section>
          )}

          <section className="event-tail">
            <div className="section-heading">
              <span>Event Tail</span>
              <span className="muted">{activeEvents.length}</span>
            </div>
            {activeEvents.length === 0 ? (
              <EmptyPanel title="No events" detail="Run lifecycle events stream here." />
            ) : activeEvents.slice(-8).reverse().map(event => (
              <div key={event.eventId} className="event-row">
                <Zap size={13} />
                <span>{event.type}</span>
                <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
              </div>
            ))}
          </section>

          <RightPanel
            onClearChat={clearMessages}
            onNewChat={handleNewChat}
            onOpenCommands={() => setCommandOpen(true)}
          />
        </aside>
      </div>

      {commandOpen && (
        <div className="command-backdrop" onClick={() => setCommandOpen(false)}>
          <div className="command-palette" onClick={event => event.stopPropagation()}>
            <div className="command-input">
              <Search size={16} />
              <span>Command palette</span>
              <kbd>⌘K</kbd>
            </div>
            <button onClick={() => runCommand(refresh)}><RefreshCw size={15} /> Refresh WebUI data</button>
            <button onClick={() => runCommand(approveSelectedRun)} disabled={!selectedRun}>
              <ShieldCheck size={15} /> Approve selected run
            </button>
            <button onClick={() => runCommand(handleNewChat)}><MessageSquarePlus size={15} /> New console session</button>
            <button onClick={() => runCommand(clearMessages)}><MessageSquare size={15} /> Clear console transcript</button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <span className={`status-pill ${tone}`}>{label}</span>
}

function Metric({ label, value, onClick }: { label: string; value: React.ReactNode; onClick?: () => void }) {
  return (
    <button className="metric" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  )
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-panel">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <GatewayProvider>
        <ChatProvider>
          <AppInner />
        </ChatProvider>
      </GatewayProvider>
    </ThemeProvider>
  )
}
