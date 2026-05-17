/**
 * /loop Command - Scheduled Prompt Loops
 * Inspired by OpenClaude /loop feature
 *
 * Usage:
 *   /loop create "<prompt>" --every=<minutes> --times=<n>
 *   /loop list
 *   /loop status <id>
 *   /loop pause <id>
 *   /loop resume <id>
 *   /loop clear <id>
 */

import { bold } from '../../components/styles.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'

export type LoopStatus = 'scheduled' | 'running' | 'paused' | 'completed' | 'failed'

export interface Loop {
  id: string
  prompt: string
  status: LoopStatus
  everyMinutes?: number
  times?: number
  remaining?: number
  createdAt: string
  lastRunAt?: string
  nextRunAt?: string
  error?: string
  outputMode?: 'silent' | 'notify' | 'full'
}

const LOOPS_STORAGE_KEY = 'duckhive.loops'

function generateId(): string {
  return `loop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function getLoops(): Loop[] {
  try {
    const config = getGlobalConfig()
    return (config as Record<string, unknown>)[LOOPS_STORAGE_KEY] as Loop[] || []
  } catch {
    return []
  }
}

async function saveLoops(loops: Loop[]): Promise<void> {
  saveGlobalConfig(config => ({
    ...config,
    [LOOPS_STORAGE_KEY]: loops,
  }))
}

function formatLoop(loop: Loop): string {
  const statusLabel: Record<LoopStatus, string> = {
    scheduled: '[scheduled]',
    running: '[running]',
    paused: '[paused]',
    completed: '[done]',
    failed: '[failed]',
  }

  let output = `${statusLabel[loop.status]} **${loop.prompt.substring(0, 60)}${loop.prompt.length > 60 ? '...' : ''}**\n`
  output += `   ID: \`${loop.id}\`\n`
  output += `   Status: ${loop.status.toUpperCase()}\n`

  if (loop.everyMinutes) {
    const times = loop.times ? ` (${loop.remaining ?? loop.times}/${loop.times})` : ' (infinite)'
    output += `   Every: ${loop.everyMinutes} minutes${times}\n`
  }

  if (loop.lastRunAt) {
    output += `   Last Run: ${new Date(loop.lastRunAt).toLocaleString()}\n`
  }

  if (loop.nextRunAt && (loop.status === 'scheduled' || loop.status === 'paused')) {
    output += `   Next Run: ${new Date(loop.nextRunAt).toLocaleString()}\n`
  }

  if (loop.error) {
    output += `   Error: ${loop.error.substring(0, 100)}\n`
  }

  return output
}

function findLoopByReference(
  loops: Loop[],
  loopRef: string,
): { loop?: Loop; error?: string } {
  const exactMatch = loops.find((loop) => loop.id === loopRef)
  if (exactMatch) {
    return { loop: exactMatch }
  }

  const partialMatches = loops.filter((loop) => loop.id.includes(loopRef))
  if (partialMatches.length === 0) {
    return { error: `Loop not found: ${loopRef}` }
  }

  if (partialMatches.length > 1) {
    return {
      error:
        `Loop reference is ambiguous: ${loopRef}\n` +
        `Matches: ${partialMatches.map((loop) => loop.id).join(', ')}`,
    }
  }

  return { loop: partialMatches[0] }
}

