import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

type GoalRecord = {
  id: string
  sessionId?: string
  status?: string
  steps: Array<{ description: string }>
}

let configStore: Record<string, unknown>
let sessionId = 'session-current'

async function importFreshGoalCommand() {
  return (await import(`./goal.ts?goal-test=${Date.now()}-${Math.random()}`))
    .default
}

function getStoredGoals(): GoalRecord[] {
  return ((configStore['duckhive.goals'] as GoalRecord[]) ?? [])
}

describe('/goal command', () => {
  beforeEach(() => {
    configStore = { 'duckhive.goals': [] }
    sessionId = 'session-current'
    mock.module('../../utils/config.js', () => ({
      getGlobalConfig: () => configStore,
      saveGlobalConfig: (
        updater: (current: Record<string, unknown>) => Record<string, unknown>,
      ) => {
        configStore = updater(configStore)
      },
    }))
    mock.module('../../bootstrap/state.js', () => ({
      getSessionId: () => sessionId,
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test('step add without a goal id uses the single active goal', async () => {
    const goalCommand = await importFreshGoalCommand()
    await goalCommand(['create', 'Ship', 'the', 'release'])

    const result = await goalCommand(['step', 'add', 'Write', 'release', 'notes'])

    expect(result).toContain('Step added to goal.')
    const goals = getStoredGoals()
    expect(goals).toHaveLength(1)
    expect(goals[0]?.steps).toHaveLength(1)
    expect(goals[0]?.steps[0]?.description).toBe('Write release notes')
  })

  test('step add without a goal id errors when multiple active goals exist and none is attached to this session', async () => {
    const goalCommand = await importFreshGoalCommand()
    await goalCommand(['create', 'Goal', 'one'])
    sessionId = 'session-other'
    await goalCommand(['create', 'Goal', 'two'])
    sessionId = 'session-third'

    const result = await goalCommand(['step', 'add', 'Investigate', 'bug'])

    expect(result).toContain('Multiple active goals found.')
  })

  test('status rejects ambiguous partial goal ids', async () => {
    const goalCommand = await importFreshGoalCommand()
    await goalCommand(['create', 'Goal', 'one'])
    await goalCommand(['create', 'Goal', 'two'])

    const result = await goalCommand(['status', 'goal_'])

    expect(result).toContain('Goal reference is ambiguous: goal_')
    expect(result).toContain('Matches:')
  })

  test('bare status prefers the single active goal detail view', async () => {
    const goalCommand = await importFreshGoalCommand()
    await goalCommand(['create', 'Improve', 'coverage'])

    const result = await goalCommand(['status'])

    expect(result).toContain('Improve coverage')
    expect(result).not.toContain('Goal Status Summary')
  })

  test('pause and resume default to the single active goal', async () => {
    const goalCommand = await importFreshGoalCommand()
    await goalCommand(['create', 'Ship', 'release'])

    const paused = await goalCommand(['pause'])
    expect(paused).toContain('Goal paused.')

    const resumed = await goalCommand(['resume'])
    expect(resumed).toContain('Goal resumed!')
  })

  test('create attaches the current session id to the new goal', async () => {
    const goalCommand = await importFreshGoalCommand()

    const result = await goalCommand(['create', 'Integrate', 'goal', 'workflow'])

    expect(result).toContain('Session: session-current')
    expect(getStoredGoals()[0]?.sessionId).toBe('session-current')
  })

  test('status prefers the goal attached to the current session', async () => {
    const goalCommand = await importFreshGoalCommand()

    await goalCommand(['create', 'Session', 'goal'])
    sessionId = 'session-other'
    await goalCommand(['create', 'Other', 'goal'])
    sessionId = 'session-current'

    const result = await goalCommand(['status'])

    expect(result).toContain('Session goal')
    expect(result).not.toContain('Other goal')
  })

  test('step add without an id prefers the current session goal', async () => {
    const goalCommand = await importFreshGoalCommand()

    await goalCommand(['create', 'Current', 'goal'])
    sessionId = 'session-other'
    await goalCommand(['create', 'Other', 'goal'])
    sessionId = 'session-current'

    const result = await goalCommand(['step', 'add', 'Implement', 'the', 'feature'])

    expect(result).toContain('Step added to goal.')
    expect(getStoredGoals().find(goal => goal.sessionId === 'session-current')?.steps[0]?.description).toBe(
      'Implement the feature',
    )
    expect(getStoredGoals().find(goal => goal.sessionId === 'session-other')?.steps).toHaveLength(0)
  })

  test('attach uses the real current session id instead of a synthetic id', async () => {
    const goalCommand = await importFreshGoalCommand()
    await goalCommand(['create', 'First', 'goal'])

    sessionId = 'session-next'
    const result = await goalCommand(['attach', 'goal_'])

    expect(result).toContain('Session: session-next')
    expect(getStoredGoals()[0]?.sessionId).toBe('session-next')
  })

  test('clear defaults to the single active goal', async () => {
    const goalCommand = await importFreshGoalCommand()
    await goalCommand(['create', 'Remove', 'temp', 'goal'])

    const result = await goalCommand(['clear'])

    expect(result).toContain('has been removed.')
    expect(getStoredGoals()).toHaveLength(0)
  })

  test('pause without an id errors clearly when multiple active goals exist and none is attached to this session', async () => {
    const goalCommand = await importFreshGoalCommand()
    await goalCommand(['create', 'Goal', 'one'])
    sessionId = 'session-other'
    await goalCommand(['create', 'Goal', 'two'])
    sessionId = 'session-third'

    const result = await goalCommand(['pause'])

    expect(result).toContain('Multiple active goals found.')
  })
})
