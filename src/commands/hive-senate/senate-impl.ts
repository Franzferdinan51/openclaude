/**
 * /senate command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/index.js'
import type { Decree } from '../../services/hive-bridge/hive-types.js'

type SenateDeps = {
  getHiveBridge: typeof getHiveBridge
}

let senateTestDeps: Partial<SenateDeps> | null = null

function getSenateDeps(): SenateDeps {
  return {
    getHiveBridge,
    ...senateTestDeps,
  }
}

export function setSenateTestDeps(overrides: Partial<SenateDeps> | null): void {
  senateTestDeps = overrides
}

function splitCommandArgs(args: string): string[] {
  return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg => arg.replace(/^["']|["']$/g, '')) ?? []
}

function trimOuterQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '').trim()
}

function renderDecree(decree: Decree): string {
  const lines: string[] = []
  lines.push(decree.title)
  lines.push('-'.repeat(50))
  lines.push(decree.content)
  lines.push(
    `Status: ${decree.status.toUpperCase()} | Priority: ${decree.priority.toUpperCase()} | Scope: ${decree.scope}`,
  )
  if (decree.votes) {
    lines.push(`Votes: ${decree.votes.yeas} yeas / ${decree.votes.nays} nays`)
  }
  lines.push(`Issued: ${new Date(decree.createdAt).toLocaleString()}`)
  return lines.join('\n')
}

function formatHiveOfflineError(error?: string): string {
  return `Failed: ${error ?? 'Hive Nation offline'}\nStart the local runtime with \`bun run council:serve\` or point DuckHive at a running service with \`DUCKHIVE_COUNCIL_URL\`.`
}

function renderSenateHelp(): string {
  return `Senate command
${'-'.repeat(50)}
Terminal:
duckhive senate list                    - List active decrees
duckhive senate issue <title>|<content> - Issue a new decree
duckhive senate show <id>               - View decree details

REPL:
/senate list
/senate issue <title>|<content>
/senate show <id>`
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getSenateDeps().getHiveBridge()
  const parts = splitCommandArgs(args)
  const subcommand = parts[0]?.toLowerCase() ?? ''
  const rest = parts.slice(1).join(' ').trim()

  if (subcommand === 'help') {
    return {
      type: 'text',
      value: renderSenateHelp(),
    }
  }

  function issueUsage() {
    return {
      type: 'text' as const,
      value: `Senate decree

Terminal usage: duckhive senate issue <title> | <content>
REPL usage:     /senate issue <title> | <content>

Examples:
  duckhive senate issue Privacy Protection | All agents MUST encrypt sensitive data
  /senate issue Privacy Protection | All agents MUST encrypt sensitive data
  /senate issue No Destructive Commands | Agents SHALL NOT execute rm -rf`,
    }
  }

  async function issueDecreeText(rawIssue: string) {
    const issueParts = rawIssue.split('|').map(s => s.trim())
    const title = trimOuterQuotes(issueParts[0] ?? '')
    const content = trimOuterQuotes(issueParts[1] ?? title)

    if (!title && !content) {
      return issueUsage()
    }

    const result = await hive.issueDecree(title, content)
    if (result.success) {
      return {
        type: 'text' as const,
        value: `Decree issued: "${title}"
${renderDecree({
  id: result.decreeId ?? 'unknown',
  title,
  content,
  status: 'active',
  authority: 'duckhive',
  scope: 'agent',
  priority: 'medium',
  createdAt: Date.now(),
})}`,
      }
    }

    return { type: 'text' as const, value: formatHiveOfflineError(result.error) }
  }

  if (!subcommand || subcommand === 'list' || subcommand === 'ls') {
    const decrees = await hive.getActiveDecrees()
    if (decrees.length === 0) {
      const healthy = await hive.isHealthy()
      if (!healthy) {
        return {
          type: 'text',
          value: formatHiveOfflineError(),
        }
      }

      return {
        type: 'text',
        value:
          'Senate\n\nNo active decrees. Issue one with:\nduckhive senate issue <title> | <content>\nREPL: /senate issue <title> | <content>',
      }
    }

    const parts: string[] = [`Active decrees (${decrees.length})`, '-'.repeat(50)]
    for (const decree of decrees) {
      parts.push(
        `[${decree.id}] ${decree.title}\n   ${decree.content.substring(0, 80)}${decree.content.length > 80 ? '...' : ''}`,
      )
    }
    return { type: 'text', value: parts.join('\n') }
  }

  if (subcommand === 'issue' || subcommand === 'add' || subcommand === 'new') {
    return issueDecreeText(rest)
  }

  if (subcommand === 'show' || subcommand === 'view') {
    const id = rest.trim()
    if (!id) {
      return {
        type: 'text',
        value: 'Show decree: duckhive senate show <decree-id>\nREPL: /senate show <decree-id>',
      }
    }

    const decree = await hive.getDecree(id)
    if (!decree) return { type: 'text', value: `Decree not found: ${id}` }
    return { type: 'text', value: renderDecree(decree) }
  }

  const implicitIssue = parts.join(' ').trim()
  if (implicitIssue) {
    return issueDecreeText(implicitIssue)
  }

  return {
    type: 'text',
    value: renderSenateHelp(),
  }
}
