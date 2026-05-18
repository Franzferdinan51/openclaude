import type { Command } from '../../commands.js'

const permissions = {
  type: 'local-jsx',
  name: 'permissions',
  aliases: ['allowed-tools'],
  description: 'Manage allow/deny rules and Codex-style permission profiles',
  supportsNonInteractive: true,
  load: () => import('./permissions.js'),
} satisfies Command

export default permissions
