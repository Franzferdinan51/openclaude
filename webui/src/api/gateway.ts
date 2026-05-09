/**
 * DuckHive API Client
 * Points to Dashboard server (3001) which proxies to OpenClaw gateway
 * Gateway (18789) only has /health and /v1/chat/completions
 * Dashboard has full API: /api/agents, /api/tools/list, /api/mesh, etc.
 */

const DASHBOARD_BASE = 'http://localhost:3001';

export interface GatewayHealth {
  status: 'ok' | 'degraded' | 'offline';
  version?: string;
  uptime?: number;
  timestamp?: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  status: 'online' | 'busy' | 'offline';
  model?: string;
  capabilities?: string[];
  lastSeen?: number;
}

export interface ToolInfo {
  name: string;
  description: string;
  dangerous: boolean;
  category?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Gateway Health ───────────────────────────────────────────────────────────

export async function getHealth(): Promise<GatewayHealth> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { status: 'offline' };
  }
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<AgentInfo[]> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/agents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.agents ?? []);
  } catch {
    return [];
  }
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export async function getTools(): Promise<ToolInfo[]> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/tools/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.tools ?? []);
  } catch {
    return [];
  }
}

// ─── Chat / Sessions ─────────────────────────────────────────────────────────

export async function createSession(title?: string): Promise<SessionInfo | null> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<SessionInfo[]> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/sessions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.sessions ?? []);
  } catch {
    return [];
  }
}

export async function getSession(sessionId: string): Promise<{ messages: ChatMessage[] } | null> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/sessions/${sessionId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendChat(
  messages: ChatMessage[],
  options: { model?: string; stream?: boolean } = {}
): Promise<ChatCompletionResponse | null> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: options.model || 'MiniMax-M2.7',
        stream: options.stream ?? false,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id?: string;
  content: string;
  type?: string;
  tags?: string[];
  timestamp?: number;
}

export async function searchMemory(query: string, limit = 10): Promise<MemoryEntry[]> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/memory/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Memory stats - use dashboard proxy
export async function getMemoryStats(): Promise<{ total: number; types: Record<string, number> }> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/memory/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { total: 0, types: {} };
  }
}

// ─── Cost / Usage ─────────────────────────────────────────────────────────────

export interface CostStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost?: number;
  period?: string;
}

export async function getCostStats(): Promise<CostStats> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/cost`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data ?? { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  } catch {
    return { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  }
}

// ─── MCP Servers ─────────────────────────────────────────────────────────────

export interface McpServerInfo {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: number;
  url?: string;
}

// MCP servers - use dashboard proxy
export async function getMcpServers(): Promise<McpServerInfo[]> {
  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/mcp/servers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.servers ?? []);
  } catch {
    return [];
  }
}

export { DASHBOARD_BASE as GATEWAY_BASE };
