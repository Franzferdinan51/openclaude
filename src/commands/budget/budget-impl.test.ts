import { afterEach, describe, expect, mock, test } from 'bun:test'
import { call, setBudgetTestDeps } from './budget-impl.js'

afterEach(() => {
  setBudgetTestDeps(null)
})

function baseState() {
  return {
    providerSettings: {
      minimax: { dailyBudgetUsd: 5, enabled: true, priority: 10 },
      openai: { dailyBudgetUsd: 10, enabled: true, priority: 10 },
    },
    globalDailyBudgetUsd: 20,
    dailySpend: {
      minimax: {
        provider: 'minimax',
        date: '2026-05-16',
        spentUsd: 1.25,
        requests: 2,
        tokensUsed: 1000,
      },
    },
    lastResetDate: '2026-05-16',
  }
}

describe('/budget command', () => {
  test('shows budget status by default', async () => {
    setBudgetTestDeps({
      getBudgetState: () => baseState() as any,
      getGlobalRemainingBudget: () => 18.75,
      getProvidersByCost: () => [
        { provider: 'minimax', costPerM: 1.5 },
        { provider: 'openai', costPerM: 15 },
      ] as any,
    })

    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Budget tracker')
    expect(result.value).toContain('Global remaining: $18.75 / $20.00')
    expect(result.value).toContain('minimax: spent $1.25 / $5.00')
    expect(result.value).toContain('budget-state.json')
  })

  test('sets provider budgets', async () => {
    const setProviderBudgetMock = mock(() => {})
    setBudgetTestDeps({
      getBudgetState: () => baseState() as any,
      getGlobalRemainingBudget: () => 18.75,
      getProvidersByCost: () => [{ provider: 'minimax', costPerM: 1.5 }] as any,
      setProviderBudget: setProviderBudgetMock as never,
    })

    const result = await call('set minimax 7.5', {} as never)

    expect(setProviderBudgetMock).toHaveBeenCalledWith('minimax', { dailyBudgetUsd: 7.5 })
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('minimax daily budget set to $7.50')
  })

  test('resets spend counters', async () => {
    const resetAllSpendMock = mock(() => {})
    setBudgetTestDeps({
      getBudgetState: () => baseState() as any,
      getGlobalRemainingBudget: () => 18.75,
      getProvidersByCost: () => [{ provider: 'minimax', costPerM: 1.5 }] as any,
      resetAllSpend: resetAllSpendMock as never,
    })

    const result = await call('reset', {} as never)

    expect(resetAllSpendMock).toHaveBeenCalled()
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Budget spend counters reset')
  })
})
