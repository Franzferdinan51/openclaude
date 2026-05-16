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

export const call: LocalCommandCall = async (args: string) => {
  const hive = getDecreeDeps().getHiveBridge()
  const rest = args.trim()

  if (!rest || rest === 'list') {
    const decrees = await hive.getActiveDecrees()
    if (decrees.length === 0) return { type: 'text', value: 'No active decrees.' }

    return {
      type: 'text',
      value: `Active decrees:\n${decrees
        .map(decree => `  [${decree.priority}] ${decree.title}: ${decree.content.substring(0, 60)}`)
        .join('\n')}`,
    }
  }

  const parts = rest.split('|').map(part => part.trim())
  const title = parts[0] ?? ''
  const content = parts[1] ?? title

  if (!title) {
    return {
      type: 'text',
      value: 'Decree usage:\n/decree <title> | <content>\nExample: /decree Secure Mode | Agents SHALL ask before destructive commands',
    }
  }

  const result = await hive.issueDecree(title, content)
  if (result.success) return { type: 'text', value: `Decree enacted: "${title}"` }
  return { type: 'text', value: `Failed: ${result.error ?? 'Hive Nation offline'}` }
}
