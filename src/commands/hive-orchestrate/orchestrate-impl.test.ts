import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

async function importFreshOrchestrateModule() {
  return await import(
    `./orchestrate-impl.ts?orchestrate-test=${Date.now()}-${Math.random()}`
  )
}

function mockHiveBridgeModule(modes: string[] = ['balanced', 'council']) {
  const bridge = {
    getModes: async () => modes,
    isHealthy: async () => true,
    getContext: async () => ({
      councilorCount: 5,
      recentDecrees: [{ id: 'd1' }],
      activeTeams: [{ id: 't1' }],
    }),
  }
  mock.module('../../services/hive-bridge/index.js', () => ({
    getHiveBridge: () => bridge,
    initHiveBridge: () => bridge,
  }))
}

describe('/orchestrate command', () => {
  beforeEach(() => {
    mockHiveBridgeModule()
  })

  afterEach(() => {
    mock.restore()
  })

  test('shows usage help when no task is provided', async () => {
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: () => ({
          analysis: { complexity: 1, category: 'simple', needsCouncil: false },
          executionPlan: [],
        }),
        execute: async () => ({
          status: 'completed',
          councilTriggered: false,
          teamSpawned: false,
          steps: [],
        }),
      }),
    }))

    const { call } = await importFreshOrchestrateModule()
    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Orchestrate Command')
    expect(result.value).toContain('Usage: /orchestrate <complex task>')
  })

  test('renders a dry-run execution plan from the hybrid orchestrator', async () => {
    let analyzeMessage = ''
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: (message: string) => {
          analyzeMessage = message
          return {
          analysis: {
            complexity: 7,
            category: 'critical',
            needsCouncil: true,
          },
          executionPlan: ['Consult council', 'Spawn swarm', 'Save checkpoint'],
        }
        },
        execute: async () => ({
          status: 'completed',
          councilTriggered: true,
          teamSpawned: true,
          steps: [],
        }),
      }),
    }))

    const { call } = await importFreshOrchestrateModule()
    const result = await call(
      'Stabilize production incident --dry-run --council',
      {} as never,
    )

    expect(result.type).toBe('text')
    expect(result.value).toContain('Orchestration Plan')
    expect(result.value).toContain('Complexity: 7/10 (critical)')
    expect(result.value).toContain('Council warranted: YES')
    expect(result.value).toContain('Consult council')
    expect(result.value).toContain('Spawn swarm')
    expect(analyzeMessage).toBe('Stabilize production incident')
  })

  test('renders execution results when not in dry-run mode', async () => {
    let executeOptions: { councilMode?: string } | undefined
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: () => ({
          analysis: {
            complexity: 5,
            category: 'complex',
            needsCouncil: false,
          },
          executionPlan: ['Analyze task'],
        }),
        execute: async (_task: string, _history: unknown[], _tools: unknown[], _context?: unknown, options?: { councilMode?: string }) => {
          executeOptions = options
          return {
          status: 'completed',
          councilTriggered: true,
          councilSessionId: 'council-42',
          teamSpawned: true,
          teamId: 'team-77',
          checkpointId: 'checkpoint-9',
          steps: [
            {
              step: 'Council review',
              status: 'completed',
              output: 'Consensus reached',
            },
          ],
          }
        },
      }),
    }))

    const { call } = await importFreshOrchestrateModule()
    const result = await call('Investigate flaky orchestrator behavior', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Orchestration Execution')
    expect(result.value).toContain('Council triggered:')
    expect(result.value).toContain('Session: council-42')
    expect(result.value).toContain('Team: team-77')
    expect(result.value).toContain('Checkpoint: checkpoint-9')
    expect(result.value).toContain('Council review: Consensus reached')
    expect(executeOptions).toEqual({ councilMode: 'balanced' })
  })

  test('passes the selected council mode through to the hybrid orchestrator', async () => {
    let executeOptions: { councilMode?: string } | undefined
    mockHiveBridgeModule(['deliberation', 'vision'])
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: () => ({
          analysis: {
            complexity: 5,
            category: 'complex',
            needsCouncil: true,
          },
          executionPlan: ['Analyze task'],
        }),
        execute: async (_task: string, _history: unknown[], _tools: unknown[], _context?: unknown, options?: { councilMode?: string }) => {
          executeOptions = options
          return {
            status: 'completed',
            councilTriggered: true,
            teamSpawned: false,
            steps: [],
          }
        },
      }),
    }))

    const { call } = await importFreshOrchestrateModule()
    const result = await call('Investigate council integration --mode=vision', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Council warranted: YES (vision)')
    expect(executeOptions).toEqual({ councilMode: 'vision' })
  })
})
