import type { Command } from '../../commands.js'

const senateCommand = {
  type: 'local' as const,
  name: 'senate',
  description: 'Issue and manage binding Senate decrees (Hive Nation)',
  supportsNonInteractive: true,
  load: () => import('./senate-impl.js'),
} satisfies Command

export default senateCommand
