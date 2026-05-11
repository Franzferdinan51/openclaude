export interface GatewayHealth {
  status: 'ok' | 'degraded' | 'offline'
  version?: string
  service?: string
  timestamp?: number
}

export interface AgentInfo {
  id: string
  name: string
  status: 'online' | 'busy' | 'offline'
  model?: string
  capabilities?: string[]
  lastSeen?: number
}

export interface ToolInfo {
  name: string
  description: string
  dangerous: boolean
  category?: string
}

export interface McpServerInfo {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'error'
  tools: number
  url?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  name?: string
}

export interface SessionInfo {
  id: string
  title: string
  messages?: ChatMessage[]
  createdAt: number
  updatedAt: number
  runId?: string
}

export type AgentRunStatus =
  | 'queued'
  | 'preparing'
  | 'running'
  | 'awaiting_approval'
  | 'paused'
  | 'recovering'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface AgentRun {
  id: string
  status: AgentRunStatus
  title: string
  description?: string
  parentRunId?: string
  childRunIds: string[]
  selectedAgent?: string
  provider?: string
  model?: string
  runtimeHarness: string
  taskIds: string[]
  transcriptPath?: string
  artifacts: Array<{ kind: string; path?: string; url?: string; label?: string }>
  progress?: {
    toolUseCount?: number
    tokenCount?: number
    lastActivity?: string
    summary?: string
  }
  budget?: {
    maxTokens?: number
    maxCostUsd?: number
    deadlineMs?: number
  }
  permissionState?: {
    pendingApprovalIds?: string[]
    lastDecision?: 'allow' | 'deny'
    mode?: string
  }
  recoveryAttempts: number
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export interface AgentRunEvent {
  eventId: string
  runId: string
  type:
    | 'run_started'
    | 'run_progress'
    | 'tool_call'
    | 'approval_requested'
    | 'channel_message'
    | 'run_completed'
    | 'run_failed'
    | 'run_cancelled'
    | 'run_recovered'
    | 'tool_execution_start'
    | 'tool_execution_end'
    | 'message_delta'
    | 'message_end'
    | 'turn_start'
    | 'turn_end'
    | 'agent_start'
    | 'agent_end'
  timestamp: number
  payload?: Record<string, unknown>
}

export interface SystemStatus {
  system?: {
    cpuCount: number
    memory: { used: number; total: number; percent: number }
    uptime: number
    platform: string
  }
  provider?: { provider: string; model: string }
  telegram?: { configured: boolean; allowlistConfigured: boolean }
  desktopControl?: { configured: boolean; packagePath?: string; version?: string; android?: string }
  openClaw?: Record<string, unknown>
}

export interface CostStats {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  estimatedCost?: number
  period?: string
}

export interface SearchProviderStatus {
  configured: boolean
  provider?: string
  searxngUrl?: string | null
}

export async function getSearchProvider(): Promise<SearchProviderStatus> {
  return request<SearchProviderStatus>('/api/search-provider', undefined, { configured: false })
}

export async function setSearchProvider(provider: string, searxngUrl?: string): Promise<SearchProviderStatus> {
  return request<SearchProviderStatus>('/api/search-provider', {
    method: 'POST',
    body: JSON.stringify({ provider, searxngUrl }),
  }, { configured: false })
}

export interface MemoryEntry {
  id?: string
  content: string
  type?: string
  tags?: string[]
  timestamp?: number
}

export interface ChatCompletionResponse {
  id: string
  model: string
  runId?: string
  session?: SessionInfo
  choices: Array<{
    message: ChatMessage
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ---------------------------------------------------------------------------
// Tauri detection — when running in the desktop shell, use invoke instead of fetch
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __TAURI__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
    }
  }
}

const DEFAULT_API_BASE = 'http://localhost:3017'

export const DUCKHIVE_API_BASE =
  (import.meta.env.VITE_DUCKHIVE_API_BASE as string | undefined)?.replace(/\/$/, '') ??
  DEFAULT_API_BASE

const isTauri = typeof window !== 'undefined' && !!window.__TAURI__?.invoke

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!window.__TAURI__?.invoke) throw new Error('Tauri not available')
  return window.__TAURI__.invoke<T>(cmd, args)
}

