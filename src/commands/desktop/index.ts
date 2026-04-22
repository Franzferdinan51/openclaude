import type { Command } from '../../commands.js'

const desktopCommand = {
  type: 'local' as const,
  name: 'desktop',
  description: 'DuckHive desktop automation — screenshot, mouse, keyboard, OCR, window control',
  aliases: ['dc', 'screenshot', 'mouse', 'scr'],
  supportsNonInteractive: false,
  load: () => import('./desktop-impl.js'),
} satisfies Command

export default desktopCommand
