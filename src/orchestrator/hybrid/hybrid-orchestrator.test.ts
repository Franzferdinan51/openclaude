import { describe, expect, test } from 'bun:test'
import { resetAgentRunStoreForTesting } from '../../agent-runs/AgentRunStore.js'
import { HybridOrchestrator } from './hybrid-orchestrator.js'

describe('HybridOrchestrator AgentRun integration', () => {
  test('creates a coordinator AgentRun for orchestrated work', async () => {
    const store = resetAgentRunStoreForTesting({ persist: false })
    const orchestrator = new HybridOrchestrator({
      enableCouncil: false,
      enableParallelAgents: false,
      enableTeamSpawn: false,
      enableCheckpoint: false,
    })

    const result = await orchestrator.execute('build a small api', [], [])

    const run = store.getRun(result.taskId)
    expect(run?.title).toBe('build a small api')
    expect(run?.status).toBe('running')
    expect(run?.selectedAgent).toBe('coordinator')
    expect(run?.provider).toBe(result.routing.provider)
    expect(run?.model).toBe(result.routing.model)
    expect(store.listEvents(result.taskId).map(event => event.type)).toEqual([
      'run_started',
      'run_progress',
    ])
  })
})
