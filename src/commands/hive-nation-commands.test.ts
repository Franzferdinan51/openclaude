import { afterEach, describe, expect, mock, test } from 'bun:test'
import { call as councilCall, setCouncilTestDeps } from './hive-council/council-impl.js'
import { call as decreeCall, setDecreeTestDeps } from './hive-decree/decree-impl.js'
import { call as senateCall, setSenateTestDeps } from './hive-senate/senate-impl.js'
import { call as swarmCall, setSwarmTestDeps } from './hive-swarm/swarm-impl.js'
import { call as teamCall, setTeamTestDeps } from './hive-team/team-impl.js'

function expectText(result: Awaited<ReturnType<typeof councilCall>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') throw new Error('expected text result')
  return result
}

function makeHiveBridge(overrides: Record<string, unknown> = {}) {
  return {
    getModes: mock(async () => ['balanced', 'adversarial']),
    getCouncilors: mock(async () => []),
    getCurrentSession: mock(async () => null),
    startDeliberation: mock(async () => ({ success: true, sessionId: 'session-1' })),
    stopDeliberation: mock(async () => ({ success: true })),
    isHealthy: mock(async () => true),
    getActiveTeams: mock(async () => []),
    spawnTeam: mock(async () => ({ success: true, teamId: 'team-1' })),
    getActiveDecrees: mock(async () => []),
    issueDecree: mock(async () => ({ success: true, decreeId: 'decree-1' })),
    getDecree: mock(async () => null),
    ...overrides,
  }
}

afterEach(() => {
  setCouncilTestDeps(null)
  setTeamTestDeps(null)
  setSenateTestDeps(null)
  setDecreeTestDeps(null)
  setSwarmTestDeps(null)
})

