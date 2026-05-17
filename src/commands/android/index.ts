import type { Command } from '../../commands.js'

const android = {
  type: 'local' as const,
  name: 'android',
  aliases: ['adb'],
  description: 'Control an Android device over ADB from the DuckHive CLI',
  argumentHint:
    '[devices|screenshot|battery|tap <x> <y>|swipe <x1> <y1> <x2> <y2> [durationMs]|text <message>|shell <command>]',
  supportsNonInteractive: true,
  load: () => import('./android-impl.js'),
} satisfies Command

export default android
