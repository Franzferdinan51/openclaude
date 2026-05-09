import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import {
  type AgentRun,
  type AgentRunCreateInput,
  type AgentRunEvent,
  type AgentRunEventType,
  type AgentRunListFilter,
  type AgentRunStatus,
  type AgentRunUpdate,
} from './types.js'

export type AgentRunSubscriber = (event: AgentRunEvent) => void

export type AgentRunStoreOptions = {
  dir?: string
  persist?: boolean
  now?: () => number
  idFactory?: () => string
  eventIdFactory?: () => string
}

type Snapshot = {
  version: 1
  runs: AgentRun[]
  events: AgentRunEvent[]
}

const SNAPSHOT_FILE = 'agent-runs.json'
const TERMINAL_STATUSES = new Set<AgentRunStatus>([
  'completed',
  'failed',
  'cancelled',
])

export class AgentRunStore {
  private readonly runs = new Map<string, AgentRun>()
  private readonly events: AgentRunEvent[] = []
  private readonly subscribers = new Set<AgentRunSubscriber>()
  private readonly dir: string
  private readonly persist: boolean
  private readonly now: () => number
  private readonly idFactory: () => string
  private readonly eventIdFactory: () => string

  constructor(options: AgentRunStoreOptions = {}) {
    this.dir = options.dir ?? getDefaultAgentRunStoreDir()
    this.persist = options.persist ?? true
    this.now = options.now ?? Date.now
    this.idFactory = options.idFactory ?? (() => `run_${randomUUID()}`)
    this.eventIdFactory = options.eventIdFactory ?? (() => `event_${randomUUID()}`)
    this.load()
  }

  createRun(input: AgentRunCreateInput): AgentRun {
    const timestamp = this.now()
    const run: AgentRun = {
      id: input.id ?? this.idFactory(),
      status: input.status ?? 'queued',
      title: input.title,
      description: input.description,
      parentRunId: input.parentRunId,
      childRunIds: [],
      selectedAgent: input.selectedAgent,
      provider: input.provider,
      model: input.model,
      runtimeHarness: input.runtimeHarness ?? 'builtin',
      channelSource: input.channelSource,
      taskIds: [...(input.taskIds ?? [])],
      transcriptPath: input.transcriptPath,
      artifacts: [...(input.artifacts ?? [])],
      progress: input.progress,
      budget: input.budget,
      permissionState: input.permissionState,
      recoveryAttempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: TERMINAL_STATUSES.has(input.status ?? 'queued') ? timestamp : undefined,
    }

    this.runs.set(run.id, run)
    if (run.parentRunId) {
      this.linkChildRun(run.parentRunId, run.id, false)
    }
    this.recordEvent('run_started', run.id, {
      status: run.status,
      title: run.title,
      selectedAgent: run.selectedAgent,
      provider: run.provider,
      model: run.model,
      runtimeHarness: run.runtimeHarness,
      channelSource: run.channelSource,
      taskIds: run.taskIds,
    })
    this.save()
    return run
  }

  updateRun(runId: string, update: AgentRunUpdate): AgentRun | undefined {
    const existing = this.runs.get(runId)
    if (!existing) return undefined

    const timestamp = this.now()
    const status = update.status ?? existing.status
    const updated: AgentRun = {
      ...existing,
      ...update,
      taskIds: update.taskIds ? unique([...existing.taskIds, ...update.taskIds]) : existing.taskIds,
      artifacts: update.artifacts ? [...existing.artifacts, ...update.artifacts] : existing.artifacts,
      progress: update.progress ? { ...existing.progress, ...update.progress } : existing.progress,
      permissionState: update.permissionState
        ? { ...existing.permissionState, ...update.permissionState }
        : existing.permissionState,
      status,
      updatedAt: timestamp,
      completedAt: TERMINAL_STATUSES.has(status) ? existing.completedAt ?? timestamp : undefined,
    }

    this.runs.set(runId, updated)
    this.recordEvent(eventTypeForUpdate(update), runId, sanitizePayload(update))
    this.save()
    return updated
  }

