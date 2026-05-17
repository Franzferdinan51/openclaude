import type { Command } from '../../commands.js'

const shadow = {
  type: 'local' as const,
  name: 'shadow',
  aliases: ['shadow-git'],
  description: 'Create and manage shadow Git checkpoints before risky changes',
  argumentHint:
    '[checkpoint <message>] | [list] | [restore <checkpoint-id> [--file <path>]]',
  supportsNonInteractive: true,
  load: () => import('./shadow-impl.js'),
} satisfies Command

export default shadow
