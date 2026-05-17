import { afterEach, describe, expect, mock, test } from 'bun:test'
import { call, setTeamTestDeps } from './team-impl.js'

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

function setHive(overrides: Record<string, unknown>) {
  setTeamTestDeps({
    getHiveBridge: () =>
      ({
        getActiveTeams: mock(async () => []),
        isHealthy: mock(async () => true),
        spawnTeam: mock(async () => ({ success: true })),
        ...overrides,
      }) as never,
  })
}

describe('/team command', () => {
  afterEach(() => {
    setTeamTestDeps(null)
  })

  test('lists active teams from Hive Nation', async () => {
    setHive({
      getActiveTeams: mock(async () => [
        {
          name: 'release-squad',
          template: 'code',
          status: 'active',
          roles: ['coder', 'reviewer'],
        },
      ]),
    })

    const result = expectTextResult(await call('list', {} as never))

    expect(result.value).toContain('Active teams (1)')
    expect(result.value).toContain('release-squad (code)')
    expect(result.value).toContain('Roles: 2')
  })

  test('reports the source-checkout council runtime command when Hive is offline', async () => {
    setHive({
      getActiveTeams: mock(async () => []),
      isHealthy: mock(async () => false),
    })

    const result = expectTextResult(await call('list', {} as never))

    expect(result.value).toContain('Hive Nation offline')
    expect(result.value).toContain('bun run council:serve')
    expect(result.value).toContain('DUCKHIVE_COUNCIL_URL')
  })

  test('supports README shorthand template form', async () => {
    const spawnTeam = mock(async () => ({ success: true }))
    setHive({ spawnTeam })

    const result = expectTextResult(
      await call('analysis "Research Redis caching"', {} as never),
    )

    expect(spawnTeam).toHaveBeenCalledWith('Research Redis caching', 'analysis')
    expect(result.value).toContain('Team spawned.')
    expect(result.value).toContain('Template: analysis')
  })

  test('rejects unknown explicit templates instead of silently using research', async () => {
    const spawnTeam = mock(async () => ({ success: true }))
    setHive({ spawnTeam })

    const result = expectTextResult(
      await call('spawn "Research Redis caching" mystery', {} as never),
    )

    expect(result.value).toContain('Unknown team template: mystery')
    expect(result.value).toContain('Available templates:')
    expect(spawnTeam).not.toHaveBeenCalled()
  })
})
