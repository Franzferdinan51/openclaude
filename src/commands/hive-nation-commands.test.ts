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
    getCurrentSession: mock(async () => null),
    startDeliberation: mock(async () => ({ success: true, sessionId: 'session-1' })),
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

  test('/team lists templates and spawns teams through the bridge', async () => {
    const bridge = makeHiveBridge()
    setTeamTestDeps({ getHiveBridge: (() => bridge) as never })

    const templates = expectText(await teamCall('templates', {} as never))
    expect(templates.value).toContain('Team templates')
    expect(templates.value).toContain('code')

    const spawned = expectText(await teamCall('spawn api squad code', {} as never))
    expect(bridge.spawnTeam).toHaveBeenCalledWith('api squad', 'code')
    expect(spawned.value).toContain('Team spawned')
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
  })

  test('/swarm supports list, dry-run, and injected teammate spawning', async () => {
    const spawnTeammate = mock(async ({ name }: { name: string }) => ({
      data: {
        teammate_id: `${name}-teammate`,
        agent_id: `${name}-agent`,
      },
    }))
    setSwarmTestDeps({
      spawnTeammate: spawnTeammate as never,
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

    const spawned = expectText(
      await swarmCall('build an auth api --domain=build --count=2', {} as never),
    )
    expect(spawnTeammate).toHaveBeenCalledTimes(2)
    expect(spawned.value).toContain('2/2 agents spawned')
    expect(spawned.value).toContain('SWARM APPROVED')
  })
})
