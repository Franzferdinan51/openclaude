import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { isYoloModeEnabled } from './yolo.js'

const yolo = {
  type: 'local' as const,
  name: 'yolo',
  aliases: ['bypass', 'perm'] as const,
  description: 'Toggle yolo/permission bypass mode (auto-approve all tool calls)',
  supportsNonInteractive: true,
  isEnabled: () => isYoloModeEnabled(),
  argumentHint: '[on|off|toggle]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: async () => {
    const mod = await import('./yolo.tsx' as any)
    return mod.default as unknown as { call: (args: string, ctx: any) => Promise<unknown> }
  },
} satisfies Command

export default yolo
