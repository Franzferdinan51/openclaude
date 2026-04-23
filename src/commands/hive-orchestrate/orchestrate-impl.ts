/**
 * /orchestrate command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/hive-bridge.js'
import type { DeliberationMode, TeamTemplate } from '../../services/hive-bridge/hive-types.js'
import { createHybridOrchestrator } from '../../orchestrator/hybrid/index.js'

const orchestrator = createHybridOrchestrator()

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
  const dryRun = flags['dry-run'] === true || flags.dry === true

  if (!task) {
    const modes = await hive.getModes()
    return { type: 'text', value: `🎯 Orchestrate Command\n${'━'.repeat(50)}\nUsage: /orchestrate <complex task>\nFlags:\n  --council           Force AI Council consultation\n  --mode=<mode>       Deliberation mode\n  --team=<type>       Use team template\n  --dry-run           Show plan without executing\n\nExample: /orchestrate Build a REST API --council --team=code` }
  }

  const healthy = await hive.isHealthy()
  const ctx = await hive.getContext()

  // Use hybrid orchestrator for analysis
  const routing = orchestrator.analyze(task, [], [])
  const complexity = routing.analysis.complexity
  const needsCouncil = complexity >= 4 || forceCouncil || routing.analysis.needsCouncil

  const lines: string[] = []
  lines.push(`🎯 Orchestration ${dryRun ? 'Plan' : 'Execution'}\n${'━'.repeat(50)}\n📋 Task: ${task}\n\n🔍 Complexity Assessment:\n  Complexity: ${complexity}/10 (${routing.analysis.category})\n  Council warranted: ${needsCouncil ? 'YES' : 'NO'}\n  Team spawn: ${routing.analysis.category === 'critical' ? 'YES (swarm)' : teamTemplate ? `YES (${teamTemplate})` : 'OPTIONAL'}`)

  if (healthy) {
    lines.push(`\n🏛️ Hive Nation: ✅ Online\n  Councilors: ${ctx.councilorCount}\n  Active decrees: ${ctx.recentDecrees?.length ?? 0}\n  Active teams: ${ctx.activeTeams?.length ?? 0}`)
  } else {
    lines.push(`\n⚠️ Hive Nation: OFFLINE (council/teams disabled)`)
  }

  // DRY RUN - just show plan
  if (dryRun) {
    lines.push(`\n📊 Execution Plan:`)
    for (const step of routing.executionPlan) {
      lines.push(`  → ${step}`)
    }
    return { type: 'text', value: lines.join('\n') }
  }

  // ACTUAL EXECUTION
  const execResult = await orchestrator.execute(task, [], [])

  lines.push(`\n📊 Execution Results:`)
  lines.push(`  Status: ${execResult.status}`)
  lines.push(`  Council triggered: ${execResult.councilTriggered ? '✅ YES' : '❌ NO'}`)
  if (execResult.councilSessionId) {
    lines.push(`    Session: ${execResult.councilSessionId}`)
  }
  lines.push(`  Team spawned: ${execResult.teamSpawned ? '✅ YES' : '❌ NO'}`)
  if (execResult.teamId) {
    lines.push(`    Team: ${execResult.teamId}`)
  }
  if (execResult.checkpointId) {
    lines.push(`  Checkpoint: ${execResult.checkpointId}`)
  }

  if (execResult.steps.length > 0) {
    lines.push(`\n📝 Steps executed:`)
    for (const step of execResult.steps) {
      const icon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳'
      lines.push(`  ${icon} ${step.step}: ${step.output ?? step.error ?? 'pending'}`)
    }
  }

  return { type: 'text', value: lines.join('\n') }
}
