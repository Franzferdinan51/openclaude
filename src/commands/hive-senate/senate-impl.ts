/**
 * /senate command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/hive-bridge.js'
import type { Decree } from '../../services/hive-bridge/hive-types.js'

function renderDecree(d: Decree): string {
  const lines: string[] = []
  lines.push(`📜 ${d.title}`)
  lines.push(`${'─'.repeat(50)}`)
  lines.push(`${d.content}`)
  lines.push(`Status: ${d.status.toUpperCase()} | Priority: ${d.priority.toUpperCase()} | Scope: ${d.scope}`)
  if (d.votes) lines.push(`Votes: ✅ ${d.votes.yeas} yeas / ❌ ${d.votes.nays} nays`)
  lines.push(`Issued: ${new Date(d.createdAt).toLocaleString()}`)
  return lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getHiveBridge()
  const subcommand = args.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const rest = args.trim().substring(subcommand.length).trim()

  if (!subcommand || subcommand === 'list' || subcommand === 'ls') {
    const decrees = await hive.getActiveDecrees()
    if (decrees.length === 0) {
      return { type: 'text', value: '🏛️ Senate\n\nNo active decrees. Issue one with:\n/senate issue <title> | <content>' }
    }
    const parts: string[] = [`🏛️ Active Decrees (${decrees.length})\n${'─'.repeat(50)}`]
    for (const d of decrees) {
      const badge = d.priority === 'high' ? '🔴' : d.priority === 'medium' ? '🟡' : '🟢'
      parts.push(`${badge} [${d.id}] ${d.title}\n   ${d.content.substring(0, 80)}${d.content.length > 80 ? '...' : ''}`)
    }
    return { type: 'text', value: parts.join('\n') }
  }

  if (subcommand === 'issue' || subcommand === 'add' || subcommand === 'new') {
    const parts2 = rest.split('|').map(s => s.trim())
    const title = parts2[0] ?? ''
    const content = parts2[1] ?? title
    if (!title && !content) {
      return { type: 'text', value: `📜 Senate Decree\n\nUsage: /senate issue <title> | <content>\n\nExamples:\n  /senate issue Privacy Protection | All agents MUST encrypt sensitive data\n  /senate issue No Destructive Commands | Agents SHALL NOT execute rm -rf` }
    }
    const result = await hive.issueDecree(title, content)
    if (result.success) {
      return { type: 'text', value: `✅ Decree issued: "${title}"\n${renderDecree({ id: result.decreeId ?? 'unknown', title, content, status: 'active', authority: 'openclaude', scope: 'agent', priority: 'medium', createdAt: Date.now() })}` }
    }
    return { type: 'text', value: `❌ Failed: ${result.error ?? 'Hive Nation offline'}` }
  }

  if (subcommand === 'show' || subcommand === 'view') {
    const id = rest.trim()
    if (!id) return { type: 'text', value: '📜 Show decree: /senate show <decree-id>' }
    const decree = await hive.getDecree(id)
    if (!decree) return { type: 'text', value: `❌ Decree not found: ${id}` }
    return { type: 'text', value: renderDecree(decree) }
  }

  return { type: 'text', value: `🏛️ Senate Command\n${'─'.repeat(50)}\n/senate list              — List active decrees\n/senate issue <title>|<content> — Issue a new decree\n/senate show <id>         — View decree details` }
}
