import type { Command } from '../../commands.js'

const curate = {
  type: 'local' as const,
  name: 'curate',
  description:
    'DuckHive skill librarian - grades, consolidates, and prunes the skill library. Inspired by Hermes-Agent v0.12.0 Curator.',
  aliases: [],
  supportsNonInteractive: true,
  load: () => import('./curate.js'),
} satisfies Command

export default curate
