import { afterEach, describe, expect, mock, test } from 'bun:test'
import { call, setDecreeTestDeps } from './decree-impl.js'

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

function setHive(overrides: Record<string, unknown>) {
  setDecreeTestDeps({
    getHiveBridge: () =>
      ({
        getActiveDecrees: mock(async () => []),
        isHealthy: mock(async () => true),
        issueDecree: mock(async () => ({ success: true, decreeId: 'DECREE-1' })),
        ...overrides,
      }) as never,
  })
}

describe('/decree command', () => {
  afterEach(() => {
    setDecreeTestDeps(null)
  })

  test('lists active decrees from Hive Nation', async () => {
    setHive({
      getActiveDecrees: mock(async () => [
        {
          id: 'DECREE-1',
          title: 'Safe Automation',
          content: 'Agents must verify destructive actions.',
          status: 'active',
          authority: 'senate',
          scope: 'agent',
          priority: 'high',
          createdAt: Date.now(),
        },
      ]),
    })

    const result = expectTextResult(await call('list', {} as never))

    expect(result.value).toContain('Active decrees:')
    expect(result.value).toContain('[high] Safe Automation')
    expect(result.value).toContain('Agents must verify destructive actions.')
  })

  test('shows terminal and REPL usage in help output', async () => {
    setHive({})

    const result = expectTextResult(await call('help', {} as never))

    expect(result.value).toContain('Decree command')
    expect(result.value).toContain('duckhive decree list')
    expect(result.value).toContain('duckhive decree <title> | <content>')
    expect(result.value).toContain('/decree list')
  })

  test('issues README-style title and content decree', async () => {
    const issueDecree = mock(async () => ({ success: true, decreeId: 'DECREE-2' }))
    setHive({ issueDecree })

    const result = expectTextResult(
      await call('"No Destructive Commands" | "Agents SHALL ask before destructive commands"', {} as never),
    )

    expect(issueDecree).toHaveBeenCalledWith(
      'No Destructive Commands',
      'Agents SHALL ask before destructive commands',
    )
    expect(result.value).toContain('Decree enacted: "No Destructive Commands"')
  })

  test('preserves escaped quotes in decree title and content', async () => {
    const issueDecree = mock(async () => ({ success: true, decreeId: 'DECREE-2' }))
    setHive({ issueDecree })

    const result = expectTextResult(
      await call('"No \\"rm -rf\\"" | "Agents SHALL ask before \\"destructive\\" commands"', {} as never),
    )

    expect(issueDecree).toHaveBeenCalledWith(
      'No "rm -rf"',
      'Agents SHALL ask before "destructive" commands',
    )
    expect(result.value).toContain('Decree enacted: "No "rm -rf""')
  })

  test('rejects unterminated decree text before issuing', async () => {
    const issueDecree = mock(async () => ({ success: true, decreeId: 'DECREE-2' }))
    setHive({ issueDecree })

    const result = expectTextResult(
      await call('"No Destructive Commands | Agents SHALL ask', {} as never),
    )

    expect(result.value).toContain('Unterminated quoted string in /decree arguments.')
    expect(issueDecree).not.toHaveBeenCalled()
  })

  test('reports source-checkout runtime command when Hive is offline', async () => {
    setHive({
      getActiveDecrees: mock(async () => []),
      isHealthy: mock(async () => false),
    })

    const result = expectTextResult(await call('list', {} as never))

    expect(result.value).toContain('Hive Nation offline')
    expect(result.value).toContain('bun run council:serve')
    expect(result.value).toContain('DUCKHIVE_COUNCIL_URL')
  })

  test('reports source-checkout runtime command when issue fails offline', async () => {
    setHive({
      issueDecree: mock(async () => ({ success: false, error: 'offline' })),
    })

    const result = expectTextResult(await call('Secure Mode | Verify changes', {} as never))

    expect(result.value).toContain('Failed: offline')
    expect(result.value).toContain('bun run council:serve')
  })
})
