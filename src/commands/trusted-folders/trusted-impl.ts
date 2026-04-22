import type { LocalCommandCall } from '../../types/command.js'
import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'

const TRUSTED_FILE = join(homedir(), '.claude', 'trusted-folders.json')

interface TrustedConfig { folders: string[]; enabled: boolean }

function load(): TrustedConfig {
  try {
    if (existsSync(TRUSTED_FILE)) return JSON.parse(readFileSync(TRUSTED_FILE, 'utf-8'))
  } catch {}
  return { folders: [], enabled: true }
}

function save(config: TrustedConfig) {
  mkdirSync(join(homedir(), '.claude'), { recursive: true })
  writeFileSync(TRUSTED_FILE, JSON.stringify(config, null, 2))
}

export const call: LocalCommandCall = async (args: string) => {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? ''
  const path = parts.slice(1).join(' ').trim()
  const config = load()

  if (!subcommand || subcommand === 'list') {
    if (config.folders.length === 0) return { type: 'text', value: '🔐 No trusted folders.\nAdd: /trusted add ~/projects/myapp' }
    const lines = [`🔐 Trusted Folders (${config.folders.length})\n${'─'.repeat(50)}`]
    for (const f of config.folders) lines.push(`  ✅ ${f}`)
    return { type: 'text', value: lines.join('\n') }
  }

  if (subcommand === 'add') {
    if (!path) return { type: 'text', value: '🔐 Add: /trusted add <path>' }
    const resolved = path.replace(/^~\//, homedir() + '/')
    if (config.folders.includes(resolved)) return { type: 'text', value: `✅ Already trusted: ${resolved}` }
    config.folders.push(resolved)
    save(config)
    return { type: 'text', value: `✅ Added: ${resolved}` }
  }

  if (subcommand === 'remove') {
    if (!path) return { type: 'text', value: '🔐 Remove: /trusted remove <path>' }
    const resolved = path.replace(/^~\//, homedir() + '/')
    const idx = config.folders.indexOf(resolved)
    if (idx === -1) return { type: 'text', value: `Not found: ${resolved}` }
    config.folders.splice(idx, 1)
    save(config)
    return { type: 'text', value: `✅ Removed: ${resolved}` }
  }

  return { type: 'text', value: `🔐 Trusted Folders\n${'─'.repeat(50)}\n/trusted list            — List folders\n/trusted add <path>      — Add trusted folder\n/trusted remove <path>   — Remove folder` }
}
