import type { Command } from '../../types/command.js'
import { call as swarmCall } from './swarm-impl.js'

export default {
  name: 'swarm',
  description: 'Execute code swarming with parallel agent execution',
  aliases: ['hive-swarm', 'code-swarm'],
  call: swarmCall,
} satisfies Command
