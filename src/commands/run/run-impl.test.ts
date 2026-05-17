import { afterEach, describe, expect, test } from 'bun:test'
import { createAgentRunStore } from '../../agent-runs/index.js'
import { call, setRunTestDeps } from './run-impl.js'

afterEach(() => {
  setRunTestDeps(null)
})

function makeStore() {
  const store = createAgentRunStore({
    persist: false,
    now: () => Date.UTC(2026, 4, 16, 12, 0, 0),
    idFactory: () => 'run_1',
    eventIdFactory: () => 'event_1',
  })
  return store
}

describe('/run command', () => {
  test('lists runs', async () => {
    const store = makeStore()
    store.createRun({ title: 'Review auth flow', status: 'running', selectedAgent: 'reviewer' })
    setRunTestDeps({ getAgentRunStore: () => store })

    const result = await call('list', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Agent Runs')
    expect(result.value).toContain('run_1 [running] Review auth flow')
  })

  test('shows run detail from bare run id input', async () => {
    const store = makeStore()
    store.createRun({
      title: 'Review auth flow',
      status: 'running',
      selectedAgent: 'reviewer',
      runtimeHarness: 'builtin',
      provider: 'minimax',
      model: 'MiniMax-M2.7',
      progress: { summary: 'Reading files' },
    })
    setRunTestDeps({ getAgentRunStore: () => store })

    const result = await call('run_1', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Run: run_1')
    expect(result.value).toContain('Status: running')
    expect(result.value).toContain('Progress: Reading files')
  })

  test('tails recent events', async () => {
    const store = makeStore()
    store.createRun({ title: 'Review auth flow', status: 'running' })
    store.updateRun('run_1', { progress: { summary: 'Reading files' } })
    setRunTestDeps({ getAgentRunStore: () => store })

    const result = await call('tail run_1 5', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Run tail: run_1')
    expect(result.value).toContain('run_started')
    expect(result.value).toContain('run_progress')
  })

  test('pauses and resumes runs', async () => {
    const store = makeStore()
    store.createRun({ title: 'Review auth flow', status: 'running' })
    setRunTestDeps({ getAgentRunStore: () => store })

    const paused = await call('pause run_1', {} as never)
    const resumed = await call('resume run_1', {} as never)

    expect(paused.type).toBe('text')
    expect(resumed.type).toBe('text')
    if (paused.type !== 'text' || resumed.type !== 'text') throw new Error('unexpected result type')
    expect(paused.value).toContain('Run paused: run_1')
    expect(resumed.value).toContain('Run resumed: run_1')
  })

  test('approves and recovers runs', async () => {
    const store = makeStore()
    store.createRun({
      title: 'Review auth flow',
      status: 'awaiting_approval',
      permissionState: { pendingApprovalIds: ['approval-1'] },
    })
    setRunTestDeps({ getAgentRunStore: () => store })

    const approved = await call('approve run_1 approval-1', {} as never)
    const recovered = await call('recover run_1 "Retry provider fallback"', {} as never)

    expect(approved.type).toBe('text')
    expect(recovered.type).toBe('text')
    if (approved.type !== 'text' || recovered.type !== 'text') throw new Error('unexpected result type')
    expect(approved.value).toContain('Run approved: run_1')
    expect(recovered.value).toContain('Run marked for recovery: run_1')
  })
})
