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
 * - /goal fail [id] - Mark a goal as failed
 * - /goal clear [id] - Remove a goal
 * - /goal attach [id] - Attach current conversation to a goal
 */

import { bold, italic } from '../../components/styles.js'
import { getSessionId } from '../../bootstrap/state.js'
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

function getCurrentSessionId(): string | undefined {
  try {
    return getSessionId()
  } catch {
    return undefined
  }
}

function findGoalByReference(
  goals: Goal[],
  goalRef: string,
): { goal?: Goal; error?: string } {
  const exactMatch = goals.find((goal) => goal.id === goalRef)
  if (exactMatch) {
    return { goal: exactMatch }
  }

  const partialMatches = goals.filter((goal) => goal.id.includes(goalRef))
  if (partialMatches.length === 0) {
    return { error: `Goal not found: ${goalRef}` }
  }

  if (partialMatches.length > 1) {
    return {
      error:
        `Goal reference is ambiguous: ${goalRef}\n` +
        `Matches: ${partialMatches.map((goal) => goal.id).join(', ')}`,
    }
  }

  return { goal: partialMatches[0] }
}

function getSingleActiveGoal(goals: Goal[]): { goal?: Goal; error?: string } {
  return getSingleGoalByStatus(goals, 'active', {
    missing:
      'No active goal found. Create a goal first or specify a goal ID explicitly.',
    ambiguous:
      'Multiple active goals found. Specify a goal ID explicitly with `/goal step add <goal-id> <description>`.',
  })
}

function getCurrentSessionGoal(
  goals: Goal[],
  statuses?: GoalStatus[],
): { goal?: Goal; error?: string } {
  const sessionId = getCurrentSessionId()
  if (!sessionId) {
    return {}
  }

  const matches = goals.filter((goal) => {
    if (goal.sessionId !== sessionId) {
      return false
    }
    if (!statuses || statuses.length === 0) {
      return true
    }
    return statuses.includes(goal.status)
  })

  if (matches.length === 0) {
    return {}
  }

  if (matches.length > 1) {
    return {
      error:
        'Multiple goals are attached to this session. Specify a goal ID explicitly.',
    }
  }

  return { goal: matches[0] }
}

function getSingleGoalByStatus(
  goals: Goal[],
  status: GoalStatus,
  messages: { missing: string; ambiguous: string },
): { goal?: Goal; error?: string } {
  const matchingGoals = goals.filter((goal) => goal.status === status)
  if (matchingGoals.length === 0) {
    return {
      error: messages.missing,
    }
  }

  if (matchingGoals.length > 1) {
    return {
      error: messages.ambiguous,
    }
  }

  return { goal: matchingGoals[0] }
}

function getSingleGoalByStatuses(
  goals: Goal[],
  statuses: GoalStatus[],
  messages: { missing: string; ambiguous: string },
): { goal?: Goal; error?: string } {
  const matchingGoals = goals.filter((goal) => statuses.includes(goal.status))
  if (matchingGoals.length === 0) {
    return { error: messages.missing }
  }

  if (matchingGoals.length > 1) {
    return { error: messages.ambiguous }
  }

  return { goal: matchingGoals[0] }
}

function resolveGoalTarget(
  goals: Goal[],
  goalRef?: string,
  statuses: GoalStatus[] = ['active'],
): { goal?: Goal; error?: string } {
  if (goalRef?.trim()) {
    return findGoalByReference(goals, goalRef)
  }

  const currentSessionGoal = getCurrentSessionGoal(goals, statuses)
  if (currentSessionGoal.goal || currentSessionGoal.error) {
    return currentSessionGoal
  }

  if (statuses.length === 1 && statuses[0] === 'active') {
    return getSingleActiveGoal(goals)
  }

  return getSingleGoalByStatuses(goals, statuses, {
    missing:
      'No matching goal found. Create a goal first or specify a goal ID explicitly.',
    ambiguous: 'Multiple matching goals found. Specify a goal ID explicitly.',
  })
}

function attachCurrentSessionToGoal(goals: Goal[], targetGoal: Goal): void {
  const sessionId = getCurrentSessionId()
  if (!sessionId) {
    return
  }

  for (const goal of goals) {
    if (
      goal !== targetGoal &&
      goal.sessionId === sessionId &&
      (goal.status === 'active' || goal.status === 'paused')
    ) {
      goal.sessionId = undefined
    }
  }

  targetGoal.sessionId = sessionId
}

function getCurrentStep(goal: Goal): GoalStep | undefined {
  if (!goal.currentStepId) return undefined
  return goal.steps.find(step => step.id === goal.currentStepId)
}

