import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { resetAgentRunStoreForTesting } from '../../agent-runs/AgentRunStore.js'
import { HybridOrchestrator } from './hybrid-orchestrator.js'

type BridgeMock = {
  isEnabled: () => boolean
  shouldConsultCouncil: (complexity: number) => boolean
  startDeliberation: (message: string, mode: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>
  spawnTeam: (teamName: string, mode: string) => Promise<{ success: boolean; teamId?: string; error?: string }>
}

describe('HybridOrchestrator AgentRun integration', () => {
  beforeEach(() => {
    resetAgentRunStoreForTesting({ persist: false })
  })

  afterEach(() => {
    mock.restore()
  })

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

  test('triggers council, bridge team spawn, and checkpointing for critical work without local context', async () => {
    const bridgeMock: BridgeMock = {
      isEnabled: () => true,
      shouldConsultCouncil: complexity => complexity >= 4,
      startDeliberation: async () => ({ success: true, sessionId: 'council-123' }),
      spawnTeam: async () => ({ success: true, teamId: 'team-123' }),
    }

    const spawnTeammate = mock(async () => {
      throw new Error('spawnTeammate should not be used without a tool context')
    })
    const store = resetAgentRunStoreForTesting({ persist: false })
    const orchestrator = new HybridOrchestrator(
      {
        enableCouncil: true,
        enableParallelAgents: false,
        enableTeamSpawn: true,
        enableCheckpoint: true,
      },
      {
        getHiveBridge: (() => bridgeMock) as never,
        spawnTeammate: spawnTeammate as never,
      },
    )

    const result = await orchestrator.execute(
      'deploy production security migration with auth and database migration',
      [],
      [],
    )

    expect(result.councilTriggered).toBe(true)
    expect(result.councilSessionId).toBe('council-123')
    expect(result.teamSpawned).toBe(true)
    expect(result.teamId).toBe('team-123')
    expect(result.checkpointId).toMatch(/^checkpoint_/)
    expect(result.status).toBe('ready')
    expect(result.steps.map(step => step.step)).toEqual([
      'council_deliberate',
      'team_spawn',
      'checkpoint_save',
    ])

    const run = store.getRun(result.taskId)
    expect(run?.progress?.summary).toBe('Ready with 3 orchestration steps')
  })

  test('spawns parallel agent runs for complex work when a tool context is available', async () => {
    const spawnTeammate = mock(async ({ name }: { name: string }) => ({
      data: {
        teammate_id: `${name}-id`,
      },
    }))

    const bridgeMock: BridgeMock = {
      isEnabled: () => false,
      shouldConsultCouncil: () => false,
      startDeliberation: async () => ({ success: false, error: 'disabled' }),
      spawnTeam: async () => ({ success: false, error: 'disabled' }),
    }
    const store = resetAgentRunStoreForTesting({ persist: false })
    const orchestrator = new HybridOrchestrator(
      {
        enableCouncil: false,
        enableParallelAgents: true,
        enableTeamSpawn: false,
        enableCheckpoint: true,
      },
      {
        getHiveBridge: (() => bridgeMock) as never,
        spawnTeammate: spawnTeammate as never,
      },
    )

    const result = await orchestrator.execute(
      'design pattern async database migration build api and refactor auth',
      [],
      [],
      {} as never,
    )

    expect(spawnTeammate).toHaveBeenCalledTimes(2)
    expect(result.teamSpawned).toBe(true)
    expect(result.teamId).toMatch(/^swarm_/)
    expect(result.agentsSpawned).toEqual(['worker-1-id', 'worker-2-id'])
    expect(result.steps.map(step => step.step)).toEqual([
      'spawn_agent_worker-1',
      'spawn_agent_worker-2',
      'checkpoint_save',
    ])

    const childRuns = store
      .listRuns()
      .filter(run => run.parentRunId === result.taskId)
      .map(run => ({
        id: run.id,
        selectedAgent: run.selectedAgent,
        taskIds: run.taskIds,
      }))

    expect(childRuns).toEqual([
      { id: 'worker-1-id', selectedAgent: 'worker-1', taskIds: ['worker-1-id'] },
      { id: 'worker-2-id', selectedAgent: 'worker-2', taskIds: ['worker-2-id'] },
    ])
  })
})
