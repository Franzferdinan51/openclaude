import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'

const onboard = {
  type: 'local-jsx' as const,
  name: 'onboard',
  aliases: ['setup', 'init', 'welcome'] as const,
  description: 'Start DuckHive setup wizard - configure providers, API keys, and preferences',
  argumentHint: '',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./onboard.js'),
} satisfies Command

export default onboard
