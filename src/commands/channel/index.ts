import type { Command } from '../../commands.js'

const channel = {
  type: 'local' as const,
  name: 'channel',
  description: 'Manage channel adapters (Telegram, etc.)',
  aliases: [],
  supportsNonInteractive: true,
  load: () => import('./channel-impl.js'),
} satisfies Command

export default channel