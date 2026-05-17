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
    expect(result.value).toContain('duckhive orchestrate <complex task>')
    expect(result.value).toContain('/orchestrate <complex task>')
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

  test('accepts separated mode and team flag values', async () => {
    let executeOptions: { councilMode?: string } | undefined
    mockHiveBridgeModule(['deliberation', 'vision'])
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: () => ({
          analysis: {
            complexity: 4,
            category: 'moderate',
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
    const result = await call('Investigate council integration --mode vision --team code', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Council warranted: YES (vision)')
    expect(result.value).toContain('Team spawn: YES (code)')
    expect(executeOptions).toEqual({ councilMode: 'vision' })
  })

  test('rejects unterminated quoted tasks before orchestration analysis', async () => {
    let analyzeCalled = false
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: () => {
          analyzeCalled = true
          return {
            analysis: {
              complexity: 5,
              category: 'complex',
              needsCouncil: true,
            },
            executionPlan: ['Analyze task'],
          }
        },
        execute: async () => ({
          status: 'completed',
          councilTriggered: true,
          teamSpawned: false,
          steps: [],
        }),
      }),
    }))

    const { call } = await importFreshOrchestrateModule()
    const result = await call('"Investigate council integration --mode vision', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Unterminated quoted string in /orchestrate arguments.')
    expect(analyzeCalled).toBe(false)
  })

  test('rejects unknown council modes before orchestration analysis', async () => {
    let analyzeCalled = false
    mockHiveBridgeModule(['deliberation', 'consensus'])
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: () => {
          analyzeCalled = true
          return {
            analysis: {
              complexity: 5,
              category: 'complex',
              needsCouncil: true,
            },
            executionPlan: ['Analyze task'],
          }
        },
        execute: async () => ({
          status: 'completed',
          councilTriggered: true,
          teamSpawned: false,
          steps: [],
        }),
      }),
    }))

    const { call } = await importFreshOrchestrateModule()
    const result = await call('Investigate council integration --mode=quantum', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Unknown council mode: quantum')
    expect(result.value).toContain('Available modes: deliberation, consensus')
    expect(analyzeCalled).toBe(false)
  })

  test('maps concensus spelling to consensus mode for council compatibility', async () => {
    let executeOptions: { councilMode?: string } | undefined
    mockHiveBridgeModule(['deliberation', 'consensus'])
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
    const result = await call('Investigate council integration --mode=concensus', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Council warranted: YES (consensus)')
    expect(executeOptions).toEqual({ councilMode: 'consensus' })
  })

  test('rejects unknown team templates instead of silently ignoring them', async () => {
    let analyzeCalled = false
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: () => {
          analyzeCalled = true
          return {
            analysis: {
              complexity: 5,
              category: 'complex',
              needsCouncil: false,
            },
            executionPlan: ['Analyze task'],
          }
        },
        execute: async () => ({
          status: 'completed',
          councilTriggered: false,
          teamSpawned: false,
          steps: [],
        }),
      }),
    }))

    const { call } = await importFreshOrchestrateModule()
    const result = await call('Build API --team=quantum', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Unknown team template: quantum')
    expect(result.value).toContain('research, code, security')
    expect(analyzeCalled).toBe(false)
  })

  test('accepts known team templates in dry-run planning', async () => {
    mock.module('../../orchestrator/hybrid/index.js', () => ({
      createHybridOrchestrator: () => ({
        analyze: () => ({
          analysis: {
            complexity: 3,
            category: 'moderate',
            needsCouncil: false,
          },
          executionPlan: ['Analyze task'],
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
    const result = await call('Build API --team=code --dry-run', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Team spawn: YES (code)')
  })
})
