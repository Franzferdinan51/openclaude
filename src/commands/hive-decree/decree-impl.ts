/**
 * /decree command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/hive-bridge.js'

export const call: LocalCommandCall = async (args: string) => {
  const hive = getHiveBridge()
  const rest = args.trim()

  if (!rest || rest === 'list') {
    const decrees = await hive.getActiveDecrees()
    if (decrees.length === 0) return { type: 'text', value: '📜 No active decrees.' }
    return { type: 'text', value: '📜 Active Decrees:\n' + decrees.map(d => `  [${d.priority}] ${d.title}: ${d.content.substring(0, 60)}`).join('\n') }
  }

  const parts = rest.split('|').map(s => s.trim())
  const title = parts[0] ?? ''
  const content = parts[1] ?? title

  if (!title) {
    return { type: 'text', value: '📜 Decree Usage:\n/decree <title> | <content>\nExample: /decree Secure Mode | Agents SHALL ask before destructive commands' }
  }

  const result = await hive.issueDecree(title, content)
  if (result.success) return { type: 'text', value: `✅ Decree enacted: "${title}"` }
  return { type: 'text', value: `❌ Failed: ${result.error ?? 'Hive Nation offline'}` }
}
