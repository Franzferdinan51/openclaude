import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  createAgentRunStore,
} from './AgentRunStore.js'
import type { AgentRunEvent } from './types.js'

const tempDirs: string[] = []

function tempStoreDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'duckhive-agent-runs-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('AgentRunStore', () => {
  test('creates runs, records ordered events, and persists snapshots', () => {
    let now = 1000
    let ids = 0
    const dir = tempStoreDir()
    const store = createAgentRunStore({
      dir,
      now: () => now++,
      idFactory: () => `run-${++ids}`,
      eventIdFactory: () => `event-${ids}-${now}`,
    })

    const run = store.createRun({
      title: 'Implement the harness',
      description: 'Build the first control-plane slice',
      selectedAgent: 'coder',
      provider: 'minimax',
      model: 'MiniMax-M2.7',
      runtimeHarness: 'builtin',
      channelSource: { type: 'telegram', id: '42' },
      taskIds: ['a123'],
    })

    store.updateRun(run.id, {
      status: 'running',
      progress: { toolUseCount: 2, tokenCount: 128, summary: 'Reading files' },
    })
    store.updateRun(run.id, { status: 'completed' })

    const events = store.listEvents(run.id)
    expect(events.map(event => event.type)).toEqual([
      'run_started',
      'run_progress',
      'run_completed',
    ])
    expect(events[0].timestamp).toBeLessThan(events[1].timestamp)

    const reloaded = createAgentRunStore({ dir })
    expect(reloaded.getRun(run.id)?.status).toBe('completed')
    expect(reloaded.getRun(run.id)?.progress?.summary).toBe('Reading files')
    expect(reloaded.listEvents(run.id).map(event => event.type)).toEqual(
      events.map(event => event.type),
    )
  })

  test('tracks parent and child run graphs without duplicating children', () => {
    const store = createAgentRunStore({
      persist: false,
      idFactory: (() => {
        const ids = ['parent', 'child']
        return () => ids.shift() ?? 'extra'
      })(),
    })

    const parent = store.createRun({ title: 'Coordinate feature' })
    const child = store.createRun({
      title: 'Worker one',
      parentRunId: parent.id,
      selectedAgent: 'worker',
    })
    store.linkChildRun(parent.id, child.id)
    store.linkChildRun(parent.id, child.id)

    expect(store.getRun(parent.id)?.childRunIds).toEqual([child.id])
    expect(store.getRun(child.id)?.parentRunId).toBe(parent.id)
    expect(store.listRuns({ parentRunId: parent.id }).map(run => run.id)).toEqual([
      child.id,
    ])
  })

  test('notifies subscribers with normalized AgentRun events', () => {
    const store = createAgentRunStore({ persist: false })
    const seen: AgentRunEvent[] = []
    const unsubscribe = store.subscribe(event => seen.push(event))

    const run = store.createRun({ title: 'Observe me' })
    store.updateRun(run.id, {
      status: 'awaiting_approval',
      permissionState: { pendingApprovalIds: ['approval-1'] },
    })
    unsubscribe()
    store.updateRun(run.id, { status: 'cancelled' })

    expect(seen.map(event => event.type)).toEqual([
      'run_started',
      'approval_requested',
    ])
    expect(seen[1].payload).toEqual({
      status: 'awaiting_approval',
      permissionState: { pendingApprovalIds: ['approval-1'] },
    })
  })

  test('provides shared run control operations for remote and TUI surfaces', () => {
    const store = createAgentRunStore({ persist: false })
    const run = store.createRun({
      title: 'Remote controlled run',
      status: 'running',
      permissionState: { pendingApprovalIds: ['approval-1', 'approval-2'] },
    })

    expect(store.pauseRun(run.id)?.status).toBe('paused')
    expect(store.resumeRun(run.id)?.status).toBe('running')
    expect(store.approveRun(run.id, 'approval-1')?.permissionState).toEqual({
      pendingApprovalIds: ['approval-2'],
      lastDecision: 'allow',
    })
    expect(store.recoverRun(run.id, 'Retrying provider failure')?.recoveryAttempts).toBe(1)
    expect(store.cancelRun(run.id)?.status).toBe('cancelled')
    expect(store.tailEvents(run.id, 2).map(event => event.type)).toEqual([
      'run_recovered',
      'run_cancelled',
    ])
  })
})
