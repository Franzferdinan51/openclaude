import type { Command } from '../../commands.js'

const mcpManageCommand = {
  type: 'local' as const,
  name: 'mcp-manage',
  description: 'Manage MCP server connections',
  aliases: ['mcpm', 'mcpg'],
  supportsNonInteractive: true,
  load: () => import('./mcp-manage-impl.js'),
} satisfies Command

export default mcpManageCommand
