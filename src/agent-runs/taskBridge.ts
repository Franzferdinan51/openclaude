import type { AgentProgress } from '../tasks/LocalAgentTask/LocalAgentTask.js'
import type { AgentRunStore } from './AgentRunStore.js'
import { getAgentRunStore } from './AgentRunStore.js'
import { resolveAgentHarness, type AgentHarnessEnv } from './harness.js'
import type { AgentRun } from './types.js'

export type AgentTaskRunInput = {
  id: string
  description: string
  prompt: string
  agentType: string
  model?: string
  transcriptPath?: string
  progress?: AgentProgress
  parentRunId?: string
}

type AgentTaskRunEnv = AgentHarnessEnv & {
  DUCKHIVE_PROVIDER?: string
  DUCKHIVE_MODEL_NAME?: string
}

export function createAgentTaskRun(
  task: AgentTaskRunInput,
  store: AgentRunStore = getAgentRunStore(),
  env: AgentTaskRunEnv = process.env as AgentTaskRunEnv,
): AgentRun {
  const provider = env.DUCKHIVE_PROVIDER
  const model = task.model ?? env.DUCKHIVE_MODEL_NAME
  const harness = resolveAgentHarness(
    {
      provider,
      model,
      runtime: env.DUCKHIVE_AGENT_RUNTIME,
      agentType: task.agentType,
    },
    undefined,
    env,
  ).harness

  return store.createRun({
    id: task.id,
    title: task.description,
    description: task.prompt,
    status: 'running',
    parentRunId: task.parentRunId,
    selectedAgent: task.agentType,
    provider,
    model,
    runtimeHarness: harness.id,
    taskIds: [task.id],
    transcriptPath: task.transcriptPath,
    progress: progressFromAgentProgress(task.progress),
  })
}

export function progressAgentTaskRun(
  runId: string,
  progress: AgentProgress,
  store: AgentRunStore = getAgentRunStore(),
): void {
  store.updateRun(runId, {
    status: 'running',
    progress: progressFromAgentProgress(progress),
  })
}

export function completeAgentTaskRun(
  runId: string,
  store: AgentRunStore = getAgentRunStore(),
): void {
  store.updateRun(runId, { status: 'completed' })
}

export function failAgentTaskRun(
  runId: string,
  error: string,
  store: AgentRunStore = getAgentRunStore(),
): void {
  store.updateRun(runId, {
    status: 'failed',
    progress: { summary: error },
  })
}

function progressFromAgentProgress(progress?: AgentProgress): AgentRun['progress'] {
  if (!progress) return undefined
  return {
    toolUseCount: progress.toolUseCount,
    tokenCount: progress.tokenCount,
    lastActivity: progress.lastActivity?.activityDescription ?? progress.lastActivity?.toolName,
    summary: progress.summary,
  }
}
