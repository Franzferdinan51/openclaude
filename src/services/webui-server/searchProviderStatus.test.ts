import { describe, expect, test } from 'bun:test'
import { getSearchProviderStatus } from './searchProviderStatus.js'

describe('getSearchProviderStatus', () => {
  test('reads search provider config from DuckHive config home', () => {
    const status = getSearchProviderStatus({
      getClaudeConfigHomeDir: (() => 'C:/DuckHive') as typeof import('../../utils/envUtils.js').getClaudeConfigHomeDir,
      existsSync: (path => path === 'C:\\DuckHive\\config.json' || path === 'C:/DuckHive/config.json') as typeof import('node:fs').existsSync,
      readFileSync: ((() =>
        JSON.stringify({
          search: {
            provider: 'searxng',
            searxngUrl: 'http://localhost:8080/search',
          },
        })) as unknown) as typeof import('node:fs').readFileSync,
    })

    expect(status).toEqual({
      configured: true,
      provider: 'searxng',
      searxngUrl: 'http://localhost:8080/search',
    })
  })

  test('returns unconfigured when the DuckHive config has no search provider', () => {
    const status = getSearchProviderStatus({
      getClaudeConfigHomeDir: (() => 'C:/DuckHive') as typeof import('../../utils/envUtils.js').getClaudeConfigHomeDir,
      existsSync: (() => true) as typeof import('node:fs').existsSync,
      readFileSync: ((() => JSON.stringify({})) as unknown) as typeof import('node:fs').readFileSync,
    })

    expect(status).toEqual({ configured: false })
  })
})
