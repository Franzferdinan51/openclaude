/**
 * DuckHive /goal Command - Persisted Workflow Goals
 * Inspired by Codex /goal (r0.128.0)
 *
 * Features:
 * - /goal create <description> - Create a new persisted goal
 * - /goal list - List all goals with status
 * - /goal status [id] - Show detailed status of a goal
 * - /goal pause [id] - Pause a running goal
 * - /goal resume [id] - Resume a paused goal
 * - /goal complete [id] - Mark a goal as completed
 * - /goal clear [id] - Remove a goal
 * - /goal attach [id] - Attach current conversation to a goal
 */

import { bold, italic } from '../../components/styles.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'

// Goal states
export type GoalStatus = 'active' | 'paused' | 'completed' | 'failed'

export interface GoalStep {
  id: string
  description: string
  status: GoalStatus
  createdAt: string
  completedAt?: string
  result?: string
  error?: string
}

export interface Goal {
  id: string
  title: string
  description: string
  status: GoalStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
  steps: GoalStep[]
  currentStepId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

// Storage key for goals
const GOALS_STORAGE_KEY = 'duckhive.goals'

function generateId(): string {
  return `goal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function getGoals(): Goal[] {
  try {
    const config = getGlobalConfig()
    return (config as Record<string, unknown>)[GOALS_STORAGE_KEY] as Goal[] || []
  } catch {
    return []
  }
}

async function saveGoals(goals: Goal[]): Promise<void> {
  const config = getGlobalConfig()
  ;(config as Record<string, unknown>)[GOALS_STORAGE_KEY] = goals
  await saveGlobalConfig(config)
}

function formatGoal(goal: Goal, detailed = false): string {
  const statusIcon: Record<GoalStatus, string> = {
    active: '🔄',
    paused: '⏸️',
    completed: '✅',
    failed: '❌',
  }

  let output = `${statusIcon[goal.status]} **${bold(goal.title)}** \`${goal.id}\`\n`
  output += `   Status: ${goal.status.toUpperCase()}\n`
  output += `   Created: ${new Date(goal.createdAt).toLocaleString()}\n`

  if (goal.status === 'paused' && goal.currentStepId) {
    output += `   Current Step: ${goal.currentStepId}\n`
  }

  if (detailed) {
    output += `\n   ${italic(goal.description)}\n`
    if (goal.steps.length > 0) {
      output += `\n   Steps (${goal.steps.length}):\n`
      for (const step of goal.steps) {
        const stepIcon: Record<GoalStatus, string> = {
          active: '→',
          paused: '⏸',
          completed: '✓',
          failed: '✗',
        }
        output += `   ${stepIcon[step.status]} [${step.id}] ${step.description}\n`
      }
    }
  }

  return output
}

async function createGoal(args: string[]): Promise<string> {
  if (args.length === 0) {
    return `Usage: /goal create <description>\nExample: /goal create Build user authentication system`
  }

  const description = args.join(' ')
  const id = generateId()
  const now = new Date().toISOString()

  const goal: Goal = {
    id,
    title: description.substring(0, 60) + (description.length > 60 ? '...' : ''),
    description,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    steps: [],
    currentStepId: undefined,
  }

  const goals = getGoals()
  goals.unshift(goal)
  await saveGoals(goals)

  return `Goal created successfully!\n\n${formatGoal(goal, true)}`
}

async function listGoals(args: string[]): Promise<string> {
  const goals = getGoals()
  const filter = args[0]?.toLowerCase()

  let filtered = goals
  if (filter === 'active') {
    filtered = goals.filter((g) => g.status === 'active')
  } else if (filter === 'completed') {
    filtered = goals.filter((g) => g.status === 'completed')
  } else if (filter === 'paused') {
    filtered = goals.filter((g) => g.status === 'paused')
  }

  if (filtered.length === 0) {
    return 'No goals found.'
  }

  let output = `${bold('DuckHive Goals')}\n`
  output += `Showing ${filtered.length} of ${goals.length} total goals\n\n`

  for (const goal of filtered.slice(0, 10)) {
    output += formatGoal(goal) + '\n'
  }

  if (filtered.length > 10) {
    output += `\n... and ${filtered.length - 10} more. Use /goal list all to see all.`
  }

  return output
}

async function goalStatus(args: string[]): Promise<string> {
  if (args.length === 0) {
    const goals = getGoals()
    const active = goals.filter((g) => g.status === 'active')
    const paused = goals.filter((g) => g.status === 'paused')

    let output = `${bold('Goal Status Summary')}\n\n`
    output += `Active: ${active.length} | Paused: ${paused.length} | Total: ${goals.length}\n\n`

    if (active.length > 0) {
      output += `${bold('Active Goals:')}\n`
      for (const goal of active.slice(0, 5)) {
        output += formatGoal(goal) + '\n'
      }
    }

    return output
  }

  const goalId = args[0]
  const goals = getGoals()
  const goal = goals.find((g) => g.id === goalId || g.id.includes(goalId))

  if (!goal) {
    return `Goal not found: ${goalId}`
  }

  return formatGoal(goal, true)
}

async function pauseGoal(args: string[]): Promise<string> {
  if (args.length === 0) {
    return `Usage: /goal pause <goal-id>\nTip: Use /goal list to find goal IDs`
  }

  const goalId = args[0]
  const goals = getGoals()
  const goal = goals.find((g) => g.id === goalId || g.id.includes(goalId))

  if (!goal) return `Goal not found: ${goalId}`
  if (goal.status !== 'active') return `Goal is not active (current status: ${goal.status})`

  goal.status = 'paused'
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Goal paused.\n\n${formatGoal(goal)}`
}

async function resumeGoal(args: string[]): Promise<string> {
  if (args.length === 0) {
    return `Usage: /goal resume <goal-id>\nTip: Use /goal list paused to find paused goals`
  }

  const goalId = args[0]
  const goals = getGoals()
  const goal = goals.find((g) => g.id === goalId || g.id.includes(goalId))

  if (!goal) return `Goal not found: ${goalId}`
  if (goal.status !== 'paused') return `Goal is not paused (current status: ${goal.status})`

  goal.status = 'active'
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Goal resumed!\n\n${formatGoal(goal)}`
}

async function completeGoal(args: string[]): Promise<string> {
  if (args.length === 0) {
    return 'Usage: /goal complete <goal-id>'
  }

  const goalId = args[0]
  const goals = getGoals()
  const goal = goals.find((g) => g.id === goalId || g.id.includes(goalId))

  if (!goal) return `Goal not found: ${goalId}`

  goal.status = 'completed'
  goal.completedAt = new Date().toISOString()
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Goal completed! 🎉\n\n${formatGoal(goal)}`
}

async function addStep(args: string[], goalId?: string): Promise<string> {
  const targetGoalId = goalId || args[0]
  const stepDesc = args.slice(goalId ? 1 : 1).join(' ')

  if (!targetGoalId || !stepDesc) {
    return `Usage: /goal step add <goal-id> <step-description>\n   or: /goal step add <step-description> (uses active goal)`
  }

  const goals = getGoals()
  const goal = goals.find((g) => g.id === targetGoalId || g.id.includes(targetGoalId))

  if (!goal) return `Goal not found: ${targetGoalId}`

  const step: GoalStep = {
    id: `step_${Date.now()}`,
    description: stepDesc,
    status: 'active',
    createdAt: new Date().toISOString(),
  }

  goal.steps.push(step)
  goal.currentStepId = step.id
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Step added to goal.\n\n${formatGoal(goal, true)}`
}

async function clearGoal(args: string[]): Promise<string> {
  if (args.length === 0) {
    return `Usage: /goal clear <goal-id>\nWarning: This cannot be undone!`
  }

  const goalId = args[0]
  const goals = getGoals()
  const index = goals.findIndex((g) => g.id === goalId || g.id.includes(goalId))

  if (index === -1) return `Goal not found: ${goalId}`

  const removed = goals.splice(index, 1)[0]
  await saveGoals(goals)

  return `Goal "${removed.title}" has been removed.`
}

async function attachToGoal(args: string[]): Promise<string> {
  if (args.length === 0) return 'Usage: /goal attach <goal-id>'

  const goalId = args[0]
  const goals = getGoals()
  const goal = goals.find((g) => g.id === goalId || g.id.includes(goalId))

  if (!goal) return `Goal not found: ${goalId}`

  goal.sessionId = `session_${Date.now()}`
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Current session attached to goal.\n\n${formatGoal(goal)}`
}

function showHelp(): string {
  return `
${bold('DuckHive /goal - Persisted Workflow Goals')}

${bold('Commands:')}
  /goal create <description>   Create a new goal
  /goal list [filter]          List goals (filter: active|paused|completed)
  /goal status [id]            Show goal status or summary
  /goal pause [id]             Pause a goal
  /goal resume [id]            Resume a paused goal
  /goal complete [id]          Mark goal as completed
  /goal clear [id]             Delete a goal
  /goal attach [id]            Attach current session to goal
  /goal step add [id] <desc>   Add a step to a goal

${bold('Examples:')}
  /goal create Build the user authentication system
  /goal list active
  /goal status goal_123
  /goal pause goal_123
  /goal resume goal_123
  /goal complete goal_123

${italic('Goals persist across sessions and can be resumed later.')}
`.trim()
}

async function handleStepCommand(args: string[]): Promise<string> {
  const action = args[0]?.toLowerCase()

  switch (action) {
    case 'add':
    case 'create':
      return addStep(args.slice(1))
    default:
      return `Unknown step command: ${action}\nUsage: /goal step add <goal-id> <description>`
  }
}

export default async function goalCommand(args: string[]): Promise<string> {
  const subcommand = args[0]?.toLowerCase()

  switch (subcommand) {
    case 'create':
    case 'new':
      return createGoal(args.slice(1))

    case 'list':
    case 'ls':
      return listGoals(args.slice(1))

    case 'status':
    case 'stat':
      return goalStatus(args.slice(1))

    case 'pause':
    case 'stop':
      return pauseGoal(args.slice(1))

    case 'resume':
    case 'continue':
      return resumeGoal(args.slice(1))

    case 'complete':
    case 'done':
    case 'finish':
      return completeGoal(args.slice(1))

    case 'clear':
    case 'delete':
    case 'remove':
      return clearGoal(args.slice(1))

    case 'attach':
    case 'link':
      return attachToGoal(args.slice(1))

    case 'step':
      return handleStepCommand(args.slice(1))

    case 'help':
    case undefined:
      return showHelp()

    default:
      if (subcommand.startsWith('goal_')) {
        return goalStatus(args)
      }
      return createGoal(args)
  }
}
