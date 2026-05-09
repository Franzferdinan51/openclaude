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

function AppInner() {
  const { theme, setTheme } = useTheme()
  const { messages, sendMessage, isLoading, cancelLoading, clearMessages, activeRunId } = useChat()
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
              <button key={item.id} className="rail-button" title={item.label}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </aside>

        <aside className="left-panel">
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
            <Metric label="Agents" value={agents.length} />
            <Metric label="Tools" value={tools.length} />
            <Metric label="MCP" value={mcpServers.length} />
            <Metric label="Memory" value="ready" />
          </section>
        </aside>

        <main className="workspace">
          <div className="session-strip">
            <button className="session-chip active">
              <TerminalSquare size={14} />
              Console Session
            </button>
            {selectedRun && (
              <button className="session-chip">
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
                    <button key={prompt} onClick={() => sendMessage(prompt)}>
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
              <button onClick={() => controlRun(selectedRun.id, 'approve')} title="Approve pending run request">
                <Check size={15} /> Approve
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

          <RightPanel onClearChat={clearMessages} />
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
            <button onClick={refresh}><RefreshCw size={15} /> Refresh WebUI data</button>
            <button onClick={() => selectedRun && controlRun(selectedRun.id, 'approve')} disabled={!selectedRun}>
              <ShieldCheck size={15} /> Approve selected run
            </button>
            <button onClick={clearMessages}><MessageSquare size={15} /> Clear console transcript</button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <span className={`status-pill ${tone}`}>{label}</span>
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
