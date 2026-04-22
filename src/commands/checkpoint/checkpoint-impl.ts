/**
 * /checkpoint command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { join } from 'path'
import { mkdirSync, readdirSync, writeFileSync, existsSync, rmSync } from 'fs'

const CHECKPOINT_DIR = join(process.env.HOME ?? '/tmp', '.claude', 'checkpoints')

function ensureDir() {
  try { mkdirSync(CHECKPOINT_DIR, { recursive: true }) } catch {}
}

interface Checkpoint {
  name: string
  created: number
  size: number
}

function listCheckpoints(): Checkpoint[] {
  ensureDir()
  try {
    return readdirSync(CHECKPOINT_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const p = join(CHECKPOINT_DIR, f)
        try {
          const s = require('fs').statSync(p)
          return { name: f.replace('.json', ''), created: s.mtimeMs, size: s.size }
        } catch {
          return null
        }
      })
      .filter((c): c is Checkpoint => c !== null)
      .sort((a, b) => b.created - a.created)
  } catch {
    return []
  }
}

export const call: LocalCommandCall = async (args: string) => {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? ''
  const name = parts.slice(1).join('-') || `snap-${Date.now()}`

  if (!subcommand || subcommand === 'list' || subcommand === 'ls') {
    const checkpoints = listCheckpoints()
    if (checkpoints.length === 0) {
      return { type: 'text', value: '💾 No saved checkpoints.\nSave one: /checkpoint save [name]' }
    }
    const lines: string[] = [`💾 Saved Checkpoints (${checkpoints.length})\n${'─'.repeat(50)}`]
    for (const cp of checkpoints) {
      const date = new Date(cp.created).toLocaleString()
      const size = (cp.size / 1024).toFixed(1)
      lines.push(`  ${cp.name} — ${date} (${size}KB)`)
    }
    return { type: 'text', value: lines.join('\n') }
  }

  if (subcommand === 'save' || subcommand === 'create') {
    ensureDir()
    const checkpoint = { name, created: Date.now(), description: `Checkpoint: ${name}` }
    const path = join(CHECKPOINT_DIR, `${name}.json`)
    try {
      writeFileSync(path, JSON.stringify(checkpoint, null, 2))
      return { type: 'text', value: `✅ Checkpoint saved: "${name}"\n📁 ${path}` }
    } catch (e) {
      return { type: 'text', value: `❌ Failed: ${e}` }
    }
  }

  if (subcommand === 'load' || subcommand === 'restore') {
    const path = join(CHECKPOINT_DIR, `${name}.json`)
    if (!existsSync(path)) return { type: 'text', value: `❌ Checkpoint not found: "${name}"` }
    try {
      const data = JSON.parse(require('fs').readFileSync(path, 'utf-8'))
      return { type: 'text', value: `✅ Loaded: "${data.name}"\nCreated: ${new Date(data.created).toLocaleString()}` }
    } catch (e) {
      return { type: 'text', value: `❌ Failed: ${e}` }
    }
  }

  if (subcommand === 'delete' || subcommand === 'remove') {
    const path = join(CHECKPOINT_DIR, `${name}.json`)
    if (!existsSync(path)) return { type: 'text', value: `❌ Not found: "${name}"` }
    try { rmSync(path) } catch {}
    return { type: 'text', value: `✅ Deleted: "${name}"` }
  }

  return { type: 'text', value: `💾 Checkpoint Command\n${'─'.repeat(50)}\n/checkpoint save [name]    — Save session\n/checkpoint list            — List checkpoints\n/checkpoint load <name>    — Load checkpoint\n/checkpoint delete <name>   — Delete checkpoint` }
}
