import type { Command } from '../../commands.js'

const budget = {
  type: 'local' as const,
  name: 'budget',
  aliases: ['spend'],
  description: 'Inspect and update DuckHive daily provider budgets',
  argumentHint: '[set <provider|global> <usd> | reset]',
  supportsNonInteractive: true,
  load: () => import('./budget-impl.js'),
} satisfies Command

export default budget
