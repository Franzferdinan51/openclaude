/**
 * /loop Command — Scheduled Prompt Loops
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

import { bold, italic } from '../../components/styles.js'
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
  const statusIcon: Record<LoopStatus, string> = {
    scheduled: '⏳',
    running: '🔄',
    paused: '⏸️',
    completed: '✅',
    failed: '❌',
  }

  let output = `${statusIcon[loop.status]} **${loop.prompt.substring(0, 60)}${loop.prompt.length > 60 ? '...' : ''}**\n`
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

function parseLoopArgs(args: string[]): {
  prompt?: string
  everyMinutes?: number
  times?: number
  remaining?: number
  outputMode?: 'silent' | 'notify' | 'full'
} {
  const result: ReturnType<typeof parseLoopArgs> = {}

  for (const arg of args) {
    if (arg.startsWith('--every=')) {
      result.everyMinutes = parseInt(arg.split('=')[1])
    } else if (arg.startsWith('--times=')) {
      result.times = parseInt(arg.split('=')[1])
      result.remaining = result.times
    } else if (arg.startsWith('--output=')) {
      result.outputMode = arg.split('=')[1] as 'silent' | 'notify' | 'full'
    } else if (!arg.startsWith('--')) {
      result.prompt = arg.replace(/^["']|["']$/g, '')
    }
  }

  return result
}

async function createLoop(args: string[]): Promise<string> {
  const parsed = parseLoopArgs(args)

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

async function pauseLoop(args: string[]): Promise<string> {
  if (args.length === 0) return 'Usage: /loop pause <loop-id>'

  const loopId = args[0]
  const loops = getLoops()
  const loop = loops.find((l) => l.id === loopId || l.id.includes(loopId))

  if (!loop) return `Loop not found: ${loopId}`
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
  const loop = loops.find((l) => l.id === loopId || l.id.includes(loopId))

  if (!loop) return `Loop not found: ${loopId}`
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
  const index = loops.findIndex((l) => l.id === loopId || l.id.includes(loopId))

  if (index === -1) return `Loop not found: ${loopId}`

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
  /loop pause loop_abc123
`.trim()
}

export async function call(args: string): Promise<{ type: 'text'; value: string }> {
  return { type: 'text', value: await loopCommand(splitCommandArgs(args)) }
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

function splitCommandArgs(args: string): string[] {
  return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg => arg.replace(/^["']|["']$/g, '')) ?? []
}