describe('Hive Nation commands', () => {
  test('/council starts deliberation through the bridge', async () => {
    const bridge = makeHiveBridge()
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('--mode=adversarial Review this migration', {} as never))

    expect(bridge.startDeliberation).toHaveBeenCalledWith(
      'Review this migration',
      'adversarial',
    )
    expect(result.value).toContain('Council deliberation started')
    expect(result.value).toContain('session-1')
  })

  test('/council accepts the documented bare mode= form', async () => {
    const bridge = makeHiveBridge()
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(
      await councilCall('"Should we use microservices?" mode=adversarial', {} as never),
    )

    expect(bridge.startDeliberation).toHaveBeenCalledWith(
      'Should we use microservices?',
      'adversarial',
    )
    expect(result.value).toContain('Mode: adversarial')
  })

  test('/council without an explicit mode uses the live backend default mode catalog', async () => {
    const bridge = makeHiveBridge({
      getModes: mock(async () => ['deliberation', 'swarm_coding', 'vision']),
    })
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('Review this migration', {} as never))

    expect(bridge.startDeliberation).toHaveBeenCalledWith(
      'Review this migration',
      'deliberation',
    )
    expect(result.value).toContain('Mode: deliberation')
  })

  test('/council accepts advanced Hive Nation modes carried over from the council repos', async () => {
    const bridge = makeHiveBridge({
      getModes: mock(async () => [
        'balanced',
        'adversarial',
        'consensus',
        'brainstorm',
        'swarm',
        'swarm_coding',
        'deep_research',
        'collaborative',
      ]),
    })
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(
      await councilCall('--mode=deep_research Investigate this architecture', {} as never),
    )

    expect(bridge.startDeliberation).toHaveBeenCalledWith(
      'Investigate this architecture',
      'deep_research',
    )
    expect(result.value).toContain('Mode: deep_research')
  })

  test('/council rejects unknown mode names instead of forwarding them blindly', async () => {
    const bridge = makeHiveBridge()
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(
      await councilCall('--mode=quantum Review this migration', {} as never),
    )

    expect(bridge.startDeliberation).not.toHaveBeenCalled()
    expect(result.value).toContain('Unknown council mode: quantum')
    expect(result.value).toContain('Available modes:')
  })

  test('/council renders active session status', async () => {
    const bridge = makeHiveBridge({
      getCurrentSession: mock(async () => ({
        id: 'session-1',
        topic: 'Refactor auth',
        mode: 'balanced',
        phase: 'voting',
        messages: [{ councilor: 'reviewer', content: 'Proceed carefully', vote: 'yea' }],
        stats: { yeas: 1, nays: 0, abstainers: 0 },
      })),
    })
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('--status', {} as never))

    expect(result.value).toContain('Active deliberation')
    expect(result.value).toContain('Refactor auth')
    expect(result.value).toContain('yes 1 / no 0 / abstain 0')
  })

  test('/council status without an active session points source checkouts to the local runtime command', async () => {
    const bridge = makeHiveBridge({
      getCurrentSession: mock(async () => null),
    })
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('--status', {} as never))

    expect(result.value).toContain('No active council deliberation.')
    expect(result.value).toContain('bun run council:serve')
  })

  test('/council lists the live mode catalog from the bridge', async () => {
    const bridge = makeHiveBridge({
      getModes: mock(async () => ['deliberation', 'swarm_coding', 'vision']),
    })
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('--modes', {} as never))

    expect(bridge.getModes).toHaveBeenCalled()
    expect(result.value).toContain('Council modes')
    expect(result.value).toContain('- deliberation')
    expect(result.value).toContain('- swarm_coding')
    expect(result.value).toContain('- vision')
  })

  test('/council lists the live councilor deck from the bridge', async () => {
    const bridge = makeHiveBridge({
      getCouncilors: mock(async () => [
        {
          id: 'skeptic',
          name: 'Skeptic',
          role: 'critic',
          specialty: 'risk review',
        },
        {
          id: 'builder',
          name: 'Builder',
          role: 'architect',
          specialty: 'systems design',
        },
      ]),
    })
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('--councilors', {} as never))

    expect(bridge.getCouncilors).toHaveBeenCalled()
    expect(result.value).toContain('Council deck')
    expect(result.value).toContain('Skeptic (critic - risk review)')
    expect(result.value).toContain('Builder (architect - systems design)')
  })

  test('/council stop calls the real bridge stop flow', async () => {
    const bridge = makeHiveBridge()
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('--stop', {} as never))

    expect(bridge.stopDeliberation).toHaveBeenCalled()
    expect(result.value).toContain('Council deliberation stopped.')
  })

  test('/council stop reports a real stop failure instead of fake success', async () => {
    const bridge = makeHiveBridge({
      stopDeliberation: mock(async () => ({ success: false, error: 'session lock failed' })),
      isHealthy: mock(async () => true),
    })
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('--stop', {} as never))

    expect(result.value).toContain('Failed to stop council deliberation: session lock failed')
  })

  test('/council start failure points offline source checkouts to the local runtime command', async () => {
    const bridge = makeHiveBridge({
      startDeliberation: mock(async () => ({ success: false })),
      isHealthy: mock(async () => false),
    })
    setCouncilTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await councilCall('Review this migration', {} as never))

    expect(result.value).toContain('AI Council is offline.')
    expect(result.value).toContain('bun run council:serve')
  })

  test('/team lists templates and spawns teams through the bridge', async () => {
    const bridge = makeHiveBridge()
    setTeamTestDeps({ getHiveBridge: (() => bridge) as never })

    const templates = expectText(await teamCall('templates', {} as never))
    expect(templates.value).toContain('Team templates')
    expect(templates.value).toContain('code')

    const spawned = expectText(await teamCall('spawn api squad code', {} as never))
    expect(bridge.spawnTeam).toHaveBeenCalledWith('api squad', 'code')
    expect(spawned.value).toContain('Team spawned')

    const templateFirst = expectText(
      await teamCall('spawn analysis "Research Redis caching"', {} as never),
    )
    expect(bridge.spawnTeam).toHaveBeenCalledWith(
      'Research Redis caching',
      'analysis',
    )
    expect(templateFirst.value).toContain('Template: analysis')

    const shorthand = expectText(
      await teamCall('research "Research Redis caching"', {} as never),
    )
    expect(bridge.spawnTeam).toHaveBeenCalledWith(
      'Research Redis caching',
      'research',
    )
    expect(shorthand.value).toContain('Template: research')
  })

  test('/team spawn failure points source checkouts to the local runtime command', async () => {
    const bridge = makeHiveBridge({
      spawnTeam: mock(async () => ({ success: false })),
    })
    setTeamTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await teamCall('spawn analysis "Research Redis caching"', {} as never))

    expect(result.value).toContain('Hive Nation offline')
    expect(result.value).toContain('bun run council:serve')
    expect(result.value).toContain('DUCKHIVE_COUNCIL_URL')
  })

  test('/team spawn rejects unknown trailing templates instead of defaulting to research', async () => {
    const bridge = makeHiveBridge()
    setTeamTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await teamCall('spawn api squad quantum', {} as never))

    expect(result.value).toContain('Unknown team template: quantum')
    expect(result.value).toContain('Available templates:')
    expect(result.value).toContain('/team spawn <name> <type>')
    expect(bridge.spawnTeam).not.toHaveBeenCalled()
  })

  test('/team list points source checkouts to the local runtime command when the runtime is offline', async () => {
    const bridge = makeHiveBridge({
      isHealthy: mock(async () => false),
    })
    setTeamTestDeps({ getHiveBridge: (() => bridge) as never })

    const result = expectText(await teamCall('list', {} as never))

    expect(result.value).toContain('Hive Nation offline')
    expect(result.value).toContain('bun run council:serve')
    expect(result.value).toContain('DUCKHIVE_COUNCIL_URL')
  })

  test('/senate and /decree issue and display decrees through the bridge', async () => {
    const decree = {
      id: 'decree-1',
      title: 'Secure Mode',
      content: 'Agents ask before destructive commands',
      status: 'active',
      authority: 'duckhive',
      scope: 'agent',
      priority: 'medium',
      createdAt: Date.UTC(2026, 0, 1),
    }
    const bridge = makeHiveBridge({
      getActiveDecrees: mock(async () => [decree]),
      getDecree: mock(async () => decree),
    })
    setSenateTestDeps({ getHiveBridge: (() => bridge) as never })
    setDecreeTestDeps({ getHiveBridge: (() => bridge) as never })

    const senateList = expectText(await senateCall('list', {} as never))
    expect(senateList.value).toContain('Active decrees')
    expect(senateList.value).toContain('Secure Mode')

    const shown = expectText(await senateCall('show decree-1', {} as never))
    expect(shown.value).toContain('Agents ask before destructive commands')

    const enacted = expectText(
      await decreeCall('Secure Mode | Agents ask before destructive commands', {} as never),
    )
    expect(bridge.issueDecree).toHaveBeenCalledWith(
      'Secure Mode',
      'Agents ask before destructive commands',
    )
    expect(enacted.value).toContain('Decree enacted')

    const shorthandSenate = expectText(
      await senateCall('"Proposal: switch to Bun runtime"', {} as never),
    )
    expect(bridge.issueDecree).toHaveBeenCalledWith(
      'Proposal: switch to Bun runtime',
      'Proposal: switch to Bun runtime',
    )
    expect(shorthandSenate.value).toContain('Decree issued')

    const quotedDecree = expectText(
      await decreeCall('"DECREE-007: Use Bun for all new APIs"', {} as never),
    )
    expect(bridge.issueDecree).toHaveBeenCalledWith(
      'DECREE-007: Use Bun for all new APIs',
      'DECREE-007: Use Bun for all new APIs',
    )
    expect(quotedDecree.value).toContain(
      'Decree enacted: "DECREE-007: Use Bun for all new APIs"',
    )
  })

  test('/senate and /decree failures point source checkouts to the local runtime command', async () => {
    const bridge = makeHiveBridge({
      issueDecree: mock(async () => ({ success: false })),
    })
    setSenateTestDeps({ getHiveBridge: (() => bridge) as never })
    setDecreeTestDeps({ getHiveBridge: (() => bridge) as never })

    const senateResult = expectText(
      await senateCall('Secure Mode | Agents ask before destructive commands', {} as never),
    )
    expect(senateResult.value).toContain('Hive Nation offline')
    expect(senateResult.value).toContain('bun run council:serve')

    const decreeResult = expectText(
      await decreeCall('Secure Mode | Agents ask before destructive commands', {} as never),
    )
    expect(decreeResult.value).toContain('Hive Nation offline')
    expect(decreeResult.value).toContain('bun run council:serve')
  })

  test('/senate list and /decree list point source checkouts to the local runtime command when the runtime is offline', async () => {
    const bridge = makeHiveBridge({
      isHealthy: mock(async () => false),
    })
    setSenateTestDeps({ getHiveBridge: (() => bridge) as never })
    setDecreeTestDeps({ getHiveBridge: (() => bridge) as never })

    const senateResult = expectText(await senateCall('list', {} as never))
    expect(senateResult.value).toContain('Hive Nation offline')
    expect(senateResult.value).toContain('bun run council:serve')
    expect(senateResult.value).toContain('DUCKHIVE_COUNCIL_URL')

    const decreeResult = expectText(await decreeCall('list', {} as never))
    expect(decreeResult.value).toContain('Hive Nation offline')
    expect(decreeResult.value).toContain('bun run council:serve')
    expect(decreeResult.value).toContain('DUCKHIVE_COUNCIL_URL')
  })

  test('/swarm supports list, dry-run, and injected teammate spawning', async () => {
    const spawnTeammate = mock(async ({ name }: { name: string }) => ({
      data: {
        teammate_id: `${name}-teammate`,
        agent_id: `${name}-agent`,
      },
    }))
    const collectResponses = mock(async (agentIds: string[]) => new Map(
      agentIds.map(agentId => [
        agentId,
        {
          text: `${agentId} completed the task with implementation notes.`,
          timestamp: Date.now(),
        },
      ]),
    ))
    const runSwarmVoting = mock(async (_responses: Map<string, unknown>, options: { voters?: string[] }) => {
      const voters = options.voters ?? []
      const winner = voters[0] ?? 'agent-1'
      return {
        winner,
        votes: Object.fromEntries(voters.map(voter => [voter, [winner]])),
        tally: { [winner]: voters.length },
        mode: 'vote' as const,
      }
    })
    setSwarmTestDeps({
      spawnTeammate: spawnTeammate as never,
      collectResponses: collectResponses as never,
      runSwarmVoting: runSwarmVoting as never,
      sleep: async () => {},
    })

    const listed = expectText(await swarmCall('--list', {} as never))
    expect(listed.value).toContain('Available swarm agents')
    expect(listed.value).toContain('architect')

    const dryRun = expectText(
      await swarmCall('build an auth api --domain=build --count=2 --dry-run', {} as never),
    )
    expect(dryRun.value).toContain('Swarm Execution')
    expect(spawnTeammate).not.toHaveBeenCalled()

    const aliasDryRun = expectText(
      await swarmCall('"Audit this security vulnerability" --domain=security --count=1 --dry-run', {} as never),
    )
    expect(aliasDryRun.value).toContain('Task: Audit this security vulnerability')
    expect(aliasDryRun.value).toContain('Domain: audit')

    const spawned = expectText(
      await swarmCall('build an auth api --domain=coding --count=2', {} as never),
    )
    expect(spawnTeammate).toHaveBeenCalledTimes(2)
    expect(collectResponses).toHaveBeenCalled()
    expect(runSwarmVoting).toHaveBeenCalled()
    expect(spawned.value).toContain('2/2 agents spawned')
    expect(spawned.value).toContain('Quality gates configured; evidence pending')
    expect(spawned.value).not.toContain('Running quality gates')
    expect(spawned.value).toContain('Vote winner:')
    expect(spawned.value).toContain('SWARM APPROVED')

    const invalidDomain = expectText(
      await swarmCall('build an auth api --domain=quantum --dry-run', {} as never),
    )
    expect(invalidDomain.value).toContain('Unknown swarm domain: quantum')
  })

  test('/swarm rejects invalid agent counts before spawning teammates', async () => {
    const spawnTeammate = mock(async () => ({
      data: {
        teammate_id: 'unexpected-teammate',
        agent_id: 'unexpected-agent',
      },
    }))
    setSwarmTestDeps({
      spawnTeammate: spawnTeammate as never,
      sleep: async () => {},
    })

    for (const args of [
      'build an auth api --count=-1',
      'build an auth api --count=0',
      'build an auth api --count=1.5',
      'build an auth api --count=9',
      'build an auth api --count',
    ]) {
      const result = expectText(await swarmCall(args, {} as never))
      expect(result.value).toContain('Invalid swarm count')
      expect(result.value).toContain('Allowed range: 1-8')
    }

    expect(spawnTeammate).not.toHaveBeenCalled()
  })

  test('/swarm leaves final approval pending when spawned agents have not responded', async () => {
    const spawnTeammate = mock(async ({ name }: { name: string }) => ({
      data: {
        teammate_id: `${name}-teammate`,
        agent_id: `${name}-agent`,
      },
    }))
    const collectResponses = mock(async () => new Map())
    const runSwarmVoting = mock(async () => {
      throw new Error('runSwarmVoting should not be called without responses')
    })
    setSwarmTestDeps({
      spawnTeammate: spawnTeammate as never,
      collectResponses: collectResponses as never,
      runSwarmVoting: runSwarmVoting as never,
      sleep: async () => {},
    })

    const spawned = expectText(
      await swarmCall('build an auth api --domain=coding --count=2', {} as never),
    )

    expect(spawned.value).toContain('2/2 agents spawned')
    expect(spawned.value).toContain('No completed agent responses found')
    expect(spawned.value).toContain('Release preparation is gated')
    expect(spawned.value).toContain('SWARM PENDING')
    expect(spawned.value).not.toContain('SWARM APPROVED')
    expect(runSwarmVoting).not.toHaveBeenCalled()
  })

  test('/swarm voting modes rank, merge, and tally inline responses', async () => {
    const pickBest = expectText(
      await swarmCall(
        'pick-best "1. Add auth\n2. Add tests\nFinal answer" | "Auth only"',
        {} as never,
      ),
    )
    expect(pickBest.value).toContain('Swarm pick-best')
    expect(pickBest.value).toContain('Winner: agent-1')

    const merged = expectText(
      await swarmCall(
        'merge "First response section" | "Second response section"',
        {} as never,
      ),
    )
    expect(merged.value).toContain('Swarm merge')
    expect(merged.value).toContain('Contributors: agent-1, agent-2')
    expect(merged.value).toContain('First response section')
    expect(merged.value).toContain('Second response section')

    const voted = expectText(
      await swarmCall(
        'vote "Detailed response with steps\n1. Plan\n2. Ship" | "Short reply"',
        {} as never,
      ),
    )
    expect(voted.value).toContain('Swarm vote')
    expect(voted.value).toContain('Winner: agent-1')
    expect(voted.value).toContain('Tally:')

    const usage = expectText(await swarmCall('vote "only one response"', {} as never))
    expect(usage.value).toContain('Swarm voting usage')
  })
})
