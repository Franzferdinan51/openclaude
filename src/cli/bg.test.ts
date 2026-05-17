import { afterEach, describe, expect, test } from 'bun:test'
import { createAgentRunStore } from '../agent-runs/index.js'
import {
  attachHandler,
  handleBgFlag,
  killHandler,
  logsHandler,
  psHandler,
  setBgTestDeps,
} from './bg.js'

function makeWriter() {
  let text = ''
  return {
    stream: {
      write(chunk: string) {
        text += chunk
        return true
      },
    },
    text: () => text,
  }
}

function makeStore() {
  return createAgentRunStore({
    persist: false,
    now: () => Date.UTC(2026, 4, 17, 12, 0, 0),
    idFactory: () => 'run_bg',
    eventIdFactory: () => 'event_bg',
  })
}

afterEach(() => {
  setBgTestDeps(null)
  process.exitCode = 0
})

describe('background AgentRun CLI handlers', () => {
  test('ps lists AgentRuns from the shared store', async () => {
    const store = makeStore()
    store.createRun({
      title: 'Review terminal startup',
      status: 'running',
      selectedAgent: 'reviewer',
      provider: 'minimax',
      model: 'MiniMax-M2.7',
    })
    const stdout = makeWriter()
    const stderr = makeWriter()
    setBgTestDeps({ getAgentRunStore: () => store, stdout: stdout.stream, stderr: stderr.stream })

    await psHandler([])

    expect(stdout.text()).toContain('DuckHive background runs')
    expect(stdout.text()).toContain('run_bg [running] Review terminal startup')
    expect(stdout.text()).toContain('agent=reviewer')
    expect(stderr.text()).toBe('')
  })

  test('logs tails AgentRun events and clamps the limit', async () => {
    const store = makeStore()
    store.createRun({ title: 'Review terminal startup', status: 'running' })
    store.updateRun('run_bg', { progress: { summary: 'Checking stdin' } })
    const stdout = makeWriter()
    const stderr = makeWriter()
    setBgTestDeps({ getAgentRunStore: () => store, stdout: stdout.stream, stderr: stderr.stream })

    await logsHandler(['run_bg', '999'])

    expect(stdout.text()).toContain('Run logs: run_bg')
    expect(stdout.text()).toContain('run_started')
    expect(stdout.text()).toContain('run_progress')
    expect(stderr.text()).toBe('')
  })

  test('attach shows run detail without pretending live attach exists', async () => {
    const store = makeStore()
    store.createRun({
      title: 'Review terminal startup',
      status: 'awaiting_approval',
      permissionState: { pendingApprovalIds: ['approval-1'] },
      progress: { summary: 'Waiting for approval' },
    })
    const stdout = makeWriter()
    const stderr = makeWriter()
    setBgTestDeps({ getAgentRunStore: () => store, stdout: stdout.stream, stderr: stderr.stream })

    await attachHandler(['run_bg'])

    expect(stdout.text()).toContain('Run: run_bg')
    expect(stdout.text()).toContain('Pending approvals: approval-1')
    expect(stdout.text()).toContain('Live terminal attach is not implemented yet')
    expect(stderr.text()).toBe('')
  })

  test('kill cancels an AgentRun instead of no-oping', async () => {
    const store = makeStore()
    store.createRun({ title: 'Review terminal startup', status: 'running' })
    const stdout = makeWriter()
    const stderr = makeWriter()
    setBgTestDeps({ getAgentRunStore: () => store, stdout: stdout.stream, stderr: stderr.stream })

    await killHandler(['run_bg'])

    expect(stdout.text()).toContain('Run stopped: run_bg')
    expect(store.getRun('run_bg')?.status).toBe('cancelled')
    expect(stderr.text()).toBe('')
  })

  test('logs exits nonzero when the run is missing', async () => {
    const store = makeStore()
    const stdout = makeWriter()
    const stderr = makeWriter()
    setBgTestDeps({ getAgentRunStore: () => store, stdout: stdout.stream, stderr: stderr.stream })

    await logsHandler(['missing-run'])

    expect(stderr.text()).toContain('Run not found: missing-run')
    expect(process.exitCode).toBe(1)
    expect(stdout.text()).toBe('')
  })

  test('--bg registers a queued AgentRun for shared control surfaces', async () => {
    const store = makeStore()
    const stdout = makeWriter()
    const stderr = makeWriter()
    setBgTestDeps({ getAgentRunStore: () => store, stdout: stdout.stream, stderr: stderr.stream })

    await handleBgFlag(['--bg', 'review', 'terminal', 'startup'])

    expect(stdout.text()).toContain('Background AgentRun queued: run_bg')
    expect(stdout.text()).toContain('duckhive attach run_bg')
    expect(store.getRun('run_bg')?.status).toBe('queued')
    expect(store.getRun('run_bg')?.title).toBe('review terminal startup')
    expect(store.getRun('run_bg')?.channelSource?.type).toBe('headless')
    expect(stderr.text()).toBe('')
    expect(process.exitCode).toBe(0)
  })

  test('--bg rejects missing prompt without creating a run', async () => {
    const store = makeStore()
    const stdout = makeWriter()
    const stderr = makeWriter()
    setBgTestDeps({ getAgentRunStore: () => store, stdout: stdout.stream, stderr: stderr.stream })

    await handleBgFlag(['--bg'])

    expect(stderr.text()).toContain('--bg/--background requires a prompt')
    expect(store.listRuns()).toEqual([])
    expect(process.exitCode).toBe(1)
    expect(stdout.text()).toBe('')
  })
})
