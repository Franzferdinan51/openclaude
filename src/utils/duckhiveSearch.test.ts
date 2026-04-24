import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  applyDuckHiveSearchPreferenceToEnv,
  getConfiguredDuckHiveSearchProvider,
  normalizeDuckHiveSearchProvider,
  readDuckHiveSearchSettingsSync,
  setDuckHiveSearchPreferenceSync,
} from './duckhiveSearch.js'

let tempDir: string | undefined

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

test('normalizes supported search provider aliases', () => {
  expect(normalizeDuckHiveSearchProvider('mmx')).toBe('minimax')
  expect(normalizeDuckHiveSearchProvider('minimax-cli')).toBe('minimax')
  expect(normalizeDuckHiveSearchProvider('searx')).toBe('searxng')
  expect(normalizeDuckHiveSearchProvider('duckduckgo')).toBe('ddg')
  expect(normalizeDuckHiveSearchProvider('tavily')).toBe('tavily')
})

test('defaults search provider to auto', () => {
  expect(getConfiguredDuckHiveSearchProvider({})).toBe('auto')
})

test('persists search preference without discarding other config', () => {
  tempDir = mkdtempSync(join(tmpdir(), 'duckhive-search-'))
  const configPath = join(tempDir, 'config.json')

  writeFileSync(
    configPath,
    JSON.stringify({ providers: { default: 'minimax' } }, null, 2),
  )

  setDuckHiveSearchPreferenceSync(
    'searxng',
    { searxngUrl: 'http://localhost:8080/search' },
    configPath,
  )

  const saved = readDuckHiveSearchSettingsSync(configPath)
  expect(saved.providers).toEqual({ default: 'minimax' })
  expect(saved.search).toEqual({
    provider: 'searxng',
    searxngUrl: 'http://localhost:8080/search',
  })
})

test('applies searxng env including local endpoint guard overrides', () => {
  const env: NodeJS.ProcessEnv = {}

  applyDuckHiveSearchPreferenceToEnv(
    {
      search: {
        provider: 'searxng',
        searxngUrl: 'http://localhost:8080/search',
      },
    },
    env,
  )

  expect(env.WEB_SEARCH_PROVIDER).toBe('searxng')
  expect(env.WEB_PROVIDER).toBe('searxng')
  expect(env.WEB_SEARCH_API).toBe('http://localhost:8080/search')
  expect(env.WEB_CUSTOM_ALLOW_HTTP).toBe('true')
  expect(env.WEB_CUSTOM_ALLOW_PRIVATE).toBe('true')
})
