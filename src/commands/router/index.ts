import type { Command } from '../../commands.js'

const router = {
  type: 'local' as const,
  name: 'router',
  aliases: ['route-model', 'model-router'],
  description: 'Route tasks to the best available model across providers',
  argumentHint:
    '[route <task> [complexity=<1-10>] [vision=true|false] [functionCalling=true|false] [preferSpeed=true|false] [preferQuality=true|false] [maxCost=<usd>]] | [list] | [compare <task> ...]',
  supportsNonInteractive: true,
  load: () => import('./router-impl.js'),
} satisfies Command

export default router
