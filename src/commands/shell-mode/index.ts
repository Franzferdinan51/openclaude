import type { Command } from '../../commands.js'

const shellModeCommand = {
  type: 'local' as const,
  name: 'shell-mode',
  description: 'Enter shell mode (Ctrl-X alternates between chat and shell)',
  aliases: ['ctrlx', 'sh', 'shellmode'],
  supportsNonInteractive: true,
  load: () => import('./shell-mode-impl.js'),
} satisfies Command

export default shellModeCommand
