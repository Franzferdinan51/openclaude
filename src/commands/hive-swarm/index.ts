import type { Command } from '../../types/command.js'
import { call as swarmCall } from './swarm-impl.js'

export default {
  type: 'local' as const,
  name: 'swarm',
  description: 'Execute code swarming with parallel agent execution',
  aliases: ['hive-swarm', 'code-swarm'],
  supportsNonInteractive: false,
  load: async () => ({ call: swarmCall }),
} satisfies Command
