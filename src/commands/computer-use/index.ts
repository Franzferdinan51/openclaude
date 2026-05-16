import type { Command } from '../../commands.js'

const computerUse = {
  type: 'local' as const,
  name: 'computer-use',
  aliases: ['cu', 'comput-use'],
  description: 'Wire Codex computer-use into DuckHive for macOS desktop automation',
  argumentHint: '[enable|disable|status]',
  load: () => import('./impl.js') as any,
} as Command

export default computerUse
