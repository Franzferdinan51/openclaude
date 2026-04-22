import type { Command } from '../../commands.js'

const councilCommand = {
  type: 'local' as const,
  name: 'council',
  description: 'Consult the AI Council for complex decisions (Hive Nation)',
  supportsNonInteractive: true,
  load: () => import('./council-impl.js'),
} satisfies Command

export default councilCommand
