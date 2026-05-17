import type { LocalCommandCall } from '../../types/command.js'
import { resetSessionCacheStats } from '../../services/api/cacheStatsTracker.js'
import { cacheClear, getCacheStats } from '../../utils/providerCache.js'

type CacheDeps = {
  cacheClear: typeof cacheClear
  getCacheStats: typeof getCacheStats
  resetSessionCacheStats: typeof resetSessionCacheStats
}

let cacheTestDeps: Partial<CacheDeps> | null = null

function getCacheDeps(): CacheDeps {
  return {
    cacheClear,
    getCacheStats,
    resetSessionCacheStats,
    ...cacheTestDeps,
  }
}

export function setCacheTestDeps(overrides: Partial<CacheDeps> | null): void {
  cacheTestDeps = overrides
}

function splitCommandArgs(args: string): { args: string[]; error?: string } {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let tokenStarted = false

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!

    if (quote) {
      if (ch === quote) {
        quote = null
        continue
      }
      if (ch === '\\' && i + 1 < args.length) {
        const next = args[i + 1]!
        if (next === quote || next === '\\') {
          current += next
          i += 1
          continue
        }
      }
      current += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      tokenStarted = true
      continue
    }

    if (/\s/.test(ch)) {
      if (tokenStarted) {
        tokens.push(current)
        current = ''
        tokenStarted = false
      }
      continue
    }

    current += ch
    tokenStarted = true
  }

  if (quote) {
    return { args: tokens, error: 'Unterminated quoted string in /cache arguments.' }
  }

  if (tokenStarted) tokens.push(current)
  return { args: tokens }
}

function usage(error?: string): string {
  const lines = [
    'Cache',
    '',
    'Usage:',
    '  /cache',
    '  /cache stats',
    '  /cache clear',
    '',
    'Notes:',
    '  /cache shows the shared provider response cache.',
    '  /cache-stats shows the per-request cache history for this session.',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

function formatPercent(rate: number): string {
  if (Number.isNaN(rate)) return 'N/A'
  return `${Math.round(rate * 100)}%`
}

function renderStats(): string {
  const stats = getCacheDeps().getCacheStats()
  return [
    'Provider cache',
    '-'.repeat(40),
    `Entries: ${stats.size} / ${stats.maxSize}`,
    `Hits: ${stats.hits}`,
    `Misses: ${stats.misses}`,
    `Evictions: ${stats.evictions}`,
    `Hit rate: ${formatPercent(stats.hitRate)}`,
    `TTL: ${stats.ttlSeconds}s`,
    '',
    'For per-request cache metrics in this session, use `/cache-stats`.',
  ].join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const parsed = splitCommandArgs(args)
  if (parsed.error) {
    return { type: 'text', value: usage(parsed.error) }
  }
  const tokens = parsed.args
  const subcommand = tokens[0]?.toLowerCase() ?? 'stats'

  if (subcommand === 'stats') {
    if (tokens.length > 1) {
      return { type: 'text', value: usage('stats does not accept extra arguments.') }
    }
    return { type: 'text', value: renderStats() }
  }

  if (subcommand === 'clear') {
    if (tokens.length > 1) {
      return { type: 'text', value: usage('clear does not accept extra arguments.') }
    }
    getCacheDeps().cacheClear()
    getCacheDeps().resetSessionCacheStats()
    return {
      type: 'text',
      value: 'Provider cache cleared.\nSession cache metrics were reset too.',
    }
  }

  return { type: 'text', value: usage(`Unknown cache action: ${subcommand}`) }
}
