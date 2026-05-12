import type { Command } from '../../types/command.js'

const swarmImpl = require('./swarm-impl.js')

export default {
  name: 'swarm',
  description: 'Execute code swarming with parallel agent execution',
  aliases: ['hive-swarm', 'code-swarm'],
  _call: swarmImpl.call,
} satisfies Command
