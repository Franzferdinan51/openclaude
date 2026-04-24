import type { Command } from '../../commands.js'

const tui = {
  type: 'local',
  name: 'tui',
  aliases: ['ui'],
  description: 'Launch the Go TUI or set the default DuckHive UI',
  argumentHint: '[tui|legacy]',
  supportsNonInteractive: false,
  load: () => import('./tui.js'),
} satisfies Command

export default tui
