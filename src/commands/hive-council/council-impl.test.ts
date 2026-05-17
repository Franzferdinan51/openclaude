import { afterEach, describe, expect, mock, test } from 'bun:test'
import { call, setCouncilTestDeps } from './council-impl.js'

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

function setHive(overrides: Record<string, unknown>) {
  setCouncilTestDeps({
    getHiveBridge: () =>
      ({
        getCurrentSession: mock(async () => null),
        getModes: mock(async () => ['deliberation', 'consensus']),
        getCouncilors: mock(async () => []),
        isHealthy: mock(async () => true),
        startDeliberation: mock(async () => ({ success: true, sessionId: 'council-1' })),
        stopDeliberation: mock(async () => ({ success: true })),
        ...overrides,
      }) as never,
  })
}

describe('/council command', () => {
  afterEach(() => {
    setCouncilTestDeps(null)
  })

  test('lists live council modes from Hive Nation', async () => {
    setHive({
      getModes: mock(async () => ['deliberation', 'vision']),
    })

    const result = expectTextResult(await call('--modes', {} as never))

    expect(result.value).toContain('Council modes')
    expect(result.value).toContain('- deliberation')
    expect(result.value).toContain('- vision')
  })

  test('shows terminal and REPL usage when no question is provided', async () => {
    setHive({
      getModes: mock(async () => ['deliberation', 'vision']),
    })

    const result = expectTextResult(await call('', {} as never))

    expect(result.value).toContain('AI Council')
    expect(result.value).toContain('duckhive council --modes')
    expect(result.value).toContain('/council --modes')
    expect(result.value).toContain('Available modes: deliberation, vision')
  })

  test('lists live councilors from Hive Nation', async () => {
    setHive({
      getCouncilors: mock(async () => [
        {
          id: 'c1',
          name: 'Risk Auditor',
          role: 'Auditor',
          specialty: 'Risk',
        },
      ]),
    })

    const result = expectTextResult(await call('--councilors', {} as never))

    expect(result.value).toContain('Council deck')
    expect(result.value).toContain('Risk Auditor (Auditor - Risk)')
  })

  test('starts deliberation with inline README mode syntax', async () => {
    const startDeliberation = mock(async () => ({ success: true, sessionId: 'council-42' }))
    setHive({ startDeliberation })

    const result = expectTextResult(
      await call('"Should we use microservices?" mode=consensus', {} as never),
    )

    expect(startDeliberation).toHaveBeenCalledWith(
      'Should we use microservices?',
      'consensus',
    )
    expect(result.value).toContain('Council deliberation started')
    expect(result.value).toContain('Session: council-42')
  })

  test('starts deliberation with separated mode flag values', async () => {
    const startDeliberation = mock(async () => ({ success: true, sessionId: 'council-42' }))
    setHive({ startDeliberation })

    const result = expectTextResult(
      await call('"Should we ship?" --mode consensus', {} as never),
    )

    expect(startDeliberation).toHaveBeenCalledWith('Should we ship?', 'consensus')
    expect(result.value).toContain('Mode: consensus')
  })

  test('preserves escaped quotes in council questions', async () => {
    const startDeliberation = mock(async () => ({ success: true, sessionId: 'council-42' }))
    setHive({ startDeliberation })

    const result = expectTextResult(
      await call('"Should we ship the \\"fast\\" path?" --mode consensus', {} as never),
    )

    expect(startDeliberation).toHaveBeenCalledWith(
      'Should we ship the "fast" path?',
      'consensus',
    )
    expect(result.value).toContain('Council deliberation started')
  })

  test('rejects unterminated council questions before starting deliberation', async () => {
    const startDeliberation = mock(async () => ({ success: true, sessionId: 'unused' }))
    setHive({ startDeliberation })

    const result = expectTextResult(
      await call('"Should we ship? --mode consensus', {} as never),
    )

    expect(result.value).toContain('Unterminated quoted string in /council arguments.')
    expect(startDeliberation).not.toHaveBeenCalled()
  })

  test('rejects unknown modes before starting deliberation', async () => {
    const startDeliberation = mock(async () => ({ success: true, sessionId: 'unused' }))
    setHive({ startDeliberation })

    const result = expectTextResult(
      await call('Should we ship? --mode=quantum', {} as never),
    )

    expect(result.value).toContain('Unknown council mode: quantum')
    expect(result.value).toContain('Available modes: deliberation, consensus')
    expect(startDeliberation).not.toHaveBeenCalled()
  })

  test('maps concensus spelling to consensus mode for upstream compatibility', async () => {
    const startDeliberation = mock(async () => ({ success: true, sessionId: 'council-42' }))
    setHive({ startDeliberation })

    const result = expectTextResult(
      await call('Should we ship? --mode=concensus', {} as never),
    )

    expect(startDeliberation).toHaveBeenCalledWith(
      'Should we ship?',
      'consensus',
    )
    expect(result.value).toContain('Mode: consensus')
  })

  test('rejects missing mode values before starting deliberation', async () => {
    const startDeliberation = mock(async () => ({ success: true, sessionId: 'unused' }))
    setHive({ startDeliberation })

    const result = expectTextResult(
      await call('Should we ship? --mode', {} as never),
    )

    expect(result.value).toContain('Missing council mode value')
    expect(result.value).toContain('Available modes: deliberation, consensus')
    expect(startDeliberation).not.toHaveBeenCalled()
  })

  test('reports source-checkout runtime command when Hive is offline', async () => {
    setHive({
      isHealthy: mock(async () => false),
      startDeliberation: mock(async () => ({ success: false, error: 'offline' })),
    })

    const result = expectTextResult(await call('Should we ship?', {} as never))

    expect(result.value).toContain('AI Council is offline')
    expect(result.value).toContain('bun run council:serve')
  })
})
