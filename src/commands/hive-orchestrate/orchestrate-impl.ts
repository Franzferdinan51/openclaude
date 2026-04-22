/**
 * /orchestrate command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/hive-bridge.js'
import type { DeliberationMode, TeamTemplate } from '../../services/hive-bridge/hive-types.js'

export const call: LocalCommandCall = async (args: string) => {
  const hive = getHiveBridge()
  const parsedArgs = args.trim().split(/\s+/)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (const arg of parsedArgs) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      flags[k] = v ?? true
    } else {
      positional.push(arg)
    }
  }

  const task = positional.join(' ').trim()
  const councilMode = (flags.mode as DeliberationMode) ?? 'balanced'
  const teamTemplate = flags.team as TeamTemplate | undefined
  const forceCouncil = flags.council === true

  if (!task) {
    const modes = await hive.getModes()
    return { type: 'text', value: `🎯 Orchestrate Command\n${'━'.repeat(50)}\nUsage: /orchestrate <complex task>\nFlags:\n  --council           Force AI Council consultation\n  --mode=<mode>       Deliberation mode\n  --team=<type>       Use team template\n\nExample: /orchestrate Build a REST API --council --team=code` }
  }

  const healthy = await hive.isHealthy()
  const ctx = await hive.getContext()

  const wordCount = task.split(/\s+/).length
  const hasKeywords = /\b(architecture|design|refactor|security|migrate|build|distributed|microservices?)\b/i.test(task)
  const complexity = hasKeywords ? (wordCount > 20 ? 8 : 6) : wordCount > 10 ? 4 : 2

  const lines: string[] = []
  lines.push(`🎯 Orchestration Plan\n${'━'.repeat(50)}\n📋 Task: ${task}\n\n🔍 Complexity Assessment:\n  Complexity: ${complexity}/10\n  Council warranted: ${complexity >= 7 || forceCouncil ? 'YES' : 'NO'}\n  Team spawn: ${teamTemplate ? `YES (${teamTemplate})` : 'OPTIONAL'}`)

  if (healthy) {
    lines.push(`\n🏛️ Hive Nation: ✅ Online\n  Councilors: ${ctx.councilorCount}\n  Active decrees: ${ctx.recentDecrees?.length ?? 0}\n  Active teams: ${ctx.activeTeams?.length ?? 0}`)
  } else {
    lines.push(`\n⚠️ Hive Nation: OFFLINE`)
  }

  lines.push(`\n📊 Recommended Approach:`)
  if (complexity >= 7 || forceCouncil) {
    lines.push(`  1. 🧠 Consult AI Council (${councilMode} mode)\n  2. 📜 Issue Senate decree if needed\n  3. 👥 Spawn ${teamTemplate ?? 'research'} team\n  4. 🔄 Execute with council oversight`)
  } else if (complexity >= 4) {
    lines.push(`  1. 🔍 Quick analysis\n  2. 👥 Optional: spawn team\n  3. 🚀 Execute`)
  } else {
    lines.push(`  1. ⚡ Fast path — direct execution`)
  }

  return { type: 'text', value: lines.join('\n') }
}
