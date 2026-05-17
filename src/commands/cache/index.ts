import type { Command } from '../../commands.js'

const cache = {
  type: 'local' as const,
  name: 'cache',
  aliases: ['provider-cache'],
  description: 'Inspect or clear the shared provider response cache',
  argumentHint: '[stats|clear]',
  supportsNonInteractive: true,
  load: () => import('./cache-impl.js'),
} satisfies Command

export default cache
