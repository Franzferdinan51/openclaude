import type { Command } from '../../commands.js'

const orchestrateCommand = {
  type: 'local' as const,
  name: 'orchestrate',
  description: 'Multi-agent orchestration with AI Council oversight (Hive Nation)',
  aliases: ['orch', 'multi'],
  supportsNonInteractive: true,
  load: () => import('./orchestrate-impl.js'),
} satisfies Command

export default orchestrateCommand