function parseLoopArgs(args: string[]): {
  prompt?: string
  everyMinutes?: number
  times?: number
  remaining?: number
  outputMode?: 'silent' | 'notify' | 'full'
  error?: string
} {
  const result: ReturnType<typeof parseLoopArgs> = {}
  const promptParts: string[] = []

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg.startsWith('--every=')) {
      result.everyMinutes = parsePositiveIntOption('--every', arg.split('=')[1])
    } else if (arg === '--every') {
      result.everyMinutes = parsePositiveIntOption('--every', args[++index])
    } else if (arg.startsWith('--times=')) {
      result.times = parsePositiveIntOption('--times', arg.split('=')[1])
      result.remaining = result.times
    } else if (arg === '--times') {
      result.times = parsePositiveIntOption('--times', args[++index])
      result.remaining = result.times
    } else if (arg.startsWith('--output=')) {
      result.outputMode = parseOutputMode(arg.split('=')[1])
    } else if (arg === '--output') {
      result.outputMode = parseOutputMode(args[++index])
    } else if (arg.startsWith('--')) {
      result.error = `Unknown loop option: ${arg}`
      return result
    } else if (!arg.startsWith('--')) {
      promptParts.push(arg)
    }

    if (Number.isNaN(result.everyMinutes) || Number.isNaN(result.times)) {
      result.error = `${arg.split('=')[0]} requires a positive integer.`
      return result
    }
    if (result.outputMode === undefined && (arg.startsWith('--output') || arg === '--output')) {
      result.error = '--output must be one of: silent, notify, full.'
      return result
    }
  }

  if (promptParts.length > 0) {
    result.prompt = stripMatchingQuotes(promptParts.join(' '))
  }

  return result
}

function stripMatchingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function parsePositiveIntOption(_name: string, value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN
}

function parseOutputMode(value: string | undefined): 'silent' | 'notify' | 'full' | undefined {
  if (value === 'silent' || value === 'notify' || value === 'full') {
    return value
  }
  return undefined
}

async function createLoop(args: string[]): Promise<string> {
  const parsed = parseLoopArgs(args)

  if (parsed.error) {
    return parsed.error
  }

  if (!parsed.prompt) {
    return `Usage: /loop create "<prompt>" [--every=<minutes>] [--times=<n>]

Examples:
  /loop create "Check system health" --every=60
  /loop create "Monitor crypto prices" --every=5 --times=100
  /loop create "Git status check" --every=30
`
  }

  const id = generateId()
  const now = new Date()
  const nextRun = new Date(now.getTime() + (parsed.everyMinutes ?? 60) * 60 * 1000)

  const loop: Loop = {
    id,
    prompt: parsed.prompt,
    status: 'scheduled',
    everyMinutes: parsed.everyMinutes ?? 60,
    times: parsed.times,
    remaining: parsed.times,
    createdAt: now.toISOString(),
    nextRunAt: nextRun.toISOString(),
    outputMode: parsed.outputMode ?? 'notify',
  }

  const loops = getLoops()
  loops.unshift(loop)
  await saveLoops(loops)

  return `Loop created!

${formatLoop(loop)}

Note: Loops execute when DuckHive is running. For background execution, use cron.`
}

async function listLoops(args: string[]): Promise<string> {
  const loops = getLoops()
  const filter = args[0]?.toLowerCase()
  const validFilters = new Set(['active', 'scheduled', 'paused', 'completed', 'all'])

  if (filter && !validFilters.has(filter)) {
    return 'Unknown loop filter. Use one of: all, active, scheduled, paused, completed.'
  }

  let filtered = loops
  if (filter === 'active' || filter === 'scheduled') {
    filtered = loops.filter((l) => l.status === 'scheduled' || l.status === 'running')
  } else if (filter === 'paused') {
    filtered = loops.filter((l) => l.status === 'paused')
  } else if (filter === 'completed') {
    filtered = loops.filter((l) => l.status === 'completed')
  }

  if (filtered.length === 0) {
    return 'No loops found.'
  }

  let output = `${bold('Scheduled Loops')}\n`
  output += `Showing ${filtered.length} of ${loops.length} total\n\n`

  for (const loop of filtered.slice(0, 20)) {
    output += formatLoop(loop) + '\n'
  }

  return output
}

async function loopStatus(args: string[]): Promise<string> {
  const loops = getLoops()
  if (args.length === 0) {
    const active = loops.filter((loop) => loop.status === 'scheduled' || loop.status === 'running')
    const paused = loops.filter((loop) => loop.status === 'paused')
    let output = `${bold('Loop Status Summary')}\n\n`
    output += `Active: ${active.length} | Paused: ${paused.length} | Total: ${loops.length}\n\n`
    for (const loop of active.slice(0, 5)) {
      output += formatLoop(loop) + '\n'
    }
    return output.trim()
  }

  const loopId = args[0]
  const { loop, error } = findLoopByReference(loops, loopId)
  if (!loop) {
    return error ?? `Loop not found: ${loopId}`
  }

  return formatLoop(loop)
}

