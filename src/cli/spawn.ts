import { getAgentRunStore } from '../agent-runs/index.js'
import { parseSpawnArgs } from '../commands/spawn/parseSpawnArgs.js'

function usage(error?: string): string {
  const lines = [
    'DuckHive spawn - Hermes-style subagent queue',
    '',
    'Usage:',
    '  duckhive spawn <task description>',
    '  duckhive spawn spawn <agent-type> <task description> [--model <model>]',
    '  duckhive spawn <task description> --label <name>',
    '  duckhive subagent <task description>',
    '',
    'REPL:',
    '  /spawn <task description>',
    '  /subagent spawn coding "Implement a REST API"',
    '',
    'Terminal spawn registers a queued AgentRun that is visible to ps/logs/attach/kill, Telegram, WebUI, and /run.',
    'Use the interactive REPL /spawn command when you need immediate in-session teammate execution.',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

function titleFromTask(task: string): string {
  const compact = task.replace(/\s+/g, ' ').trim()
  if (compact.length <= 80) return compact
  return `${compact.slice(0, 77)}...`
}

export async function spawnHandler(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${usage()}\n`)
    return
  }

  const parsed = parseSpawnArgs(args)
  if (!parsed.task) {
    process.stderr.write(`${usage('spawn requires a task description.')}\n`)
    process.exitCode = 1
    return
  }

  const run = getAgentRunStore().createRun({
    title: titleFromTask(parsed.task),
    description: parsed.task,
    selectedAgent: parsed.label ?? parsed.agentType ?? 'spawned-agent',
    provider: parsed.model ? 'requested' : undefined,
    model: parsed.model,
    status: 'queued',
    runtimeHarness: 'builtin',
    channelSource: { type: 'headless' },
    progress: {
      summary: parsed.agentType
        ? `Queued terminal subagent request for ${parsed.agentType}.`
        : 'Queued terminal subagent request.',
    },
  })

  const details = [
    `Subagent AgentRun queued: ${run.id}`,
    `Task: ${parsed.task}`,
    `Agent: ${run.selectedAgent ?? 'spawned-agent'}`,
  ]
  if (parsed.model) details.push(`Model: ${parsed.model}`)
  details.push('', `Inspect: duckhive attach ${run.id}`, `Logs: duckhive logs ${run.id}`, `Cancel: duckhive kill ${run.id}`)
  process.stdout.write(`${details.join('\n')}\n`)
}
