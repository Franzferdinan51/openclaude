export const AGENT_RUN_STATUSES = [
  'queued',
  'preparing',
  'running',
  'awaiting_approval',
  'paused',
  'recovering',
  'completed',
  'failed',
  'cancelled',
] as const

export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number]

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
  // pi-style turn/message events
  | 'turn_start'
  | 'turn_end'
  | 'tool_execution_start'
  | 'tool_execution_end'
  | 'message_delta'
  | 'message_end'
  | 'agent_start'
  | 'agent_end'
  | 'message_start'
  | 'message_delta'
  | 'message_end'
  | 'tool_execution_start'
  | 'tool_execution_end'
  | 'agent_start'
  | 'agent_end'

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

export type AgentRunCreateInput = {
  id?: string
  title: string
  description?: string
  status?: AgentRunStatus
  parentRunId?: string
  selectedAgent?: string
  provider?: string
  model?: string
  runtimeHarness?: string
  channelSource?: AgentRunChannelSource
  taskIds?: string[]
  transcriptPath?: string
  artifacts?: AgentRunArtifact[]
  progress?: AgentRunProgress
  budget?: AgentRunBudget
  permissionState?: AgentRunPermissionState
}

export type AgentRunUpdate = Partial<
  Pick<
    AgentRun,
    | 'status'
    | 'description'
    | 'selectedAgent'
    | 'provider'
    | 'model'
    | 'runtimeHarness'
    | 'channelSource'
    | 'transcriptPath'
    | 'progress'
    | 'budget'
    | 'permissionState'
  >
> & {
  taskIds?: string[]
  artifacts?: AgentRunArtifact[]
  recoveryAttempts?: number
}

export type AgentRunEvent = {
  eventId: string
  runId: string
  type: AgentRunEventType
  timestamp: number
  payload?: Record<string, unknown>
}

export type AgentRunListFilter = {
  status?: AgentRunStatus
  parentRunId?: string
}