// ---------------------------------------------------------------------------
// Transport-agnostic internal request helper
// Uses Tauri invoke() when available, falls back to browser fetch()
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit, fallback?: T): Promise<T> {
  // When inside Tauri, proxy all calls through Rust IPC
  if (isTauri) {
    return tauriRequest<T>(path, init)
  }
  // Browser fallback — direct HTTP
  try {
    const res = await fetch(`${DUCKHIVE_API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json() as T
  } catch {
    if (fallback !== undefined) return fallback
    throw new Error(`DuckHive API unavailable at ${DUCKHIVE_API_BASE}`)
  }
}

/**
 * Tauri transport: map REST-like paths to Tauri invoke() commands.
 * The Rust main.rs exposes IPC commands that proxy to council-api-server.
 */
async function tauriRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const body = init?.body ? JSON.parse(init.body as string) : undefined

  // Map REST paths to Tauri command names (matches Rust main.rs IPC handlers)
  switch (`${method} ${path}`) {
    case 'GET /health':
      return tauriInvoke<T>('get_health')
    case 'GET /api/status':
      return tauriInvoke<T>('get_system_status')
    case 'GET /api/agents':
      return tauriInvoke<T>('get_agents')
    case 'GET /api/tools':
      return tauriInvoke<T>('get_tools')
    case 'GET /api/mcp/servers':
      return tauriInvoke<T>('get_mcp_servers')
    case 'POST /api/sessions':
      return tauriInvoke<T>('create_session', { title: body?.title ?? null })
    case 'GET /api/sessions':
      return tauriInvoke<T>('list_sessions')
    case `GET /api/sessions/${encodeURIComponent(path.split('/api/sessions/')[1] ?? '')}`:
      if (method === 'GET' && path.startsWith('/api/sessions/')) {
        const sessionId = path.split('/api/sessions/')[1]
        return tauriInvoke<T>('get_session', { sessionId })
      }
      break
    case 'POST /api/chat':
      return tauriInvoke<T>('send_chat', {
        messages: body?.messages ?? [],
        options: {
          model: body?.model ?? 'auto',
          stream: body?.stream ?? false,
          sessionId: body?.sessionId ?? null,
        },
      })
    case 'GET /api/runs':
      return tauriInvoke<T>('list_runs')
    case `GET /api/runs/${encodeURIComponent(path.split('/api/runs/')[1]?.split('/')[0] ?? '')}`:
      if (method === 'GET' && path.match(/^\/api\/runs\/[^/]+$/)) {
        const runId = path.split('/api/runs/')[1]
        return tauriInvoke<T>('get_run', { runId })
      }
      break
    case `GET /api/runs/${encodeURIComponent(path.split('/api/runs/')[1]?.split('/')[0] ?? '')}/events`:
      if (method === 'GET' && path.match(/^\/api\/runs\/[^/]+\/events/)) {
        const runId = path.split('/api/runs/')[1].split('/')[0]
        const limitMatch = path.match(/limit=(\d+)/)
        const limit = limitMatch ? parseInt(limitMatch[1]) : null
        return tauriInvoke<T>('get_run_events', { runId, limit })
      }
      break
    case `POST /api/runs/${encodeURIComponent(path.split('/api/runs/')[1]?.split('/')[0] ?? '')}/${path.split('/api/runs/')[1]?.split('/')[1] ?? ''}`:
      if (method === 'POST' && path.match(/^\/api\/runs\/[^/]+\/(pause|resume|stop|approve|recover)/)) {
        const parts = path.split('/api/runs/')[1].split('/')
        return tauriInvoke<T>('run_action', { runId: parts[0], action: parts[1], payload: body ?? {} })
      }
      break
    case 'GET /api/search-provider':
      return tauriInvoke<T>('get_search_provider')
    case 'POST /api/search-provider':
      return tauriInvoke<T>('set_search_provider', { provider: body?.provider, searxngUrl: body?.searxngUrl ?? null })
    case 'GET /api/cost-stats':
      return tauriInvoke<T>('get_cost_stats')
  }

  throw new Error(`No Tauri command mapping for ${method} ${path}`)
}

// Tauri event system uses plugin events instead of EventSource
// In Tauri 2.x the event system requires @tauri-apps/api/event — placeholder for now
function subscribeToEventsTauri(
  _onEvent: (event: import('./gateway').AgentRunEvent) => void,
  _onSnapshot?: (runs: import('./gateway').AgentRun[]) => void
): () => void {
  // Tauri 2.x event plugin would be used here for real-time run events.
  // Browser fallback (EventSource in subscribeToEvents) is used when not in Tauri.
  return () => {}
}

export async function getHealth(): Promise<GatewayHealth> {
  return request<GatewayHealth>('/health', undefined, { status: 'offline' })
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>('/api/status', undefined, {})
}

export async function getAgents(): Promise<AgentInfo[]> {
  const data = await request<{ agents?: AgentInfo[] } | AgentInfo[]>('/api/agents', undefined, [])
  return Array.isArray(data) ? data : data.agents ?? []
}

export async function getTools(): Promise<ToolInfo[]> {
  const data = await request<{ tools?: ToolInfo[] } | ToolInfo[]>('/api/tools', undefined, [])
  return Array.isArray(data) ? data : data.tools ?? []
}

export async function getMcpServers(): Promise<McpServerInfo[]> {
  const data = await request<{ servers?: McpServerInfo[] } | McpServerInfo[]>('/api/mcp/servers', undefined, [])
  return Array.isArray(data) ? data : data.servers ?? []
}

export async function createSession(title?: string): Promise<SessionInfo | null> {
  return request<SessionInfo | null>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }, null)
}

export async function listSessions(): Promise<SessionInfo[]> {
  const data = await request<{ sessions?: SessionInfo[] } | SessionInfo[]>('/api/sessions', undefined, [])
  return Array.isArray(data) ? data : data.sessions ?? []
}

export async function getSession(sessionId: string): Promise<{ messages: ChatMessage[]; runId?: string } | null> {
  return request<{ messages: ChatMessage[]; runId?: string } | null>(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    undefined,
    null,
  )
}

export async function sendChat(
  messages: ChatMessage[],
  options: { model?: string; stream?: boolean; sessionId?: string } = {},
): Promise<ChatCompletionResponse | null> {
  return request<ChatCompletionResponse | null>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages,
      model: options.model || 'auto',
      stream: options.stream ?? false,
      sessionId: options.sessionId,
    }),
  }, null)
}

export async function listRuns(): Promise<AgentRun[]> {
  const data = await request<{ runs?: AgentRun[] } | AgentRun[]>('/api/runs', undefined, [])
  return Array.isArray(data) ? data : data.runs ?? []
}

export async function getRun(runId: string): Promise<{ run: AgentRun; children: AgentRun[]; events: AgentRunEvent[] } | null> {
  return request(`/api/runs/${encodeURIComponent(runId)}`, undefined, null)
}

export async function getRunEvents(runId: string, limit = 50): Promise<AgentRunEvent[]> {
  const data = await request<{ events?: AgentRunEvent[] }>(
    `/api/runs/${encodeURIComponent(runId)}/events?limit=${limit}`,
    undefined,
    { events: [] },
  )
  return data.events ?? []
}

export async function runAction(
  runId: string,
  action: 'pause' | 'resume' | 'stop' | 'approve' | 'recover',
  payload: Record<string, unknown> = {},
): Promise<AgentRun | null> {
  const data = await request<{ run?: AgentRun }>(`/api/runs/${encodeURIComponent(runId)}/${action}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, {})
  return data.run ?? null
}

export function subscribeToEvents(onEvent: (event: AgentRunEvent) => void, onSnapshot?: (runs: AgentRun[]) => void): () => void {
  const source = new EventSource(`${DUCKHIVE_API_BASE}/api/events`)
  source.addEventListener('snapshot', event => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as { runs?: AgentRun[] }
      onSnapshot?.(data.runs ?? [])
    } catch {
      // Ignore malformed snapshots from development servers.
    }
  })

  for (const type of [
    'run_started',
    'run_progress',
    'tool_call',
    'approval_requested',
    'channel_message',
    'run_completed',
    'run_failed',
    'run_cancelled',
        'run_recovered',
    'tool_execution_start',
    'tool_execution_end',
    'message_delta',
    'message_end',
    'turn_start',
    'turn_end',
    'agent_start',
    'agent_end',
  ]) {
    source.addEventListener(type, event => {
      try {
        onEvent(JSON.parse((event as MessageEvent).data) as AgentRunEvent)
      } catch {
        // Ignore malformed event payloads.
      }
    })
  }
  return () => source.close()
}

export async function searchMemory(_query: string, _limit = 10): Promise<MemoryEntry[]> {
  return []
}

export async function getMemoryStats(): Promise<{ total: number; types: Record<string, number> }> {
  return { total: 0, types: {} }
}

export async function getCostStats(): Promise<CostStats> {
  return { totalTokens: 0, promptTokens: 0, completionTokens: 0, period: 'session' }
}

export { DUCKHIVE_API_BASE as GATEWAY_BASE }
