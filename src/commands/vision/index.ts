import type { Command } from '../../commands.js'

const vision = {
  type: 'local' as const,
  name: 'vision',
  aliases: ['vision-assist'],
  description: 'Capture and inspect phone screenshots from the DuckHive CLI',
  argumentHint: '[phone_screenshot|analyze <prompt>|phone_tap <x> <y>]',
  supportsNonInteractive: true,
  load: () => import('./vision-impl.js'),
} satisfies Command

export default vision
