/**
 * /team command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/hive-bridge.js'
import type { TeamTemplate } from '../../services/hive-bridge/hive-types.js'

const TEAM_TEMPLATES: Record<TeamTemplate, { roles: string[]; description: string }> = {
  research: { roles: ['researcher', 'writer', 'reviewer'], description: 'Research + write + review' },
  code: { roles: ['coder', 'reviewer', 'security'], description: 'Code + review + security' },
  security: { roles: ['security', 'reviewer', 'communicator'], description: 'Security audit team' },
  emergency: { roles: ['security', 'communicator', 'planner'], description: 'Incident response' },
  planning: { roles: ['planner', 'analyst', 'reviewer'], description: 'Strategic planning' },
  analysis: { roles: ['analyst', 'researcher', 'writer'], description: 'Deep analysis' },
  devops: { roles: ['devops', 'security', 'reviewer'], description: 'DevOps + infrastructure' },
  swarm: { roles: ['specialist-1', 'specialist-2', 'specialist-3', 'coordinator'], description: 'Multiple specialists' },
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getHiveBridge()
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? ''

  if (!subcommand || subcommand === 'list' || subcommand === 'ls') {
    const teams = await hive.getActiveTeams()
    if (teams.length === 0) return { type: 'text', value: '👥 No active teams.\nSpawn one: /team spawn <name> <type>' }
    const lines: string[] = [`👥 Active Teams (${teams.length})\n${'─'.repeat(50)}`]
    for (const t of teams) {
      const icon = t.status === 'active' ? '🟢' : t.status === 'planning' ? '🟡' : '⚪'
      lines.push(`${icon} ${t.name} (${t.template})\n   Status: ${t.status} | Roles: ${t.roles.length}`)
    }
    return { type: 'text', value: lines.join('\n') }
  }

  if (subcommand === 'spawn' || subcommand === 'create' || subcommand === 'new') {
    const type = parts[parts.length - 1] as TeamTemplate ?? 'research'
    const name = parts.slice(1, -1).join(' ') || parts.slice(1).join(' ') || ''
    if (!name || name === type) {
      const tmpl = Object.entries(TEAM_TEMPLATES).map(([k, v]) => `  ${k.padEnd(12)} — ${v.description}`).join('\n')
      return { type: 'text', value: `👥 Spawn Team\n${'─'.repeat(50)}\nUsage: /team spawn <name> <type>\n\nTemplates:\n${tmpl}` }
    }
    const result = await hive.spawnTeam(name, type)
    if (result.success) {
      return { type: 'text', value: `✅ Team spawned!\n👥 Name: ${name}\n🔧 Template: ${type}\n📋 Roles: ${TEAM_TEMPLATES[type]?.roles.join(', ') ?? 'unknown'}` }
    }
    return { type: 'text', value: `❌ Failed: ${result.error ?? 'Hive Nation offline'}` }
  }

  if (subcommand === 'templates' || subcommand === 'types') {
    const tmpl = Object.entries(TEAM_TEMPLATES).map(([k, v]) => `  ${k.padEnd(12)} — ${v.description}\n    Roles: ${v.roles.join(', ')}`).join('\n\n')
    return { type: 'text', value: `👥 Team Templates\n${'─'.repeat(50)}\n\n${tmpl}` }
  }

  return { type: 'text', value: `👥 Team Command\n${'─'.repeat(50)}\n/team list              — List active teams\n/team spawn <name> <type> — Spawn a new team\n/team templates         — Show available templates` }
}
