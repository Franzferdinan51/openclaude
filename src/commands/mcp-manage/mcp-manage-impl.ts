/**
 * /mcp-manage command implementation
 *
 * This command is a noninteractive helper surface for the real /mcp UI and
 * toggle flow. It intentionally avoids hardcoded server inventories so it
 * cannot drift from the actual MCP configuration state.
 */
import type { LocalCommandCall } from '../../types/command.js'

function renderHelp(): string {
  return `MCP Manage
${'-'.repeat(50)}
/mcp                        Open the MCP manager UI
/mcp enable <server-name>   Enable a configured server
/mcp disable <server-name>  Disable a configured server
/mcp reconnect <server>     Reconnect a server

Examples:
  /mcp-manage list
  /mcp-manage connect github
  /mcp-manage disconnect filesystem
`
}

export const call: LocalCommandCall = async (args: string) => {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? ''
  const name = parts.slice(1).join(' ').trim()

  if (!subcommand || subcommand === 'list' || subcommand === 'help') {
    return { type: 'text', value: renderHelp() }
  }

  if (subcommand === 'connect' || subcommand === 'start') {
    if (!name) {
      return { type: 'text', value: 'Usage: /mcp-manage connect <server-name>' }
    }
    return {
      type: 'text',
      value: `Enable MCP server "${name}" with:\n/mcp enable ${name}\n\nRun /mcp to inspect current MCP server status.`,
    }
  }

  if (subcommand === 'disconnect' || subcommand === 'stop') {
    if (!name) {
      return { type: 'text', value: 'Usage: /mcp-manage disconnect <server-name>' }
    }
    return {
      type: 'text',
      value: `Disable MCP server "${name}" with:\n/mcp disable ${name}\n\nRun /mcp to inspect current MCP server status.`,
    }
  }

  if (subcommand === 'reconnect') {
    if (!name) {
      return { type: 'text', value: 'Usage: /mcp-manage reconnect <server-name>' }
    }
    return {
      type: 'text',
      value: `Reconnect MCP server "${name}" with:\n/mcp reconnect ${name}`,
    }
  }

  return { type: 'text', value: renderHelp() }
}
