import type { ToolUseContext } from './Tool.js'
import { spawnTeammate } from './tools/shared/spawnMultiAgent.js'

type SessionsSpawnOptions = {
  label?: string
  mode?: string
  runtime?: string
  task?: string
  context: ToolUseContext
}

/**
 * Spawn a subagent teammate for tasks like deep workspace analysis.
 *
 * This wires the legacy sessions_spawn API to the modern team infrastructure
 * (spawnTeammate / InProcessTeammateTask) so that subagents actually run
 * as proper teammates rather than falling back to a stub response.
 */
export async function sessions_spawn(
  options: SessionsSpawnOptions,
): Promise<string> {
  const task = options.task?.trim()
  if (!task) {
    return '## Deep Analysis\nNo subagent task was provided.'
  }

  // Derive a teammate name from the label, sanitizing for use as agentId
  const label = options.label ?? 'subagent'
  const teammateName = label.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) || 'subagent'

  try {
    const result = await spawnTeammate(
      {
        name: teammateName,
        prompt: task,
        team_name: 'duckhive-sessions',
        plan_mode_required: false,
      },
      options.context,
    )

    // The teammate is now running asynchronously. Return a status that
    // informs the leader agent the teammate was spawned successfully.
    return [
      `## Deep Analysis`,
      `Subagent teammate **${result.data.name}** spawned successfully.`,
      `Agent ID: \`${result.data.agent_id}\``,
      `Team: ${result.data.team_name ?? 'duckhive-sessions'}`,
      `Model: ${result.data.model ?? 'default'}`,
      '',
      `The teammate is processing the requested task. Results will appear in the team conversation.`,
    ].join('\n')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [
      `## Deep Analysis`,
      `Failed to spawn subagent teammate: ${message}`,
      `Requested task: ${task}`,
    ].join('\n')
  }
}