  getRun(runId: string): AgentRun | undefined {
    return this.runs.get(runId)
  }

  listRuns(filter: AgentRunListFilter = {}): AgentRun[] {
    return [...this.runs.values()]
      .filter(run => (filter.status ? run.status === filter.status : true))
      .filter(run =>
        filter.parentRunId ? run.parentRunId === filter.parentRunId : true,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  listEvents(runId?: string): AgentRunEvent[] {
    return this.events.filter(event => (runId ? event.runId === runId : true))
  }

  linkChildRun(parentRunId: string, childRunId: string, shouldSave = true): void {
    const parent = this.runs.get(parentRunId)
    const child = this.runs.get(childRunId)
    if (parent && !parent.childRunIds.includes(childRunId)) {
      this.runs.set(parentRunId, {
        ...parent,
        childRunIds: [...parent.childRunIds, childRunId],
        updatedAt: this.now(),
      })
    }
    if (child && child.parentRunId !== parentRunId) {
      this.runs.set(childRunId, {
        ...child,
        parentRunId,
        updatedAt: this.now(),
      })
    }
    if (shouldSave) this.save()
  }

  subscribe(subscriber: AgentRunSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  resetForTesting(): void {
    this.runs.clear()
    this.events.splice(0)
    this.save()
  }

  private recordEvent(
    type: AgentRunEventType,
    runId: string,
    payload?: Record<string, unknown>,
  ): void {
    const event: AgentRunEvent = {
      eventId: this.eventIdFactory(),
      runId,
      type,
      timestamp: this.now(),
      payload,
    }
    this.events.push(event)
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event)
      } catch {
        // Observability must never break the agent runtime.
      }
    }
  }

  private load(): void {
    if (!this.persist) return
    const path = this.snapshotPath()
    if (!existsSync(path)) return
    try {
      const snapshot = JSON.parse(readFileSync(path, 'utf8')) as Snapshot
      for (const run of snapshot.runs ?? []) {
        this.runs.set(run.id, run)
      }
      this.events.push(...(snapshot.events ?? []))
    } catch {
      // Corrupt observability snapshots should not block DuckHive startup.
    }
  }

  private save(): void {
    if (!this.persist) return
    mkdirSync(this.dir, { recursive: true })
    const snapshot: Snapshot = {
      version: 1,
      runs: [...this.runs.values()],
      events: this.events,
    }
    writeFileSync(this.snapshotPath(), `${JSON.stringify(snapshot, null, 2)}\n`)
  }

  private snapshotPath(): string {
    return join(this.dir, SNAPSHOT_FILE)
  }
}

let globalStore: AgentRunStore | undefined

export function createAgentRunStore(options?: AgentRunStoreOptions): AgentRunStore {
  return new AgentRunStore(options)
}

export function getAgentRunStore(): AgentRunStore {
  globalStore ??= new AgentRunStore()
  return globalStore
}

export function resetAgentRunStoreForTesting(
  options?: AgentRunStoreOptions,
): AgentRunStore {
  globalStore = new AgentRunStore(options)
  return globalStore
}

export function getDefaultAgentRunStoreDir(): string {
  return process.env.DUCKHIVE_AGENT_RUN_STORE_DIR
    ?? join(getClaudeConfigHomeDir(), 'agent-runs')
}

function eventTypeForUpdate(update: AgentRunUpdate): AgentRunEventType {
  if (update.status === 'awaiting_approval') return 'approval_requested'
  if (update.status === 'completed') return 'run_completed'
  if (update.status === 'failed') return 'run_failed'
  if (update.status === 'cancelled') return 'run_cancelled'
  if (update.status === 'recovering') return 'run_recovered'
  return 'run_progress'
}

function sanitizePayload(update: AgentRunUpdate): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined),
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
