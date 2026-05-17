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

export type AgentRunEventType =
  | 'run_started'
  | 'run_progress'
  | 'tool_call'
  | 'approval_requested'
  | 'channel_message'
  | 'run_completed'
  | 'run_failed'
  | 'run_cancelled'
  | 'run_recovered'
  | 'turn_start'
  | 'turn_end'
  | 'tool_execution_start'
  | 'tool_execution_end'
  | 'message_delta'
  | 'message_end'
  | 'agent_start'
  | 'agent_end'
  | 'message_start'

export type AgentRunChannelSource = {
  type: 'tui' | 'repl' | 'sdk' | 'telegram' | 'webhook' | 'email' | 'headless' | 'unknown'
  id?: string
  threadId?: string
  messageId?: string
}

export type AgentRunArtifact = {
  kind: 'file' | 'image' | 'video' | 'audio' | 'log' | 'transcript' | 'other'
  path?: string
  url?: string
  label?: string
}

export type AgentRunProgress = {
  toolUseCount?: number
  tokenCount?: number
  lastActivity?: string
  summary?: string
}

export type AgentRunBudget = {
  maxTokens?: number
  maxCostUsd?: number
  deadlineMs?: number
}

export type AgentRunPermissionState = {
  pendingApprovalIds?: string[]
  lastDecision?: 'allow' | 'deny'
  mode?: string
}

export type AgentRun = {
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
  channelSource?: AgentRunChannelSource
  taskIds: string[]
  transcriptPath?: string
  artifacts: AgentRunArtifact[]
  progress?: AgentRunProgress
  budget?: AgentRunBudget
  permissionState?: AgentRunPermissionState
  recoveryAttempts: number
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export type AgentRunEvent = {
  eventId: string
  runId: string
  type: AgentRunEventType
  timestamp: number
  payload?: Record<string, unknown>
}

export type AgentHarnessSupport =
  | { supported: true; priority?: number; reason?: string }
  | { supported: false; reason?: string }

export type AgentHarnessContext = {
  provider?: string
  model?: string
  runtime?: string
  agentType?: string
}

export type AgentHarnessAttemptParams = {
  runId: string
  prompt: string
  provider?: string
  model?: string
  tools?: unknown[]
  images?: unknown[]
  transcriptPath?: string
  onPartialReply?: (chunk: string) => void | Promise<void>
  onAgentEvent?: (event: Omit<AgentRunEvent, 'eventId'>) => void | Promise<void>
}

export type AgentHarnessResult = {
  status: 'completed' | 'failed'
  finalMessage?: string
  error?: string
  nativeSessionId?: string
}

export type AgentHarness = {
  id: string
  label: string
  supports(ctx: AgentHarnessContext): AgentHarnessSupport
  runAttempt(params: AgentHarnessAttemptParams): Promise<AgentHarnessResult>
  reset?(runId: string): Promise<void> | void
}

export type ResolvedAgentHarness = {
  harness: AgentHarness
  source: 'forced' | 'auto' | 'fallback'
}

export type AgentHarnessEnv = {
  DUCKHIVE_AGENT_RUNTIME?: string
  DUCKHIVE_AGENT_HARNESS_FALLBACK?: string
}

export class AgentHarnessRegistry {
  register(harness: AgentHarness): void
  get(id: string): AgentHarness | undefined
  list(): AgentHarness[]
  findBest(ctx: AgentHarnessContext): AgentHarness | undefined
}

export const builtinAgentHarness: AgentHarness

export function getAgentHarnessRegistry(): AgentHarnessRegistry
export function registerAgentHarness(harness: AgentHarness): void
export function resolveAgentHarness(
  ctx: AgentHarnessContext,
  registry?: AgentHarnessRegistry,
  env?: AgentHarnessEnv,
): ResolvedAgentHarness
