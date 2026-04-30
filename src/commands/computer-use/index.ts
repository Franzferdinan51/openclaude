import type { Command } from '../../commands.js'

const computerUse = {
  type: 'local-jsx',
  name: 'computer-use',
  aliases: ['cu', 'desktop', 'comput-use'],
  description: 'Enable macOS desktop automation via OpenAI Codex\'s computer-use MCP server',
  argumentHint: '[enable|disable|status]',
  examples: [
    { description: 'Enable Codex computer-use MCP', args: 'enable' },
    { description: 'Check computer-use status', args: 'status' },
    { description: 'Disable computer-use', args: 'disable' },
  ],
  load: () => import('./impl.js'),
} satisfies Command

export default computerUse
