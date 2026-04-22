import type { Command } from '../../commands.js'

const checkpointCommand = {
  type: 'local' as const,
  name: 'checkpoint',
  description: 'Save/restore session checkpoints (Gemini CLI-style context management)',
  aliases: ['snap', 'savepoint'],
  supportsNonInteractive: true,
  load: () => import('./checkpoint-impl.js'),
} satisfies Command

export default checkpointCommand
