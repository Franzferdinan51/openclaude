/**
 * /mcp-manage command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'

const KNOWN_SERVERS = [
  { name: 'runescape', desc: 'RuneScape API tools' },
  { name: 'filesystem', desc: 'Local filesystem access' },
  { name: 'github', desc: 'GitHub API integration' },
  { name: 'brave-search', desc: 'Web search' },
]

export const call: LocalCommandCall = async (args: string) => {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? ''
  const name = parts[1]?.toLowerCase() ?? ''

  if (!subcommand || subcommand === 'list') {
    const lines = [`🛠️ Known MCP Servers\n${'─'.repeat(50)}\n`]
    for (const s of KNOWN_SERVERS) lines.push(`  ${s.name.padEnd(18)} — ${s.desc}`)
    lines.push('\nUse /mcp-manage connect <name> to start.')
    return { type: 'text', value: lines.join('\n') }
  }

  if (subcommand === 'connect' || subcommand === 'start') {
    if (!name) return { type: 'text', value: 'Usage: /mcp-manage connect <server-name>' }
    const server = KNOWN_SERVERS.find(s => s.name === name)
    if (!server) return { type: 'text', value: `Unknown: ${name}\n/mcp-manage list` }
    return { type: 'text', value: `🔌 Connect ${server.name}:\n/mcp enable ${server.name}\n\nOr configure in settings.json MCP section.` }
  }

  if (subcommand === 'disconnect' || subcommand === 'stop') {
    if (!name) return { type: 'text', value: 'Usage: /mcp-manage disconnect <server-name>' }
    return { type: 'text', value: `🔌 Disconnect ${name}:\n/mcp disable ${name}` }
  }

  return { type: 'text', value: `🛠️ MCP Manage\n${'─'.repeat(50)}\n/mcp-manage list              — List servers\n/mcp-manage connect <name>    — Connect\n/mcp-manage disconnect <name> — Disconnect` }
}
