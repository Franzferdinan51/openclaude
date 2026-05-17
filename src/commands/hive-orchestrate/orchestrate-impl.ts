/**
 * /orchestrate command implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getHiveBridge } from '../../services/hive-bridge/index.js'
import type { DeliberationMode, TeamTemplate } from '../../services/hive-bridge/hive-types.js'
import { createHybridOrchestrator } from '../../orchestrator/hybrid/index.js'

const orchestrator = createHybridOrchestrator()

function splitCommandArgs(args: string): string[] {
  return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg => arg.replace(/^["']|["']$/g, '')) ?? []
}

export const call: LocalCommandCall = async (args: string) => {
  const hive = getHiveBridge()
  const parsedArgs = splitCommandArgs(args)
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

  const availableModes = await hive.getModes()
  const defaultMode = availableModes.includes('deliberation')
    ? 'deliberation'
    : availableModes.includes('balanced')
      ? 'balanced'
      : (availableModes[0] ?? 'balanced')

  const task = positional.join(' ').trim()
  const councilMode = (flags.mode as DeliberationMode) ?? defaultMode
  const teamTemplate = flags.team as TeamTemplate | undefined
  const forceCouncil = flags.council === true
  const dryRun = flags['dry-run'] === true || flags.dry === true

  if (!task) {
    return {
      type: 'text',
      value: `Orchestrate Command
${'-'.repeat(50)}
Usage: /orchestrate <complex task>
Flags:
  --council           Force AI Council consultation
  --mode=<mode>       Deliberation mode
  --team=<type>       Use team template
  --dry-run           Show plan without executing

Example: /orchestrate Build a REST API --council --team=code`,
    }
  }

  const healthy = await hive.isHealthy()
  const ctx = await hive.getContext()

  // Use hybrid orchestrator for analysis
  const routing = orchestrator.analyze(task, [], [])
  const complexity = routing.analysis.complexity
  const needsCouncil = complexity >= 4 || forceCouncil || routing.analysis.needsCouncil

  const lines: string[] = []
  lines.push(
    `Orchestration ${dryRun ? 'Plan' : 'Execution'}
${'-'.repeat(50)}
Task: ${task}

Complexity Assessment:
  Complexity: ${complexity}/10 (${routing.analysis.category})
  Council warranted: ${needsCouncil ? `YES (${councilMode})` : 'NO'}
  Team spawn: ${routing.analysis.category === 'critical' ? 'YES (swarm)' : teamTemplate ? `YES (${teamTemplate})` : 'OPTIONAL'}`,
  )

  if (healthy) {
    lines.push(
      `
Hive Nation: Online
  Councilors: ${ctx.councilorCount}
  Active decrees: ${ctx.recentDecrees?.length ?? 0}
  Active teams: ${ctx.activeTeams?.length ?? 0}`,
    )
  } else {
    lines.push('\nHive Nation: OFFLINE (council/teams disabled)')
  }

  if (dryRun) {
    lines.push('\nExecution Plan:')
    for (const step of routing.executionPlan) {
      lines.push(`  -> ${step}`)
    }
    return { type: 'text', value: lines.join('\n') }
  }

  const execResult = await orchestrator.execute(task, [], [], undefined, {
    councilMode,
  })

  lines.push('\nExecution Results:')
  lines.push(`  Status: ${execResult.status}`)
  lines.push(`  Council triggered: ${execResult.councilTriggered ? 'YES' : 'NO'}`)
  if (execResult.councilSessionId) {
    lines.push(`    Session: ${execResult.councilSessionId}`)
  }
  lines.push(`  Team spawned: ${execResult.teamSpawned ? 'YES' : 'NO'}`)
  if (execResult.teamId) {
    lines.push(`    Team: ${execResult.teamId}`)
  }
  if (execResult.checkpointId) {
    lines.push(`  Checkpoint: ${execResult.checkpointId}`)
  }

  if (execResult.steps.length > 0) {
    lines.push('\nSteps executed:')
    for (const step of execResult.steps) {
      const icon = step.status === 'completed' ? 'OK' : step.status === 'failed' ? 'FAIL' : 'WAIT'
      lines.push(`  ${icon} ${step.step}: ${step.output ?? step.error ?? 'pending'}`)
    }
  }

  return { type: 'text', value: lines.join('\n') }
}
