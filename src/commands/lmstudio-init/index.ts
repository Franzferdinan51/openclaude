import type { Command } from '../../commands.js'

const lmstudioInit = {
  type: 'local',
  name: 'lmstudio-init',
  aliases: ['lmstudio', 'lm-studio'],
  description: 'Configure DuckHive to use LM Studio',
  argumentHint: '[--base-url <url>] [--model <model>] [--api-key <key>]',
  supportsNonInteractive: true,
  load: () => import('./lmstudio-init-impl.js'),
} satisfies Command

export default lmstudioInit
