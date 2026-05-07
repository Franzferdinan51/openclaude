import type { Command } from '../../commands.js'

const loop = {
  type: 'local' as const,
  name: 'loop',
  description:
    'Schedule a prompt to run on a recurring interval. Useful for monitoring, polling, or repeated tasks.',
  aliases: [],
  supportsNonInteractive: true,
  load: () => import('./loop.js'),
} satisfies Command

export default loop
