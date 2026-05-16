import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { call, parseArgs, setRepomapTestDeps } from './repomap.js'

describe('/repomap command behavior', () => {
  beforeEach(() => {
    setRepomapTestDeps({
      getCwd: () => 'C:\\repo',
    })
  })

  afterEach(() => {
    setRepomapTestDeps(null)
  })

  test('renders cache stats when called with --stats', async () => {
    setRepomapTestDeps({
      buildRepoMap: mock(async () => ({
        map: 'unused',
        fileCount: 0,
        totalFileCount: 0,
        tokenCount: 0,
        buildTimeMs: 0,
        cacheHit: false,
      })),
      invalidateCache: mock(() => {}),
      getCacheStats: () => ({
        cacheDir: 'C:\\repo\\.duckhive\\repomap',
        cacheFile: 'C:\\repo\\.duckhive\\repomap\\map.json',
        entryCount: 7,
        exists: true,
      }),
      getCwd: () => 'C:\\repo',
    })

    const result = await call('--stats', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('expected text result')
    expect(result.value).toContain('Repository map cache stats:')
    expect(result.value).toContain('Cached entries: 7')
    expect(result.value).toContain('Cache exists: true')
  })

  test('invalidates and rebuilds the repo map when called with --invalidate', async () => {
    const invalidateCache = mock(() => {})
    const buildRepoMap = mock(async () => ({
      map: 'ranked/file.ts\nranked/other.ts',
      fileCount: 2,
      totalFileCount: 14,
      tokenCount: 1234,
      buildTimeMs: 55,
      cacheHit: false,
    }))

    setRepomapTestDeps({
      buildRepoMap,
      invalidateCache,
      getCacheStats: () => ({
        cacheDir: 'unused',
        cacheFile: null,
        entryCount: 0,
        exists: false,
      }),
      getCwd: () => 'C:\\repo',
    })

    const result = await call('--invalidate --tokens 4096 --focus src/tools', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('expected text result')
    expect(invalidateCache).toHaveBeenCalledWith('C:\\repo')
    expect(buildRepoMap).toHaveBeenCalledWith({
      root: 'C:\\repo',
      maxTokens: 4096,
      focusFiles: ['src/tools'],
    })
    expect(result.value).toContain('Cache invalidated and rebuilt.')
    expect(result.value).toContain('Files: 2 ranked (14 total)')
    expect(result.value).toContain('ranked/file.ts')
  })
})

describe('/repomap argument parsing', () => {
  test('defaults to 1024 tokens with no flags', () => {
    const result = parseArgs('')
    expect(result.tokens).toBe(2048)
    expect(result.focus).toEqual([])
    expect(result.invalidate).toBe(false)
    expect(result.stats).toBe(false)
  })

  test('parses --tokens flag', () => {
    const result = parseArgs('--tokens 4096')
    expect(result.tokens).toBe(4096)
  })

  test('rejects --tokens below 256', () => {
    const result = parseArgs('--tokens 100')
    expect(result.tokens).toBe(2048) // falls back to default
  })

  test('rejects --tokens above 16384', () => {
    const result = parseArgs('--tokens 20000')
    expect(result.tokens).toBe(2048) // falls back to default
  })

  test('parses --focus flag', () => {
    const result = parseArgs('--focus src/tools/')
    expect(result.focus).toEqual(['src/tools/'])
  })

  test('parses multiple --focus flags', () => {
    const result = parseArgs('--focus src/tools/ --focus src/context.ts')
    expect(result.focus).toEqual(['src/tools/', 'src/context.ts'])
  })

  test('parses --invalidate flag', () => {
    const result = parseArgs('--invalidate')
    expect(result.invalidate).toBe(true)
    expect(result.stats).toBe(false)
  })

  test('parses --stats flag', () => {
    const result = parseArgs('--stats')
    expect(result.stats).toBe(true)
    expect(result.invalidate).toBe(false)
  })

  test('parses combined flags', () => {
    const result = parseArgs('--tokens 2048 --focus src/tools/ --invalidate')
    expect(result.tokens).toBe(2048)
    expect(result.focus).toEqual(['src/tools/'])
    expect(result.invalidate).toBe(true)
  })
})
