import { afterEach, describe, expect, mock, test } from 'bun:test'
import { call, setSenateTestDeps } from './senate-impl.js'

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

function setHive(overrides: Record<string, unknown>) {
  setSenateTestDeps({
    getHiveBridge: () =>
      ({
        getActiveDecrees: mock(async () => []),
        getDecree: mock(async () => null),
        isHealthy: mock(async () => true),
        issueDecree: mock(async () => ({ success: true, decreeId: 'DECREE-1' })),
        ...overrides,
      }) as never,
  })
}

describe('/senate command', () => {
  afterEach(() => {
    setSenateTestDeps(null)
  })

  test('lists active decrees from Hive Nation', async () => {
    setHive({
      getActiveDecrees: mock(async () => [
        {
          id: 'DECREE-1',
          title: 'Safe Automation',
          content: 'Agents must verify destructive actions.',
          status: 'active',
          priority: 'medium',
          scope: 'agent',
          createdAt: Date.now(),
        },
      ]),
    })

    const result = expectTextResult(await call('list', {} as never))

    expect(result.value).toContain('Active decrees (1)')
    expect(result.value).toContain('[DECREE-1] Safe Automation')
  })

  test('supports bare README-style decree issue shorthand', async () => {
    const issueDecree = mock(async () => ({ success: true, decreeId: 'DECREE-2' }))
    setHive({ issueDecree })

    const result = expectTextResult(
      await call('"No Destructive Commands" | "Agents SHALL NOT execute rm -rf"', {} as never),
    )

    expect(issueDecree).toHaveBeenCalledWith(
      'No Destructive Commands',
      'Agents SHALL NOT execute rm -rf',
    )
    expect(result.value).toContain('Decree issued: "No Destructive Commands"')
  })

  test('shows decree details by id', async () => {
    setHive({
      getDecree: mock(async () => ({
        id: 'DECREE-3',
        title: 'Privacy Protection',
        content: 'Encrypt sensitive data.',
        status: 'active',
        priority: 'high',
        scope: 'agent',
        createdAt: Date.now(),
        votes: { yeas: 7, nays: 1, abstainers: 0 },
      })),
    })

    const result = expectTextResult(await call('show DECREE-3', {} as never))

    expect(result.value).toContain('Privacy Protection')
    expect(result.value).toContain('Votes: 7 yeas / 1 nays')
  })

  test('reports the source-checkout council runtime command when Hive is offline', async () => {
    setHive({
      getActiveDecrees: mock(async () => []),
      isHealthy: mock(async () => false),
    })

    const result = expectTextResult(await call('list', {} as never))

    expect(result.value).toContain('Hive Nation offline')
    expect(result.value).toContain('bun run council:serve')
    expect(result.value).toContain('DUCKHIVE_COUNCIL_URL')
  })
})