async function saveGoals(goals: Goal[]): Promise<void> {
  saveGlobalConfig(config => ({
    ...config,
    [GOALS_STORAGE_KEY]: goals,
  }))
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

  if (goal.sessionId) {
    output += `   Attached Session: ${goal.sessionId}\n`
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
  attachCurrentSessionToGoal(goals, goal)
  await saveGoals(goals)

  return `Goal created successfully!\n\n${formatGoal(goal, true)}`
}

async function listGoals(args: string[]): Promise<string> {
  const goals = getGoals()
  const filter = args[0]?.toLowerCase()
  const showAll = filter === 'all'
  const validFilters = new Set(['all', 'active', 'paused', 'completed', 'failed'])

  if (filter && !validFilters.has(filter)) {
    return 'Unknown goal filter. Use one of: all, active, paused, completed, failed.'
  }

  let filtered = goals
  if (filter === 'active') {
    filtered = goals.filter((g) => g.status === 'active')
  } else if (filter === 'completed') {
    filtered = goals.filter((g) => g.status === 'completed')
  } else if (filter === 'paused') {
    filtered = goals.filter((g) => g.status === 'paused')
  } else if (filter === 'failed') {
    filtered = goals.filter((g) => g.status === 'failed')
  }

  if (filtered.length === 0) {
    return 'No goals found.'
  }

  const visibleGoals = showAll ? filtered : filtered.slice(0, 10)
  let output = `${bold('DuckHive Goals')}\n`
  output += `Showing ${visibleGoals.length} of ${goals.length} total goals\n\n`

  for (const goal of visibleGoals) {
    output += formatGoal(goal) + '\n'
  }

  if (!showAll && filtered.length > 10) {
    output += `\n... and ${filtered.length - 10} more. Use /goal list all to see all.`
  }

  return output
}

async function goalStatus(args: string[]): Promise<string> {
  const goals = getGoals()

  if (args.length === 0) {
    const currentSessionGoal = getCurrentSessionGoal(goals)
    if (currentSessionGoal.goal) {
      return formatGoal(currentSessionGoal.goal, true)
    }
    if (currentSessionGoal.error) {
      return currentSessionGoal.error
    }

    const activeGoal = getSingleActiveGoal(goals)
    if (activeGoal.goal) {
      return formatGoal(activeGoal.goal, true)
    }

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
  const { goal, error } = findGoalByReference(goals, goalId)

  if (!goal) {
    return error ?? `Goal not found: ${goalId}`
  }

  return formatGoal(goal, true)
}

async function pauseGoal(args: string[]): Promise<string> {
  const goals = getGoals()
  const { goal, error } = resolveGoalTarget(goals, args[0], ['active'])

  if (!goal) {
    return error ?? `Usage: /goal pause [goal-id]\nTip: Use /goal list to find goal IDs`
  }
  if (goal.status !== 'active') return `Goal is not active (current status: ${goal.status})`

  goal.status = 'paused'
  const currentStep = getCurrentStep(goal)
  if (currentStep?.status === 'active') {
    currentStep.status = 'paused'
  }
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Goal paused.\n\n${formatGoal(goal)}`
}

async function resumeGoal(args: string[]): Promise<string> {
  const goals = getGoals()
  const { goal, error } = resolveGoalTarget(goals, args[0], ['paused'])

  if (!goal) {
    return error ?? `Usage: /goal resume [goal-id]\nTip: Use /goal list paused to find paused goals`
  }
  if (goal.status !== 'paused') return `Goal is not paused (current status: ${goal.status})`

  goal.status = 'active'
  attachCurrentSessionToGoal(goals, goal)
  const currentStep = getCurrentStep(goal)
  if (currentStep?.status === 'paused') {
    currentStep.status = 'active'
  }
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Goal resumed!\n\n${formatGoal(goal)}`
}

async function completeGoal(args: string[]): Promise<string> {
  const goals = getGoals()
  const { goal, error } = resolveGoalTarget(goals, args[0], [
    'active',
    'paused',
  ])

  if (!goal) return error ?? 'Usage: /goal complete [goal-id]'

  goal.status = 'completed'
  const currentStep = getCurrentStep(goal)
  if (currentStep && currentStep.status !== 'completed') {
    currentStep.status = 'completed'
    currentStep.completedAt = new Date().toISOString()
  }
  goal.currentStepId = undefined
  goal.completedAt = new Date().toISOString()
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Goal completed! 🎉\n\n${formatGoal(goal)}`
}

async function failGoal(args: string[]): Promise<string> {
  const goals = getGoals()
  const { goal, error } = resolveGoalTarget(goals, args[0], [
    'active',
    'paused',
  ])

  if (!goal) return error ?? 'Usage: /goal fail [goal-id]'
  if (goal.status !== 'active' && goal.status !== 'paused') {
    return `Goal is not active or paused (current status: ${goal.status})`
  }

  goal.status = 'failed'
  const currentStep = getCurrentStep(goal)
  if (currentStep && currentStep.status !== 'completed') {
    currentStep.status = 'failed'
    currentStep.completedAt = new Date().toISOString()
  }
  goal.currentStepId = undefined
  goal.completedAt = new Date().toISOString()
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Goal marked failed.\n\n${formatGoal(goal)}`
}

async function addStep(args: string[], goalId?: string): Promise<string> {
  if (args.length === 0) {
    return `Usage: /goal step add <goal-id> <step-description>\n   or: /goal step add <step-description> (uses active goal)`
  }

  const goals = getGoals()
  let goal: Goal | undefined
  let stepDesc = ''

  if (goalId) {
    const resolved = findGoalByReference(goals, goalId)
    if (!resolved.goal) {
      return resolved.error ?? `Goal not found: ${goalId}`
    }
    goal = resolved.goal
    stepDesc = args.join(' ')
  } else {
    const firstArg = args[0]
    const resolvedById = firstArg ? findGoalByReference(goals, firstArg) : {}
    if (resolvedById.goal) {
      goal = resolvedById.goal
      stepDesc = args.slice(1).join(' ')
    } else if (
      firstArg &&
      (firstArg.startsWith('goal_') || resolvedById.error?.startsWith('Goal reference is ambiguous:'))
    ) {
      return resolvedById.error ?? `Goal not found: ${firstArg}`
    } else {
      const currentSessionGoal = getCurrentSessionGoal(goals, ['active'])
      if (currentSessionGoal.goal) {
        goal = currentSessionGoal.goal
        stepDesc = args.join(' ')
      } else if (currentSessionGoal.error) {
        return currentSessionGoal.error
      } else {
        const activeGoal = getSingleActiveGoal(goals)
        if (!activeGoal.goal) {
          return activeGoal.error ?? 'No active goal found.'
        }
        goal = activeGoal.goal
        stepDesc = args.join(' ')
      }
    }
  }

  if (!stepDesc.trim()) {
    return `Usage: /goal step add <goal-id> <step-description>\n   or: /goal step add <step-description> (uses active goal)`
  }

  if (goal.status !== 'active') {
    return `Cannot add a step to a ${goal.status} goal. Resume it first or target an active goal instead.`
  }

  const previousCurrentStep = getCurrentStep(goal)
  if (previousCurrentStep?.status === 'active') {
    previousCurrentStep.status = 'completed'
    previousCurrentStep.completedAt = new Date().toISOString()
  }

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
  const goals = getGoals()
  const { goal, error } = resolveGoalTarget(goals, args[0], [
    'active',
    'paused',
    'completed',
    'failed',
  ])
  if (!goal) {
    return error ?? `Usage: /goal clear [goal-id]\nWarning: This cannot be undone!`
  }
  const index = goals.indexOf(goal)

  const removed = goals.splice(index, 1)[0]
  await saveGoals(goals)

  return `Goal "${removed.title}" has been removed.`
}

async function attachToGoal(args: string[]): Promise<string> {
  const goals = getGoals()
  const { goal, error } = resolveGoalTarget(goals, args[0], [
    'active',
    'paused',
    'completed',
    'failed',
  ])

  if (!goal) return error ?? 'Usage: /goal attach [goal-id]'

  attachCurrentSessionToGoal(goals, goal)
  goal.updatedAt = new Date().toISOString()
  await saveGoals(goals)

  return `Current session attached to goal.\n\n${formatGoal(goal)}`
}

function showHelp(): string {
  return `
${bold('DuckHive /goal - Persisted Workflow Goals')}

${bold('Commands:')}
  /goal <description>          Create a new goal (Codex-style shorthand)
  /goal create <description>   Create a new goal
  /goal list [filter]          List goals (filter: all|active|paused|completed|failed)
  /goal status [id]            Show goal status or summary
  /goal pause [id]             Pause a goal
  /goal resume [id]            Resume a paused goal
  /goal complete [id]          Mark goal as completed
  /goal fail [id]              Mark goal as failed
  /goal clear [id]             Delete a goal
  /goal attach [id]            Attach current session to goal
  /goal step add [id] <desc>   Add a step to a goal

${bold('Examples:')}
  /goal Build the user authentication system
  /goal create Build the user authentication system
  /goal list active
  /goal status goal_123
  /goal pause goal_123
  /goal resume goal_123
  /goal complete goal_123
  /goal fail goal_123

${italic('Goals persist across sessions and can be resumed later.')}
`.trim()
}

async function handleStepCommand(args: string[]): Promise<string> {
  const action = args[0]?.toLowerCase()

  if (!action) {
    return 'Usage: /goal step add <goal-id> <description>\n   or: /goal step add <description> (uses active goal)'
  }

  switch (action) {
    case 'add':
    case 'create':
      return addStep(args.slice(1))
    default:
      return `Unknown step command: ${action}\nUsage: /goal step add <goal-id> <description>`
  }
}

export async function call(args: string): Promise<{ type: 'text'; value: string }> {
  return { type: 'text', value: await goalCommand(splitCommandArgs(args)) }
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

    case 'fail':
    case 'failed':
    case 'cancel':
      return failGoal(args.slice(1))

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
      return showHelp()

    case undefined:
      return goalStatus([])

    default:
      if (subcommand.startsWith('goal_')) {
        return goalStatus(args)
      }
      if (args.length === 1) {
        return `Unknown goal command: ${subcommand}\nUse /goal help to see supported commands.`
      }
      return createGoal(args)
  }
}

function splitCommandArgs(args: string): string[] {
  return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg => arg.replace(/^["']|["']$/g, '')) ?? []
}
