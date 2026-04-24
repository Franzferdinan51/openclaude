import type { LocalCommandCall } from '../../types/command.js'
import {
  getConfiguredDuckHiveSearchProvider,
  normalizeDuckHiveSearchProvider,
  readDuckHiveSearchSettingsSync,
  setDuckHiveSearchPreferenceSync,
  type DuckHiveSearchProvider,
} from '../../utils/duckhiveSearch.js'

type ParsedArgs =
  | {
      ok: true
      help: boolean
      provider?: DuckHiveSearchProvider
      searxngUrl?: string
    }
  | { ok: false; error: string }

function parseArgs(args: string): ParsedArgs {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  const parsed: Extract<ParsedArgs, { ok: true }> = { ok: true, help: false }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const [flag, inlineValue] = token.split(/=(.*)/s, 2)

    if (flag === '--help' || flag === '-h') {
      parsed.help = true
      continue
    }

    if (flag === '--url' || flag === '--searxng-url') {
      const value = inlineValue ?? tokens[++i]
      if (!value?.trim()) {
        return { ok: false, error: `${flag} requires a value.` }
      }
      parsed.searxngUrl = value.trim()
      continue
    }

    const provider = normalizeDuckHiveSearchProvider(token)
    if (!provider) {
      return { ok: false, error: `Unknown search provider: ${token}` }
    }
    parsed.provider = provider
  }

  return parsed
}

function usage(error?: string): string {
  const lines = [
    'Search provider setup',
    '',
    'Usage:',
    '  /search-provider [auto|minimax|native|ddg|searxng|tavily|exa|you|jina|bing|mojeek|linkup|custom] [--url <searxng-url>]',
    '',
    'First-class local/private search:',
    '  /search-provider minimax',
    '  /search-provider searxng --url http://localhost:8080/search',
    '',
    'Useful env keys:',
    '  MINIMAX_API_KEY or mmx auth login --api-key <key>',
    '  TAVILY_API_KEY, EXA_API_KEY, YOU_API_KEY, JINA_API_KEY, BING_API_KEY, MOJEEK_API_KEY, LINKUP_API_KEY',
    '  WEB_PROVIDER, WEB_SEARCH_API, WEB_URL_TEMPLATE, WEB_KEY',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const parsed = parseArgs(args)
  if (!parsed.ok) {
    return { type: 'text', value: usage(parsed.error) }
  }
  if (parsed.help) {
    return { type: 'text', value: usage() }
  }

  const current = readDuckHiveSearchSettingsSync()
  if (!parsed.provider) {
    const provider = getConfiguredDuckHiveSearchProvider(current)
    const searxngUrl = current.search?.searxngUrl
    return {
      type: 'text',
      value: [
        'Search provider defaults',
        `Provider: ${provider}`,
        searxngUrl ? `SearXNG: ${searxngUrl}` : undefined,
        '',
        'Use /search-provider --help for setup examples.',
      ].filter(Boolean).join('\n'),
    }
  }

  if (parsed.provider === 'searxng' && !parsed.searxngUrl && !current.search?.searxngUrl) {
    return {
      type: 'text',
      value: usage('SearXNG requires --url unless a SearXNG URL is already saved.'),
    }
  }

  const saved = setDuckHiveSearchPreferenceSync(parsed.provider, {
    searxngUrl: parsed.searxngUrl,
  })
  const lines = [`Search provider set to ${parsed.provider}.`]
  if (parsed.provider === 'searxng') {
    lines.push(`SearXNG URL: ${saved.search?.searxngUrl}`)
  }
  lines.push('Restart DuckHive or launch a new session for env-backed tools to pick it up.')
  return { type: 'text', value: lines.join('\n') }
}
