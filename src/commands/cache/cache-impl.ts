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

function splitCommandArgs(args: string): string[] {
  return (
    args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg =>
      arg.replace(/^["']|["']$/g, ''),
    ) ?? []
  )
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
  const tokens = splitCommandArgs(args)
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
