import type { Command } from '../../commands.js'

const connect = {
  type: 'local' as const,
  name: 'connect',
  description: 'Connect external services (Telegram, etc.)',
  aliases: ['telegram'],
  supportsNonInteractive: true,
  load: () => import('./connect-impl.js'),
} satisfies Command

export default connect
