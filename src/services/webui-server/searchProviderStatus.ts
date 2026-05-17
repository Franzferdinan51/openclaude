import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

type SearchProviderStatusDeps = {
  existsSync: typeof existsSync
  readFileSync: typeof readFileSync
  getClaudeConfigHomeDir: typeof getClaudeConfigHomeDir
}

const defaultDeps: SearchProviderStatusDeps = {
  existsSync,
  readFileSync,
  getClaudeConfigHomeDir,
}

export function getSearchProviderStatus(
  deps: Partial<SearchProviderStatusDeps> = {},
): Record<string, unknown> {
  const {
    existsSync,
    readFileSync,
    getClaudeConfigHomeDir,
  } = { ...defaultDeps, ...deps }

  try {
    const duckhiveConfigPath = join(getClaudeConfigHomeDir(), 'config.json')
    if (!existsSync(duckhiveConfigPath)) {
      return { configured: false }
    }

    const config = JSON.parse(readFileSync(duckhiveConfigPath, 'utf8')) as Record<string, unknown>
    const search = config.search as Record<string, unknown> | undefined
    if (!search?.provider) {
      return { configured: false }
    }

    return {
      configured: true,
      provider: search.provider,
      searxngUrl: search.searxngUrl ?? null,
    }
  } catch {
    return { configured: false }
  }
}
