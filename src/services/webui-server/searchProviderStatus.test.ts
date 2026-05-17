import { describe, expect, test } from 'bun:test'
import { getSearchProviderStatus } from './searchProviderStatus.js'

describe('getSearchProviderStatus', () => {
  test('reads search provider config from DuckHive config home', () => {
    const status = getSearchProviderStatus({
      getClaudeConfigHomeDir: () => 'C:/DuckHive',
      existsSync: path => path === 'C:\\DuckHive\\config.json' || path === 'C:/DuckHive/config.json',
      readFileSync: () =>
        JSON.stringify({
          search: {
            provider: 'searxng',
            searxngUrl: 'http://localhost:8080/search',
          },
        }),
    })

    expect(status).toEqual({
      configured: true,
      provider: 'searxng',
      searxngUrl: 'http://localhost:8080/search',
    })
  })

  test('returns unconfigured when the DuckHive config has no search provider', () => {
    const status = getSearchProviderStatus({
      getClaudeConfigHomeDir: () => 'C:/DuckHive',
      existsSync: () => true,
      readFileSync: () => JSON.stringify({}),
    })

    expect(status).toEqual({ configured: false })
  })
})
