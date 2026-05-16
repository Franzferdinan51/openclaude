import type { LocalCommandCall } from '../../types/command.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

interface TrustedConfig {
  folders: string[]
  enabled: boolean
}

type TrustedFoldersDeps = {
  existsSync: typeof existsSync
  getClaudeConfigHomeDir: () => string
  homedir: typeof homedir
  mkdirSync: typeof mkdirSync
  readFileSync: typeof readFileSync
  writeFileSync: typeof writeFileSync
}

let trustedFoldersTestDeps: Partial<TrustedFoldersDeps> | null = null

function getTrustedFoldersDeps(): TrustedFoldersDeps {
  return {
    existsSync,
    getClaudeConfigHomeDir,
    homedir,
    mkdirSync,
    readFileSync,
    writeFileSync,
    ...trustedFoldersTestDeps,
  }
}

export function setTrustedFoldersTestDeps(
  overrides: Partial<TrustedFoldersDeps> | null,
): void {
  trustedFoldersTestDeps = overrides
}

function getTrustedFilePath(): string {
  return join(
    getTrustedFoldersDeps().getClaudeConfigHomeDir(),
    'trusted-folders.json',
  )
}

function getLegacyTrustedFilePath(): string {
  return join(
    getTrustedFoldersDeps().homedir(),
    '.claude',
    'trusted-folders.json',
  )
}

export function loadTrustedFoldersConfig(): TrustedConfig {
  const { existsSync, readFileSync } = getTrustedFoldersDeps()

  try {
    for (const candidatePath of [
      getTrustedFilePath(),
      getLegacyTrustedFilePath(),
    ]) {
      if (existsSync(candidatePath)) {
        return JSON.parse(readFileSync(candidatePath, 'utf-8'))
      }
    }
  } catch {}

  return { folders: [], enabled: true }
}

function saveTrustedFoldersConfig(config: TrustedConfig): void {
  const { getClaudeConfigHomeDir, mkdirSync, writeFileSync } =
    getTrustedFoldersDeps()
  const configDir = getClaudeConfigHomeDir()
  mkdirSync(configDir, { recursive: true })
  writeFileSync(getTrustedFilePath(), JSON.stringify(config, null, 2))
}

function resolveTrustedPath(path: string): string {
  return path.replace(/^~(?=\/|\\|$)/, getTrustedFoldersDeps().homedir())
}

export const call: LocalCommandCall = async (args: string) => {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? ''
  const path = parts.slice(1).join(' ').trim()
  const config = loadTrustedFoldersConfig()

  if (!subcommand || subcommand === 'list') {
    if (config.folders.length === 0) {
      return {
        type: 'text',
        value: 'No trusted folders.\nAdd one with: /trusted add ~/projects/myapp',
      }
    }

    const lines = [`Trusted folders (${config.folders.length})`, '-'.repeat(50)]
    for (const folder of config.folders) lines.push(`  ${folder}`)
    return { type: 'text', value: lines.join('\n') }
  }

  if (subcommand === 'add') {
    if (!path) return { type: 'text', value: 'Usage: /trusted add <path>' }

    const resolved = resolveTrustedPath(path)
    if (config.folders.includes(resolved)) {
      return { type: 'text', value: `Already trusted: ${resolved}` }
    }

    config.folders.push(resolved)
    saveTrustedFoldersConfig(config)
    return { type: 'text', value: `Added trusted folder: ${resolved}` }
  }

  if (subcommand === 'remove') {
    if (!path) return { type: 'text', value: 'Usage: /trusted remove <path>' }

    const resolved = resolveTrustedPath(path)
    const idx = config.folders.indexOf(resolved)
    if (idx === -1) return { type: 'text', value: `Not found: ${resolved}` }

    config.folders.splice(idx, 1)
    saveTrustedFoldersConfig(config)
    return { type: 'text', value: `Removed trusted folder: ${resolved}` }
  }

  return {
    type: 'text',
    value: [
      'Trusted folders',
      '-'.repeat(50),
      '/trusted list          - List folders',
      '/trusted add <path>    - Add trusted folder',
      '/trusted remove <path> - Remove folder',
    ].join('\n'),
  }
}
