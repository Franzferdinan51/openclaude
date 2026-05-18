import type { Command } from '../../commands.js'
const voice = {
  type: 'local',
  name: 'voice',
  description: 'Inspect or toggle push-to-talk voice mode',
  argumentHint: '[status|--help]',
  supportsNonInteractive: true,
  load: () => import('./voice.js'),
} satisfies Command

export default voice
