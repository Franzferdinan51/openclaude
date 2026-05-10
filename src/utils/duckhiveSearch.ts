import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

export type DuckHiveSearchProvider =
  | 'auto'
  | 'minimax'
  | 'native'
  | 'custom'
  | 'searxng'
  | 'firecrawl'
  | 'ddg'
  | 'tavily'
  | 'exa'
  | 'you'
  | 'jina'
  | 'bing'
  | 'mojeek'
  | 'linkup'

export type DuckHiveSearchConfig = {
  provider?: string
  searxngUrl?: string
  custom?: {
    provider?: string
    api?: string
    urlTemplate?: string
    key?: string
  }
}

export type DuckHiveSearchSettings = Record<string, unknown> & {
  search?: DuckHiveSearchConfig
}

const SEARCH_PROVIDER_ALIASES: Record<string, DuckHiveSearchProvider> = {
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

export function normalizeDuckHiveSearchProvider(
  value?: string | null,
): DuckHiveSearchProvider | undefined {
  if (!value) return undefined
  return SEARCH_PROVIDER_ALIASES[value.trim().toLowerCase()]
}

export function getDuckHiveSearchConfigPath(homeDir = homedir()): string {
  return join(homeDir, '.duckhive', 'config.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function readDuckHiveSearchSettingsSync(
  configPath = getDuckHiveSearchConfigPath(),
): DuckHiveSearchSettings {
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'))
    return isRecord(parsed) ? (parsed as DuckHiveSearchSettings) : {}
  } catch {
    return {}
  }
}

export function getConfiguredDuckHiveSearchProvider(
  config: DuckHiveSearchSettings | null | undefined,
): DuckHiveSearchProvider {
  return normalizeDuckHiveSearchProvider(config?.search?.provider) ?? 'auto'
}

function deepMerge(target: Record<string, unknown>, ...sources: Record<string, unknown>[]): Record<string, unknown> {
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && isRecord(source[key])) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          target[key] = {}
        }
        deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>)
      } else {
        target[key] = source[key]
      }
    }
  }
  return target
}

export function setDuckHiveSearchPreferenceSync(
  provider: DuckHiveSearchProvider,
  options?: { searxngUrl?: string },
  configPath = getDuckHiveSearchConfigPath(),
): DuckHiveSearchSettings {
  const current = readDuckHiveSearchSettingsSync(configPath)
  const currentSearch = isRecord(current.search) ? (current.search as Record<string, unknown>) : {}
  const nextSearch: DuckHiveSearchConfig = {
    ...currentSearch,
    provider,
  }

  if (provider === 'searxng' && options?.searxngUrl) {
    nextSearch.searxngUrl = options.searxngUrl
  }

  const nextConfig: DuckHiveSearchSettings = deepMerge({}, current as Record<string, unknown>, { search: nextSearch } as Record<string, unknown>)

  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
  return nextConfig
}

export function applyDuckHiveSearchPreferenceToEnv(
  config: DuckHiveSearchSettings,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const provider = getConfiguredDuckHiveSearchProvider(config)
  env.WEB_SEARCH_PROVIDER = provider

  if (provider === 'searxng') {
    env.WEB_PROVIDER = 'searxng'
    if (config.search?.searxngUrl) {
      env.WEB_SEARCH_API = config.search.searxngUrl
    }
    allowLocalSearxngIfNeeded(config.search?.searxngUrl, env)
  }
}

function allowLocalSearxngIfNeeded(
  rawUrl: string | undefined,
  env: NodeJS.ProcessEnv,
): void {
  if (!rawUrl) return
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    if (
      url.protocol === 'http:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1'
    ) {
      env.WEB_CUSTOM_ALLOW_HTTP ??= 'true'
      env.WEB_CUSTOM_ALLOW_PRIVATE ??= 'true'
    }
  } catch {
    // Validation happens in the search provider before a request is made.
  }
}
