import type { Command } from '../../commands.js'

const run = {
  type: 'local' as const,
  name: 'run',
  aliases: ['runs', 'agent-run'],
  description: 'Inspect and control AgentRun records',
  argumentHint: '[list|<id>|tail|pause|resume|stop|approve|recover]',
  supportsNonInteractive: true,
  load: () => import('./run-impl.js'),
} satisfies Command

export default run
