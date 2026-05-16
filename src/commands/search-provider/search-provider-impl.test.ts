import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type {
  DuckHiveSearchProvider,
  DuckHiveSearchSettings,
} from '../../utils/duckhiveSearch.js'

let settings: DuckHiveSearchSettings
let savedProvider: DuckHiveSearchProvider | undefined
let savedSearxngUrl: string | undefined

async function importFreshSearchProviderModule() {
  return await import(
    `./search-provider-impl.ts?search-provider-test=${Date.now()}-${Math.random()}`
  )
}

describe('/search-provider command', () => {
  beforeEach(() => {
    settings = {}
    savedProvider = undefined
    savedSearxngUrl = undefined

    mock.module('../../utils/duckhiveSearch.js', () => {
      const aliases: Record<string, DuckHiveSearchProvider> = {
        auto: 'auto',
        minimax: 'minimax',
        mmx: 'minimax',
        'minimax-cli': 'minimax',
        native: 'native',
        custom: 'custom',
        searxng: 'searxng',
        searx: 'searxng',
        firecrawl: 'firecrawl',
        ddg: 'ddg',
        duckduckgo: 'ddg',
        tavily: 'tavily',
        exa: 'exa',
        you: 'you',
        youcom: 'you',
        jina: 'jina',
        bing: 'bing',
        mojeek: 'mojeek',
        linkup: 'linkup',
      }

      return {
        normalizeDuckHiveSearchProvider: (value?: string | null) =>
          value ? aliases[value.trim().toLowerCase()] : undefined,
        getConfiguredDuckHiveSearchProvider: (
          config: DuckHiveSearchSettings | null | undefined,
        ) =>
          config?.search?.provider
            ? aliases[config.search.provider.trim().toLowerCase()] ?? 'auto'
            : 'auto',
        readDuckHiveSearchSettingsSync: () => settings,
        setDuckHiveSearchPreferenceSync: (
          provider: DuckHiveSearchProvider,
          options?: { searxngUrl?: string },
        ) => {
          savedProvider = provider
          savedSearxngUrl = options?.searxngUrl
          settings = {
            ...settings,
            search: {
              ...(settings.search ?? {}),
              provider,
              ...(options?.searxngUrl
                ? { searxngUrl: options.searxngUrl }
                : {}),
            },
          }
          return settings
        },
      }
    })
  })

  afterEach(() => {
    mock.restore()
  })

  test('reports the current provider without mutating settings', async () => {
    settings = { search: { provider: 'ddg' } }
    const { call } = await importFreshSearchProviderModule()

    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Provider: ddg')
    expect(savedProvider).toBeUndefined()
  })

  test('saves provider aliases through the shared normalizer', async () => {
    const { call } = await importFreshSearchProviderModule()

    const result = await call('duckduckgo', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(savedProvider).toBe('ddg')
    expect(result.value).toContain('Search provider set to ddg.')
  })

  test('requires a SearXNG URL unless one is already saved', async () => {
    const { call } = await importFreshSearchProviderModule()

    const missing = await call('searxng', {} as never)
    expect(missing.type).toBe('text')
    if (missing.type !== 'text') throw new Error('unexpected result type')
    expect(missing.value).toContain('SearXNG requires --url')
    expect(savedProvider).toBeUndefined()

    const saved = await call('searxng --url http://localhost:8080/search', {} as never)
    expect(saved.type).toBe('text')
    if (saved.type !== 'text') throw new Error('unexpected result type')
    expect(savedProvider).toBe('searxng')
    expect(savedSearxngUrl).toBe('http://localhost:8080/search')
    expect(saved.value).toContain('SearXNG URL: http://localhost:8080/search')
  })

  test('returns usage for unknown providers', async () => {
    const { call } = await importFreshSearchProviderModule()

    const result = await call('unknown-provider', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Unknown search provider: unknown-provider')
    expect(result.value).toContain('/search-provider')
  })
})
