/**
 * Spawn Command - Subagent Teammate Spawning
 *
 * Exposes the sessions_spawn functionality as a user-facing slash command.
 * Inspired by Hermes Agent's subagent spawning.
 */

import type { Command } from '../../commands.js'

const spawn = {
  type: 'local-jsx' as const,
  name: 'spawn',
  aliases: ['subagent', 'deep-dive'],
  description: 'Spawn a subagent teammate for deep analysis',
  load: async () => (await import('./spawn.js')).default,
} satisfies Command

export default spawn
