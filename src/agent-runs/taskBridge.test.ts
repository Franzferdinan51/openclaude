import { describe, expect, test } from 'bun:test'
import { createAgentRunStore } from './AgentRunStore.js'
import {
  completeAgentTaskRun,
  createAgentTaskRun,
  failAgentTaskRun,
  progressAgentTaskRun,
} from './taskBridge.js'

describe('agent task bridge', () => {
  test('maps a local agent task into an AgentRun with harness selection metadata', () => {
    const store = createAgentRunStore({ persist: false })

    const run = createAgentTaskRun(
      {
        id: 'a123',
        description: 'Build the thing',
        prompt: 'please build the thing',
        agentType: 'coder',
        model: 'MiniMax-M2.7',
        progress: { toolUseCount: 1, tokenCount: 25 },
      },
      store,
      {
        DUCKHIVE_PROVIDER: 'minimax',
        DUCKHIVE_AGENT_RUNTIME: 'auto',
      },
    )

    expect(run.id).toBe('a123')
    expect(run.status).toBe('running')
    expect(run.selectedAgent).toBe('coder')
    expect(run.provider).toBe('minimax')
    expect(run.model).toBe('MiniMax-M2.7')
    expect(run.runtimeHarness).toBe('builtin')
    expect(run.taskIds).toEqual(['a123'])
  })

  test('updates run progress and terminal states for agent tasks', () => {
    const store = createAgentRunStore({ persist: false })
    createAgentTaskRun(
      {
        id: 'a124',
        description: 'Research',
        prompt: 'research',
        agentType: 'researcher',
      },
      store,
    )

    progressAgentTaskRun(
      'a124',
      { toolUseCount: 3, tokenCount: 100, summary: 'Checking sources' },
      store,
    )
    completeAgentTaskRun('a124', store)
    failAgentTaskRun('missing', 'ignored', store)

    expect(store.getRun('a124')?.progress?.summary).toBe('Checking sources')
    expect(store.getRun('a124')?.status).toBe('completed')
    expect(store.listEvents('a124').map(event => event.type)).toEqual([
      'run_started',
      'run_progress',
      'run_completed',
    ])
  })
})
