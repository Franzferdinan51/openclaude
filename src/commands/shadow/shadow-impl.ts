import type { LocalCommandCall } from '../../types/command.js'
import {
  createShadowGit,
  type CheckpointRef,
  type ShadowGit,
} from '../../orchestrator/shadow-git/shadow-git.js'

type ShadowDeps = {
  createShadowGit: typeof createShadowGit
}

let shadowTestDeps: Partial<ShadowDeps> | null = null

function getShadowDeps(): ShadowDeps {
  return {
    createShadowGit,
    ...shadowTestDeps,
  }
}

export function setShadowTestDeps(overrides: Partial<ShadowDeps> | null): void {
  shadowTestDeps = overrides
}

function splitCommandArgs(args: string): { args: string[]; error?: string } {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaping = false

  for (const char of args) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === '\\') {
      escaping = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (escaping) {
    current += '\\'
  }

  if (quote) {
    return {
      args: [],
      error: `Unterminated quoted string in /shadow arguments. Close the ${quote} quote and try again.`,
    }
  }

  if (current) {
    tokens.push(current)
  }

  return { args: tokens }
}

function usage(error?: string): string {
  const lines = [
    'Shadow Git',
    '',
    'Usage:',
    '  /shadow checkpoint <message>',
    '  /shadow list',
    '  /shadow restore <checkpoint-id> [--file <path>]',
    '',
    'Examples:',
    '  /shadow checkpoint "before provider refactor"',
    '  /shadow list',
    '  /shadow restore ckpt_1712345678901',
    '  /shadow restore ckpt_1712345678901 --file src/app.ts',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

function renderList(checkpoints: CheckpointRef[]): string {
  if (checkpoints.length === 0) {
    return 'Shadow Git\n\nNo checkpoints yet. Create one with `/shadow checkpoint "message"`.'
  }

  const lines = ['Shadow Git checkpoints', '-'.repeat(40)]
  for (const checkpoint of checkpoints) {
    lines.push(
      `- ${checkpoint.id} · ${new Date(checkpoint.timestamp).toLocaleString()} · ${checkpoint.message}`,
    )
  }
  return lines.join('\n')
}

function parseRestoreArgs(tokens: string[]): { file?: string; error?: string } {
  let file: string | undefined

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '--file') {
      const next = tokens[++i]
      if (!next?.trim()) {
        return { error: '--file requires a path.' }
      }
      file = next.trim()
      continue
    }

    const [flag, inlineValue] = token.split(/=(.*)/s, 2)
    if (flag === '--file') {
      if (!inlineValue?.trim()) {
        return { error: '--file requires a path.' }
      }
      file = inlineValue.trim()
      continue
    }

    return { error: `Unknown shadow restore option: ${token}` }
  }

  return { file }
}

function shadowInstance(): ShadowGit {
  return getShadowDeps().createShadowGit()
}

export const call: LocalCommandCall = async (args: string) => {
  const parsed = splitCommandArgs(args)
  if (parsed.error) {
    return { type: 'text', value: usage(parsed.error) }
  }
  const tokens = parsed.args
  const subcommand = tokens[0]?.toLowerCase() ?? 'list'
  const shadow = shadowInstance()

  if (subcommand === 'list') {
    if (tokens.length > 1) return { type: 'text', value: usage('list does not accept extra arguments.') }
    return { type: 'text', value: renderList(shadow.list()) }
  }

  if (subcommand === 'checkpoint') {
    const message = tokens.slice(1).join(' ').trim()
    if (!message) {
      return { type: 'text', value: usage('checkpoint requires a message.') }
    }
    const checkpoint = shadow.checkpoint(message)
    if (!checkpoint) {
      return { type: 'text', value: 'Failed to create shadow checkpoint.' }
    }
    return {
      type: 'text',
      value: `Shadow checkpoint created\n${'-'.repeat(40)}\nID: ${checkpoint.id}\nMessage: ${checkpoint.message}`,
    }
  }

  if (subcommand === 'restore') {
    const checkpointId = tokens[1]?.trim()
    if (!checkpointId) {
      return { type: 'text', value: usage('restore requires a checkpoint id.') }
    }
    const restoreArgs = parseRestoreArgs(tokens.slice(2))
    if (restoreArgs.error) {
      return { type: 'text', value: usage(restoreArgs.error) }
    }
    const restored = shadow.restore(checkpointId, restoreArgs.file)
    if (!restored) {
      return {
        type: 'text',
        value: `Failed to restore shadow checkpoint: ${checkpointId}`,
      }
    }
    return {
      type: 'text',
      value: `Shadow checkpoint restored\n${'-'.repeat(40)}\nID: ${checkpointId}${restoreArgs.file ? `\nFile: ${restoreArgs.file}` : ''}`,
    }
  }

  return { type: 'text', value: usage(`Unknown shadow action: ${subcommand}`) }
}
