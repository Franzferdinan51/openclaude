/**
 * /decree command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/index.js'

type DecreeDeps = {
  getHiveBridge: typeof getHiveBridge
}

let decreeTestDeps: Partial<DecreeDeps> | null = null

function getDecreeDeps(): DecreeDeps {
  return {
    getHiveBridge,
    ...decreeTestDeps,
  }
}

export function setDecreeTestDeps(overrides: Partial<DecreeDeps> | null): void {
  decreeTestDeps = overrides
}

function trimOuterQuotes(value: string): string {
  const trimmed = value.trim()
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  if ((first === '"' || first === "'") && first === last) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function parseDecreeIssue(args: string): { title?: string; content?: string; error?: string } {
  let title = ''
  let content = ''
  let target: 'title' | 'content' = 'title'
  let quote: '"' | "'" | null = null

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!

    if (quote) {
      if (ch === quote) {
        quote = null
        continue
      }
      if (ch === '\\' && i + 1 < args.length) {
        const next = args[i + 1]!
        if (next === quote || next === '\\') {
          if (target === 'title') title += next
          else content += next
          i += 1
          continue
        }
      }
      if (target === 'title') title += ch
      else content += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }

    if (ch === '|' && target === 'title') {
      target = 'content'
      continue
    }

    if (target === 'title') title += ch
    else content += ch
  }

  if (quote) {
    return { error: 'Unterminated quoted string in /decree arguments.' }
  }

  const cleanTitle = trimOuterQuotes(title)
  const cleanContent = trimOuterQuotes(content) || cleanTitle
  return { title: cleanTitle, content: cleanContent }
}

function formatHiveOfflineError(error?: string): string {
  return `Failed: ${error ?? 'Hive Nation offline'}\nStart the local runtime with \`bun run council:serve\` or point DuckHive at a running service with \`DUCKHIVE_COUNCIL_URL\`.`
}

function renderDecreeHelp(): string {
  return `Decree command
${'-'.repeat(50)}
Terminal:
duckhive decree list                         - List active decrees
duckhive decree <title> | <content>          - Issue a binding decree
Example: duckhive decree Secure Mode | Agents SHALL ask before destructive commands

REPL:
/decree list
/decree <title> | <content>
Example: /decree Secure Mode | Agents SHALL ask before destructive commands`
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getDecreeDeps().getHiveBridge()
  const rest = args.trim()

  if (rest === 'help') {
    return {
      type: 'text',
      value: renderDecreeHelp(),
    }
  }

  if (!rest || rest === 'list') {
    const decrees = await hive.getActiveDecrees()
    if (decrees.length === 0) {
      const healthy = await hive.isHealthy()
      if (!healthy) {
        return { type: 'text', value: formatHiveOfflineError() }
      }

      return { type: 'text', value: 'No active decrees.' }
    }

    return {
      type: 'text',
      value: `Active decrees:\n${decrees
        .map(decree => `  [${decree.priority}] ${decree.title}: ${decree.content.substring(0, 60)}`)
        .join('\n')}`,
    }
  }

  const parsedIssue = parseDecreeIssue(rest)
  if (parsedIssue.error) {
    return { type: 'text', value: parsedIssue.error }
  }
  const title = parsedIssue.title ?? ''
  const content = parsedIssue.content ?? title

  if (!title) {
    return {
      type: 'text',
      value:
        'Decree usage:\nduckhive decree <title> | <content>\nREPL: /decree <title> | <content>\nExample: duckhive decree Secure Mode | Agents SHALL ask before destructive commands',
    }
  }

  const result = await hive.issueDecree(title, content)
  if (result.success) return { type: 'text', value: `Decree enacted: "${title}"` }
  return { type: 'text', value: formatHiveOfflineError(result.error) }
}
