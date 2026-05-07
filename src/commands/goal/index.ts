import type { Command } from '../../commands.js'

const goal = {
  type: 'local' as const,
  name: 'goal',
  description:
    'Persisted workflow goals — create, track, pause, resume, and manage multi-step tasks. Inspired by Codex /goal (r0.128.0).',
  aliases: ['g'],
  supportsNonInteractive: true,
  load: () => import('./goal.js'),
} satisfies Command

export default goal
