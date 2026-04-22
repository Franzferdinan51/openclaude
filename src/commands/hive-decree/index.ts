import type { Command } from '../../commands.js'

const decreeCommand = {
  type: 'local' as const,
  name: 'decree',
  description: 'Quick-create a Senate decree (shorthand: /decree <title> | <content>)',
  aliases: ['law', 'rule'],
  supportsNonInteractive: true,
  load: () => import('./decree-impl.js'),
} satisfies Command

export default decreeCommand
