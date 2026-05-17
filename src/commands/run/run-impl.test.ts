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
  test('shows usage for help requests', async () => {
    const store = makeStore()
    setRunTestDeps({ getAgentRunStore: () => store })

    const result = await call('help', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Agent Runs')
    expect(result.value).toContain('/run list [status]')
    expect(result.value).toContain('/run recover <id> [summary]')
    expect(result.value).not.toContain('Run not found: help')
  })

  test('lists runs', async () => {
    const store = makeStore()
    store.createRun({ title: 'Review auth flow', status: 'running', selectedAgent: 'reviewer' })
    setRunTestDeps({ getAgentRunStore: () => store })

    const result = await call('list', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Agent Runs')
    expect(result.value).toContain('run_1 [running] Review auth flow - reviewer')
    expect([...result.value].every(char => char.charCodeAt(0) < 128)).toBe(true)
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

  test('rejects unknown list status filters', async () => {
    const store = makeStore()
    store.createRun({ title: 'Review auth flow', status: 'running' })
    setRunTestDeps({ getAgentRunStore: () => store })

    const result = await call('list stuck', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Invalid run status: stuck')
    expect(result.value).toContain('awaiting_approval')
    expect(result.value).toContain('Usage:')
  })

  test('clamps tail limits to the CLI event tail maximum', async () => {
    let eventCounter = 0
    const store = createAgentRunStore({
      persist: false,
      now: () => Date.UTC(2026, 4, 16, 12, 0, eventCounter++),
      idFactory: () => 'run_1',
      eventIdFactory: () => `event_${eventCounter}`,
    })
    store.createRun({ title: 'Review auth flow', status: 'running' })
    for (let i = 0; i < 250; i++) {
      store.updateRun('run_1', { progress: { summary: `event ${i}` } })
    }
    setRunTestDeps({ getAgentRunStore: () => store })

    const result = await call('tail run_1 9999', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value.split('\n')).toHaveLength(202)
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

  test('rejects extra arguments for control subcommands before mutating runs', async () => {
    const store = makeStore()
    store.createRun({
      title: 'Review auth flow',
      status: 'running',
      permissionState: { pendingApprovalIds: ['approval-1'] },
    })
    setRunTestDeps({ getAgentRunStore: () => store })

    for (const args of [
      'tail run_1 5 extra',
      'pause run_1 extra',
      'resume run_1 extra',
      'stop run_1 extra',
      'approve run_1 approval-1 extra',
      'run_1 extra',
    ]) {
      const result = await call(args, {} as never)
      expect(result.type).toBe('text')
      if (result.type !== 'text') throw new Error('unexpected result type')
      expect(result.value).toContain('Usage:')
    }

    expect(store.getRun('run_1')?.status).toBe('running')
    expect(store.getRun('run_1')?.permissionState?.pendingApprovalIds).toEqual(['approval-1'])
  })
})
