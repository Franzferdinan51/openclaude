/**
 * /team command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/index.js'
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

type TeamDeps = {
  getHiveBridge: typeof getHiveBridge
}

let teamTestDeps: Partial<TeamDeps> | null = null

function getTeamDeps(): TeamDeps {
  return {
    getHiveBridge,
    ...teamTestDeps,
  }
}

export function setTeamTestDeps(overrides: Partial<TeamDeps> | null): void {
  teamTestDeps = overrides
}

function splitCommandArgs(args: string): string[] {
  return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg => arg.replace(/^["']|["']$/g, '')) ?? []
}

function renderTemplates(includeRoles = false): string {
  return Object.entries(TEAM_TEMPLATES)
    .map(([name, template]) => {
      const line = `  ${name.padEnd(12)} - ${template.description}`
      return includeRoles ? `${line}\n    Roles: ${template.roles.join(', ')}` : line
    })
    .join(includeRoles ? '\n\n' : '\n')
}

function renderUnknownTemplateError(value: string): string {
  return `Unknown team template: ${value}
Available templates: ${Object.keys(TEAM_TEMPLATES).join(', ')}

Usage: /team spawn <name> <type>
   or: /team spawn <type> <name>`
}

function formatHiveOfflineError(error?: string): string {
  return `Failed: ${error ?? 'Hive Nation offline'}\nStart the local runtime with \`bun run council:serve\` or point DuckHive at a running service with \`DUCKHIVE_COUNCIL_URL\`.`
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getTeamDeps().getHiveBridge()
  const parts = splitCommandArgs(args)
  const subcommand = parts[0]?.toLowerCase() ?? ''

  if (!subcommand || subcommand === 'list' || subcommand === 'ls') {
    const teams = await hive.getActiveTeams()
    if (teams.length === 0) {
      const healthy = await hive.isHealthy()
      if (!healthy) {
        return {
          type: 'text',
          value: formatHiveOfflineError(),
        }
      }

      return {
        type: 'text',
        value: 'No active teams.\nSpawn one with: /team spawn <name> <type>',
      }
    }

    const lines: string[] = [`Active teams (${teams.length})`, '-'.repeat(50)]
    for (const team of teams) {
      lines.push(`${team.name} (${team.template})`)
      lines.push(`   Status: ${team.status} | Roles: ${team.roles.length}`)
    }
    return { type: 'text', value: lines.join('\n') }
  }

  const isTemplateName = (value: string): value is TeamTemplate =>
    value in TEAM_TEMPLATES

  if (subcommand === 'spawn' || subcommand === 'create' || subcommand === 'new') {
    const templateFirstType = parts[1]
    const templateLastType = parts[parts.length - 1]
    const hasTemplateFirst = isTemplateName(templateFirstType ?? '')
    const hasTemplateLast = isTemplateName(templateLastType ?? '')

    if (parts.length >= 4 && !hasTemplateFirst && !hasTemplateLast && templateLastType) {
      return {
        type: 'text',
        value: renderUnknownTemplateError(templateLastType),
      }
    }

    const type = hasTemplateFirst
      ? templateFirstType
      : hasTemplateLast
        ? templateLastType
        : 'research'
    const name = hasTemplateFirst
      ? parts.slice(2).join(' ')
      : parts.slice(1, -1).join(' ') || parts.slice(1).join(' ')

    if (!name || name === type) {
      return {
        type: 'text',
        value: `Spawn team
${'-'.repeat(50)}
Usage: /team spawn <name> <type>
   or: /team spawn <type> <name>
   or: /team <type> <name>

Templates:
${renderTemplates()}`,
      }
    }

    const result = await hive.spawnTeam(name, type)
    if (result.success) {
      return {
        type: 'text',
        value: `Team spawned.
Name: ${name}
Template: ${type}
Roles: ${TEAM_TEMPLATES[type]?.roles.join(', ') ?? 'unknown'}`,
      }
    }

    return { type: 'text', value: formatHiveOfflineError(result.error) }
  }

  if (isTemplateName(subcommand)) {
    const type = subcommand
    const name = parts.slice(1).join(' ')

    if (!name) {
      return {
        type: 'text',
        value: `Spawn team
${'-'.repeat(50)}
Usage: /team ${type} <name>

Templates:
${renderTemplates()}`,
      }
    }

    const result = await hive.spawnTeam(name, type)
    if (result.success) {
      return {
        type: 'text',
        value: `Team spawned.
Name: ${name}
Template: ${type}
Roles: ${TEAM_TEMPLATES[type]?.roles.join(', ') ?? 'unknown'}`,
      }
    }

    return { type: 'text', value: formatHiveOfflineError(result.error) }
  }

  if (subcommand === 'templates' || subcommand === 'types') {
    return {
      type: 'text',
      value: `Team templates
${'-'.repeat(50)}

${renderTemplates(true)}`,
    }
  }

  return {
    type: 'text',
    value: `Team command
${'-'.repeat(50)}
/team list                - List active teams
/team spawn <name> <type> - Spawn a new team
/team <type> <name>       - Spawn using shorthand template form
/team templates           - Show available templates`,
  }
}
