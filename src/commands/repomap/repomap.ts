import type { LocalCommandCall } from '../../types/command.js'
import { getCwd } from '../../utils/cwd.js'

type RepoMapResult = Awaited<ReturnType<typeof import('../../context/repoMap/index.js').buildRepoMap>>
type RepoMapDeps = {
  buildRepoMap: typeof import('../../context/repoMap/index.js').buildRepoMap
  getCacheStats: typeof import('../../context/repoMap/index.js').getCacheStats
  getCwd: typeof getCwd
  invalidateCache: typeof import('../../context/repoMap/index.js').invalidateCache
}

let repomapTestDeps: Partial<RepoMapDeps> | null = null

function getRepomapDeps(): RepoMapDeps {
  return {
    buildRepoMap: async options => {
      const { buildRepoMap } = await import('../../context/repoMap/index.js')
      return buildRepoMap(options)
    },
    getCacheStats: root => {
      const mod = require('../../context/repoMap/index.js') as typeof import('../../context/repoMap/index.js')
      return mod.getCacheStats(root)
    },
    getCwd,
    invalidateCache: root => {
      const mod = require('../../context/repoMap/index.js') as typeof import('../../context/repoMap/index.js')
      return mod.invalidateCache(root)
    },
    ...repomapTestDeps,
  }
}

export function setRepomapTestDeps(overrides: Partial<RepoMapDeps> | null): void {
  repomapTestDeps = overrides
}

/** Parse CLI-style arguments from the command string. */
export function parseArgs(args: string): {
  tokens: number
  focus: string[]
  invalidate: boolean
  stats: boolean
} {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  let tokens = 2048
  const focus: string[] = []
  let invalidate = false
  let stats = false

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    if (part === '--tokens' && i + 1 < parts.length) {
      const n = parseInt(parts[i + 1]!, 10)
      if (!isNaN(n) && n >= 256 && n <= 16384) {
        tokens = n
      }
      i++
    } else if (part === '--focus' && i + 1 < parts.length) {
      focus.push(parts[i + 1]!)
      i++
    } else if (part === '--invalidate') {
      invalidate = true
    } else if (part === '--stats') {
      stats = true
    }
  }

  return { tokens, focus, invalidate, stats }
}

export const call: LocalCommandCall = async (args) => {
  const { buildRepoMap, getCacheStats, getCwd, invalidateCache } = getRepomapDeps()
  const root = getCwd()
  const { tokens, focus, invalidate, stats } = parseArgs(args ?? '')

  if (stats) {
    const cacheStats = getCacheStats(root)
    const lines = [
      `Repository map cache stats:`,
      `  Cache directory: ${cacheStats.cacheDir}`,
      `  Cache file: ${cacheStats.cacheFile ?? '(none)'}`,
      `  Cached entries: ${cacheStats.entryCount}`,
      `  Cache exists: ${cacheStats.exists}`,
    ]
    return { type: 'text', value: lines.join('\n') }
  }

  if (invalidate) {
    invalidateCache(root)
    const result = await buildRepoMap({
      root,
      maxTokens: tokens,
      focusFiles: focus.length > 0 ? focus : undefined,
    })
    return {
      type: 'text',
      value: [
        `Cache invalidated and rebuilt.`,
        `Files: ${result.fileCount} ranked (${result.totalFileCount} total) | Tokens: ${result.tokenCount} | Time: ${result.buildTimeMs}ms | Cache hit: ${result.cacheHit}`,
        '',
        result.map,
      ].join('\n'),
    }
  }

  const result = await buildRepoMap({
    root,
    maxTokens: tokens,
    focusFiles: focus.length > 0 ? focus : undefined,
  })

  return {
    type: 'text',
    value: [
      `Repository map: ${result.fileCount} files ranked (${result.totalFileCount} total) | Tokens: ${result.tokenCount} | Time: ${result.buildTimeMs}ms | Cache hit: ${result.cacheHit}`,
      '',
      result.map,
    ].join('\n'),
  }
}
