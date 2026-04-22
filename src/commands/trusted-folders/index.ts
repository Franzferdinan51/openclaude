import type { Command } from '../../commands.js'

const trustedCommand = {
  type: 'local' as const,
  name: 'trusted',
  description: 'Manage trusted folders for file operations (Gemini CLI-style)',
  aliases: ['trust', 'trustedfolders'],
  supportsNonInteractive: true,
  load: () => import('./trusted-impl.js'),
} satisfies Command

export default trustedCommand
