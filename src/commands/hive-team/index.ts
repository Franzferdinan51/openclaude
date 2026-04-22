import type { Command } from '../../commands.js'

const teamCommand = {
  type: 'local' as const,
  name: 'team',
  description: 'Spawn and manage agent teams via Hive Nation',
  supportsNonInteractive: true,
  load: () => import('./team-impl.js'),
} satisfies Command

export default teamCommand
