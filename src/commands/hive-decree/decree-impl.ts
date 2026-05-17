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
  return value.replace(/^["']|["']$/g, '').trim()
}

function formatHiveOfflineError(error?: string): string {
  return `Failed: ${error ?? 'Hive Nation offline'}\nStart the local runtime with \`bun run council:serve\` or point DuckHive at a running service with \`DUCKHIVE_COUNCIL_URL\`.`
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getDecreeDeps().getHiveBridge()
  const rest = args.trim()

  if (rest === 'help') {
    return {
      type: 'text',
      value: 'Decree command\n--------------------------------------------------\n/decree list                         - List active decrees\n/decree <title> | <content>          - Issue a binding decree\nExample: /decree Secure Mode | Agents SHALL ask before destructive commands',
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

  const parts = rest.split('|').map(part => part.trim())
  const title = trimOuterQuotes(parts[0] ?? '')
  const content = trimOuterQuotes(parts[1] ?? title)

  if (!title) {
    return {
      type: 'text',
      value: 'Decree usage:\n/decree <title> | <content>\nExample: /decree Secure Mode | Agents SHALL ask before destructive commands',
    }
  }

  const result = await hive.issueDecree(title, content)
  if (result.success) return { type: 'text', value: `Decree enacted: "${title}"` }
  return { type: 'text', value: formatHiveOfflineError(result.error) }
}
