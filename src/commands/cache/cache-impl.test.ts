import { afterEach, describe, expect, mock, test } from 'bun:test'
import { call, setCacheTestDeps } from './cache-impl.js'

afterEach(() => {
  setCacheTestDeps(null)
})

describe('/cache command', () => {
  test('shows provider cache stats by default', async () => {
    setCacheTestDeps({
      getCacheStats: () => ({
        size: 3,
        maxSize: 1000,
        hits: 10,
        misses: 5,
        evictions: 1,
        hitRate: 10 / 15,
        ttlMs: 30000,
        ttlSeconds: 30,
      }),
    })

    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Provider cache')
    expect(result.value).toContain('Entries: 3 / 1000')
    expect(result.value).toContain('Hit rate: 67%')
    expect(result.value).toContain('/cache-stats')
  })

  test('clear flushes provider cache and session cache metrics', async () => {
    const clearCache = mock(() => {})
    const resetSessionMetrics = mock(() => {})
    setCacheTestDeps({
      cacheClear: clearCache as never,
      resetSessionCacheStats: resetSessionMetrics as never,
      getCacheStats: () => ({
        size: 0,
        maxSize: 1000,
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: Number.NaN,
        ttlMs: 30000,
        ttlSeconds: 30,
      }),
    })

    const result = await call('clear', {} as never)

    expect(clearCache).toHaveBeenCalled()
    expect(resetSessionMetrics).toHaveBeenCalled()
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Provider cache cleared')
  })
})