async function pauseLoop(args: string[]): Promise<string> {
  if (args.length === 0) return 'Usage: /loop pause <loop-id>'

  const loopId = args[0]
  const loops = getLoops()
  const { loop, error } = findLoopByReference(loops, loopId)

  if (!loop) return error ?? `Loop not found: ${loopId}`
  if (loop.status !== 'scheduled' && loop.status !== 'running') {
    return `Loop is not running (status: ${loop.status})`
  }

  loop.status = 'paused'
  await saveLoops(loops)

  return `Loop paused.\n\n${formatLoop(loop)}`
}

async function resumeLoop(args: string[]): Promise<string> {
  if (args.length === 0) return 'Usage: /loop resume <loop-id>'

  const loopId = args[0]
  const loops = getLoops()
  const { loop, error } = findLoopByReference(loops, loopId)

  if (!loop) return error ?? `Loop not found: ${loopId}`
  if (loop.status !== 'paused') return `Loop is not paused (status: ${loop.status})`

  loop.status = 'scheduled'
  const nextRun = new Date(Date.now() + (loop.everyMinutes ?? 60) * 60 * 1000)
  loop.nextRunAt = nextRun.toISOString()
  await saveLoops(loops)

  return `Loop resumed!\n\n${formatLoop(loop)}`
}

async function clearLoop(args: string[]): Promise<string> {
  if (args.length === 0) return 'Usage: /loop clear <loop-id>'

  const loopId = args[0]
  const loops = getLoops()
  const { loop, error } = findLoopByReference(loops, loopId)

  if (!loop) return error ?? `Loop not found: ${loopId}`

  const index = loops.indexOf(loop)
  const removed = loops.splice(index, 1)[0]
  await saveLoops(loops)

  return `Loop "${removed.prompt.substring(0, 40)}..." has been removed.`
}

function showHelp(): string {
  return `
${bold('DuckHive /loop - Scheduled Prompt Loops')}

${bold('Commands:')}
  /loop create "<prompt>" [--every=<min>] [--times=<n>]  Create a new loop
  /loop list [filter]           List loops (filter: active|paused|completed)
  /loop status [id]             Show loop details or summary
  /loop pause <id>              Pause a loop
  /loop resume <id>             Resume a paused loop
  /loop clear <id>              Delete a loop

${bold('Options:')}
  --every=<minutes>   Run interval (default: 60)
  --times=<n>         Run n times then stop (default: infinite)

${bold('Examples:')}
  /loop create "Check git status" --every=30
  /loop create "Monitor prices" --every=5 --times=100
  /loop list active
  /loop status loop_abc123
  /loop pause loop_abc123
`.trim()
}

export async function call(args: string): Promise<{ type: 'text'; value: string }> {
  const parsed = splitCommandArgs(args)
  if (parsed.error) {
    return { type: 'text', value: parsed.error }
  }
  return { type: 'text', value: await loopCommand(parsed.args) }
}

export default async function loopCommand(args: string[]): Promise<string> {
  const subcommand = args[0]?.toLowerCase()

  switch (subcommand) {
    case 'create':
    case 'new':
    case 'add':
      return createLoop(args.slice(1))

    case 'list':
    case 'ls':
      return listLoops(args.slice(1))

    case 'status':
    case 'stat':
      return loopStatus(args.slice(1))

    case 'pause':
    case 'stop':
      return pauseLoop(args.slice(1))

    case 'resume':
    case 'continue':
      return resumeLoop(args.slice(1))

    case 'clear':
    case 'delete':
    case 'remove':
      return clearLoop(args.slice(1))

    case 'help':
    case undefined:
      return showHelp()

    default:
      return showHelp()
  }
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
      error: `Unterminated quoted string in /loop arguments. Close the ${quote} quote and try again.`,
    }
  }

  if (current) {
    tokens.push(current)
  }

  return { args: tokens }
}
