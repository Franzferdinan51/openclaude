import type { Command } from '../../commands.js'

const skill = {
  type: 'local' as const,
  name: 'skill',
  aliases: ['skill-workshop'],
  description: 'Scaffold, inspect, and delete reusable workflow skills',
  argumentHint:
    '[<name> | create <name> | search <query> | inspect <slug> | install <slug> | list | read <name> | delete <name>]',
  supportsNonInteractive: true,
  load: () => import('./skill-impl.js'),
} satisfies Command

export default skill
