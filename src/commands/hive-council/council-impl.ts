/**
 * /council command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/index.js'
import type {
  Councilor,
  DeliberationMode,
  DeliberationSession,
} from '../../services/hive-bridge/hive-types.js'

type CouncilDeps = {
  getHiveBridge: typeof getHiveBridge
}

let councilTestDeps: Partial<CouncilDeps> | null = null

function getCouncilDeps(): CouncilDeps {
  return {
    getHiveBridge,
    ...councilTestDeps,
  }
}

export function setCouncilTestDeps(
  overrides: Partial<CouncilDeps> | null,
): void {
  councilTestDeps = overrides
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
    return { args: tokens, error: 'Unterminated quoted string in /council arguments.' }
  }

  if (tokenStarted) tokens.push(current)
  return { args: tokens }
}

function renderModes(modes: DeliberationMode[]): string {
  return `Council modes
${'-'.repeat(40)}
${modes.map(mode => `- ${mode}`).join('\n')}`
}

function renderCouncilors(councilors: Councilor[]): string {
  if (councilors.length === 0) {
    return 'No councilors were returned by Hive Nation.'
  }

  return `Council deck
${'-'.repeat(40)}
${councilors
  .map(councilor => {
    const specialty = councilor.specialty?.trim()
    const role = councilor.role?.trim()
    const meta = [role, specialty].filter(Boolean).join(' - ')
    return meta
      ? `- ${councilor.name} (${meta})`
      : `- ${councilor.name}`
  })
  .join('\n')}`
}

function renderStatus(session: DeliberationSession): string {
  const lines: string[] = []
  lines.push('Active deliberation')
  lines.push('-'.repeat(40))
  lines.push(`Topic: ${session.topic}`)
  lines.push(`Mode:  ${session.mode}`)
  lines.push(`Phase: ${session.phase}`)
  lines.push(
    `Votes: yes ${session.stats.yeas} / no ${session.stats.nays} / abstain ${session.stats.abstainers}`,
  )

  if (session.messages.length > 0) {
    lines.push('\nRecent messages:')
    for (const msg of session.messages.slice(-5)) {
      const vote = msg.vote ? `[${msg.vote}]` : '[note]'
      lines.push(`  ${vote} [${msg.councilor}] ${msg.content.substring(0, 100)}`)
    }
  }

  return lines.join('\n')
}

function normalizeCouncilMode(value: string): string {
  // Keep compatibility with the upstream AI-Bot-Council-Concensus spelling.
  return value === 'concensus' ? 'consensus' : value
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getCouncilDeps().getHiveBridge()
  const parsed = splitCommandArgs(args)
  if (parsed.error) {
    return { type: 'text', value: parsed.error }
  }
  const parsedArgs = parsed.args
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []
  const recognizedInlineFlags = new Set([
    'mode',
    'status',
    'stop',
    'modes',
    'councilors',
  ])

  for (let i = 0; i < parsedArgs.length; i++) {
    const arg = parsedArgs[i]!
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split(/=(.*)/s, 2)
      if (key === 'mode' && value === undefined) {
        const next = parsedArgs[i + 1]
        if (next && !next.startsWith('--')) {
          flags[key] = next
          i += 1
        } else {
          flags[key] = true
        }
      } else {
        flags[key] = value ?? true
      }
    } else if (arg.includes('=')) {
      const [key, value] = arg.split(/=(.*)/s, 2)
      if (recognizedInlineFlags.has(key)) {
        flags[key] = value ?? true
      } else {
        positional.push(arg)
      }
    } else {
      positional.push(arg)
    }
  }

  const question = positional.join(' ').trim()

  if (flags.status !== undefined) {
    const session = await hive.getCurrentSession()
    if (!session || session.phase === 'idle') {
    return {
      type: 'text',
      value:
          'No active council deliberation. Start one with `duckhive council <question>` or `/council <question>`.\n' +
          'If Hive Nation is not running in this checkout, launch it with `bun run council:serve`.',
      }
    }
    return { type: 'text', value: renderStatus(session) }
  }

  if (flags.stop !== undefined) {
    const result = await hive.stopDeliberation()
    if (!result.success) {
      const healthy = await hive.isHealthy()
      if (!healthy) {
        return {
          type: 'text',
          value:
            'AI Council is offline. Nothing to stop because Hive Nation is not reachable.\n' +
            'Start the local runtime with `bun run council:serve`.',
        }
      }
      return {
        type: 'text',
        value: `Failed to stop council deliberation: ${result.error ?? 'Unknown error'}`,
      }
    }
    return { type: 'text', value: 'Council deliberation stopped.' }
  }

  if (flags.modes !== undefined) {
    const modes = await hive.getModes()
    return {
      type: 'text',
      value: renderModes(modes),
    }
  }

  if (flags.councilors !== undefined) {
    const councilors = await hive.getCouncilors()
    return {
      type: 'text',
      value: renderCouncilors(councilors),
    }
  }

  if (!question) {
    const session = await hive.getCurrentSession()
    if (session && session.phase !== 'idle') {
      return { type: 'text', value: renderStatus(session) }
    }
    const modes = await hive.getModes()
    return {
      type: 'text',
      value: `AI Council

No question provided. Usage:
  duckhive council Should I refactor this service?
  duckhive council --mode=adversarial What are the security risks?
  duckhive council --status
  duckhive council --stop
  duckhive council --modes
  duckhive council --councilors

REPL usage:
  /council Should I refactor this service?
  /council --mode=adversarial What are the security risks?
  /council "Should we use microservices?" mode=adversarial
  /council --status
  /council --stop
  /council --modes
  /council --councilors

Available modes: ${modes.join(', ')}`,
    }
  }

  const availableModes = await hive.getModes()
  const defaultMode = availableModes.includes('deliberation')
    ? 'deliberation'
    : availableModes.includes('balanced')
      ? 'balanced'
      : (availableModes[0] ?? 'balanced')
  const requestedMode =
    typeof flags.mode === 'string'
      ? normalizeCouncilMode(flags.mode)
      : flags.mode === true
        ? ''
        : undefined
  if (requestedMode === '') {
    return {
      type: 'text',
      value: `Missing council mode value.\n\nAvailable modes: ${availableModes.join(', ')}`,
    }
  }
  const mode = (requestedMode ?? defaultMode) as DeliberationMode
  if (!availableModes.includes(mode)) {
    return {
      type: 'text',
      value: `Unknown council mode: ${requestedMode}

Available modes: ${availableModes.join(', ')}`,
    }
  }
  const result = await hive.startDeliberation(question, mode)

  if (!result.success) {
    const healthy = await hive.isHealthy()
    if (!healthy) {
      return {
        type: 'text',
        value:
          'AI Council is offline. Start Hive Nation and retry `duckhive council` or `/council`.\n' +
          'For this source checkout, use `bun run council:serve`.',
      }
    }
    return { type: 'text', value: `Failed: ${result.error ?? 'Unknown error'}` }
  }

  return {
    type: 'text',
    value: `Council deliberation started: "${question}"
Mode: ${mode}
Session: ${result.sessionId ?? 'unknown'}

Monitor: duckhive council --status
REPL: /council --status`,
  }
}
