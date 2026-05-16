import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { setClaudeConfigHomeDirForTesting } from '../utils/envUtils.js'

let configHomeDir: string
let originalFetch: typeof fetch

async function importFreshCustomProvidersModule() {
  return await import(
    `./customProviders.ts?custom-providers-test=${Date.now()}-${Math.random()}`
  )
}

describe('customProviders', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-custom-providers-'))
    setClaudeConfigHomeDirForTesting(configHomeDir)
    originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => ({ status: 200 })) as unknown as typeof fetch
  })

  afterEach(() => {
    mock.restore()
    setClaudeConfigHomeDirForTesting(undefined)
    globalThis.fetch = originalFetch
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('stores providers inside DuckHive config home and exposes them through the public API', async () => {
    const {
      addCustomProvider,
      getCustomProvidersFilePath,
      getCustomProvider,
      listCustomProviders,
      removeCustomProvider,
      resetCustomProvidersForTesting,
    } = await importFreshCustomProvidersModule()

    resetCustomProvidersForTesting()
    expect(getCustomProvidersFilePath()).toBe(
      join(configHomeDir, 'custom-providers.json'),
    )

    const added = await addCustomProvider({
      name: 'Local OpenAI',
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      model: 'gpt-test',
    })

    expect(added.healthy).toBe(true)
    expect(listCustomProviders()).toHaveLength(1)
    expect(getCustomProvider('Local OpenAI')?.model).toBe('gpt-test')

    const stored = JSON.parse(
      readFileSync(join(configHomeDir, 'custom-providers.json'), 'utf8'),
    ) as { providers: Array<{ name: string }> }
    expect(stored.providers.map(provider => provider.name)).toEqual([
      'Local OpenAI',
    ])

    expect(removeCustomProvider('Local OpenAI')).toBe(true)
    expect(listCustomProviders()).toHaveLength(0)
  })
})
