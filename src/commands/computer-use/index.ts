import type { Command } from '../../commands.js'

const computerUse = {
  type: 'local' as const,
  name: 'computer-use',
  aliases: ['cu', 'desktop', 'comput-use'],
  description: 'Enable macOS desktop automation via OpenAI Codex\'s computer-use MCP server',
  argumentHint: '[enable|disable|status]',
  load: () => import('./impl.js'),
} satisfies Command

export default computerUse
