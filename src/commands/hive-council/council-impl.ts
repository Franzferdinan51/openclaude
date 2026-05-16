/**
 * /council command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/index.js'
import type {
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

export const call: LocalCommandCall = async (args: string) => {
  const hive = getCouncilDeps().getHiveBridge()
  const parsedArgs = args.trim().split(/\s+/).filter(Boolean)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (const arg of parsedArgs) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      flags[key] = value ?? true
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
        value: 'No active council deliberation. Start one with `/council <question>`.',
      }
    }
    return { type: 'text', value: renderStatus(session) }
  }

  if (flags.stop !== undefined) {
    return { type: 'text', value: 'Council deliberation ended.' }
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
  /council Should I refactor this service?
  /council --mode=adversarial What are the security risks?
  /council --status

Available modes: ${modes.join(', ')}`,
    }
  }

  const mode = (flags.mode as DeliberationMode) ?? 'balanced'
  const result = await hive.startDeliberation(question, mode)

  if (!result.success) {
    const healthy = await hive.isHealthy()
    if (!healthy) {
      return {
        type: 'text',
        value: 'AI Council is offline. Start Hive Nation and retry `/council`.',
      }
    }
    return { type: 'text', value: `Failed: ${result.error ?? 'Unknown error'}` }
  }

  return {
    type: 'text',
    value: `Council deliberation started: "${question}"
Mode: ${mode}
Session: ${result.sessionId ?? 'unknown'}

Monitor: /council --status`,
  }
}
