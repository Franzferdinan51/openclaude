import { afterEach, describe, expect, test } from 'bun:test'
import { call, setCostCommandTestDeps } from './cost.js'

afterEach(() => {
  setCostCommandTestDeps(null)
})

describe('/cost command', () => {
  test('uses DuckHive wording for subscription-backed usage', async () => {
    setCostCommandTestDeps({
      isClaudeAISubscriber: () => true,
      currentLimits: { isUsingOverage: false } as never,
    })

    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('DuckHive usage')
    expect(result.value).not.toContain('Claude Code usage')
  })

  test('uses DuckHive wording for overage usage', async () => {
    setCostCommandTestDeps({
      isClaudeAISubscriber: () => true,
      currentLimits: { isUsingOverage: true } as never,
    })

    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('overages to power your DuckHive usage')
    expect(result.value).not.toContain('Claude Code usage')
  })

  test('falls back to session cost for non-subscribers', async () => {
    setCostCommandTestDeps({
      isClaudeAISubscriber: () => false,
      formatTotalCost: () => '$0.01',
    })

    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toBe('$0.01')
  })
})
