/**
 * /council command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/hive-bridge.js'
import type { DeliberationMode, DeliberationSession } from '../../services/hive-bridge/hive-types.js'

function renderStatus(session: DeliberationSession): string {
  const lines: string[] = []
  lines.push(`🏛️ Active Deliberation`)
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  lines.push(`Topic: ${session.topic}`)
  lines.push(`Mode:  ${session.mode}`)
  lines.push(`Phase: ${session.phase}`)
  lines.push(`Votes: ✅ ${session.stats.yeas}  ❌ ${session.stats.nays}  ⬜ ${session.stats.abstainers}`)
  if (session.messages.length > 0) {
    lines.push(`\n📝 Recent Messages:`)
    for (const msg of session.messages.slice(-5)) {
      const vote = msg.vote ? (msg.vote === 'yea' ? '✅' : '❌') : '  '
      lines.push(`  ${vote} [${msg.councilor}] ${msg.content.substring(0, 100)}`)
    }
  }
  return lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getHiveBridge()
  const parsedArgs = args.trim().split(/\s+/).filter(Boolean)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (const arg of parsedArgs) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      flags[k] = v ?? true
    } else {
      positional.push(arg)
    }
  }

  const question = positional.join(' ').trim()

  if (flags.status !== undefined) {
    const session = await hive.getCurrentSession()
    if (!session || session.phase === 'idle') {
      return { type: 'text', value: '🏛️ No active council deliberation. Start one with `/council <question>`' }
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
    return { type: 'text', value: `🏛️ AI Council\n\nNo question provided. Usage:\n  /council Should I refactor this service?\n  /council --mode=adversarial What are the security risks?\n  /council --status\n\nAvailable modes: ${modes.join(', ')}` }
  }

  const mode = (flags.mode as DeliberationMode) ?? 'balanced'
  const result = await hive.startDeliberation(question, mode)

  if (!result.success) {
    const healthy = await hive.isHealthy()
    if (!healthy) {
      return { type: 'text', value: `🏛️ AI Council is offline. Start Hive Nation:\n  cd ~/Desktop/AgentTeam-GitHub && node council-api-server.cjs` }
    }
    return { type: 'text', value: `🏛️ Failed: ${result.error ?? 'Unknown error'}` }
  }

  return { type: 'text', value: `🏛️ Council deliberation started: "${question}"\nMode: ${mode}\nSession: ${result.sessionId ?? 'unknown'}\n\nMonitor: /council --status` }
}
