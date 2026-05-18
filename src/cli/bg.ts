import {
  AGENT_RUN_STATUSES,
  getAgentRunStore,
  type AgentRun,
  type AgentRunArtifact,
  type AgentRunStatus,
  type AgentRunStore,
} from '../agent-runs/index.js'

type BgDeps = {
  getAgentRunStore: typeof getAgentRunStore
  stdout: Pick<NodeJS.WriteStream, 'write'>
  stderr: Pick<NodeJS.WriteStream, 'write'>
}

let testDeps: Partial<BgDeps> | null = null

function deps(): BgDeps {
  return {
    getAgentRunStore,
    stdout: process.stdout,
    stderr: process.stderr,
    ...testDeps,
  }
}

export function setBgTestDeps(overrides: Partial<BgDeps> | null): void {
  testDeps = overrides
}

function writeLine(stream: Pick<NodeJS.WriteStream, 'write'>, text: string): void {
  stream.write(`${text}\n`)
}

function usage(error?: string): string {
  const lines = [
    'DuckHive background run controls',
    '',
    'Usage:',
    '  duckhive --bg <prompt>',
    '  duckhive --background <prompt>',
    '  duckhive ps [status]',
    '  duckhive logs <run-id> [limit]',
    '  duckhive attach <run-id> [event-limit]',
    '  duckhive pause <run-id>',
    '  duckhive resume <run-id>',
    '  duckhive approve <run-id> [approval-id]',
    '  duckhive recover <run-id> [summary]',
    '  duckhive kill <run-id>',
    '',
    'These commands use the shared AgentRun store also used by /run, Telegram, WebUI, and the harness API.',
    'The --bg/--background path registers a queued AgentRun so it is visible to ps/logs/attach/kill and remote control surfaces.',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

function parseBgPrompt(args: string[]): { prompt?: string; error?: string } {
  const promptParts = args.filter(arg => arg !== '--bg' && arg !== '--background')
  const prompt = promptParts.join(' ').trim()
  if (!prompt) {
    return { error: '--bg/--background requires a prompt to register.' }
  }
  return { prompt }
}

function titleFromPrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim()
  if (compact.length <= 80) return compact
  return `${compact.slice(0, 77)}...`
}

function parseStatus(status?: string): { status?: AgentRunStatus; error?: string } {
  if (!status) return {}
  if ((AGENT_RUN_STATUSES as readonly string[]).includes(status)) {
    return { status: status as AgentRunStatus }
  }
  return {
    error: `Invalid run status: ${status}. Expected one of: ${AGENT_RUN_STATUSES.join(', ')}`,
  }
}

function parseTailLimit(raw?: string): { limit?: number; error?: string } {
  if (!raw) return { limit: 20 }
  const limit = Number(raw)
  if (!Number.isFinite(limit) || limit < 1) return { error: `Invalid log limit: ${raw}` }
  return { limit: Math.min(200, Math.floor(limit)) }
}

function formatDate(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleString() : 'n/a'
}

function formatRunLine(run: AgentRun): string {
  const agent = run.selectedAgent ? ` agent=${run.selectedAgent}` : ''
  const model = run.provider || run.model ? ` model=${run.provider ?? 'unknown'}/${run.model ?? 'unknown'}` : ''
  return `${run.id} [${run.status}] ${run.title}${agent}${model}`
}

function formatRunEventLine(
  event: ReturnType<AgentRunStore['tailEvents']>[number],
): string {
  const payload = event.payload ? ` ${JSON.stringify(event.payload)}` : ''
  return `${new Date(event.timestamp).toLocaleTimeString()} ${event.type}${payload}`
}

function formatRunArtifact(artifact: AgentRunArtifact): string {
  const target = artifact.path ?? artifact.url ?? '(no path or url)'
  const label = artifact.label ? ` ${artifact.label}` : ''
  return `[${artifact.kind}]${label} ${target}`.trim()
}

function renderRunList(store: AgentRunStore, status?: AgentRunStatus): string {
  const runs = store.listRuns(status ? { status } : {})
  if (runs.length === 0) {
    return status
      ? `DuckHive background runs\n\nNo AgentRuns with status: ${status}`
      : 'DuckHive background runs\n\nNo AgentRuns recorded yet.'
  }
  return ['DuckHive background runs', '-'.repeat(40), ...runs.map(formatRunLine)].join('\n')
}

function renderRunDetail(store: AgentRunStore, runId: string, tailLimit = 20): string {
  const run = store.getRun(runId)
  if (!run) return `Run not found: ${runId}`
  const lines = [
    `Run: ${run.id}`,
    '-'.repeat(40),
    `Title: ${run.title}`,
    `Status: ${run.status}`,
    `Harness: ${run.runtimeHarness}`,
    `Created: ${formatDate(run.createdAt)}`,
    `Updated: ${formatDate(run.updatedAt)}`,
  ]
  if (run.description) lines.push(`Description: ${run.description}`)
  if (run.selectedAgent) lines.push(`Agent: ${run.selectedAgent}`)
  if (run.provider || run.model) lines.push(`Model: ${run.provider ?? 'unknown'}/${run.model ?? 'unknown'}`)
  if (run.progress?.summary) lines.push(`Progress: ${run.progress.summary}`)
  if (run.permissionState?.pendingApprovalIds?.length) {
    lines.push(`Pending approvals: ${run.permissionState.pendingApprovalIds.join(', ')}`)
  }
  if (run.childRunIds.length) lines.push(`Children: ${run.childRunIds.join(', ')}`)
  if (run.artifacts.length) {
    lines.push('', 'Artifacts:')
    lines.push(...run.artifacts.map(artifact => `  ${formatRunArtifact(artifact)}`))
  }
  const events = store.tailEvents(runId, tailLimit)
  lines.push('', `Recent events (${events.length}/${tailLimit}):`)
  if (events.length === 0) {
    lines.push('  No events recorded yet.')
  } else {
    lines.push(...events.map(event => `  ${formatRunEventLine(event)}`))
  }
  lines.push(
    '',
    'Controls:',
    `  duckhive logs ${runId} ${tailLimit}`,
    `  duckhive pause ${runId}`,
    `  duckhive resume ${runId}`,
    `  duckhive kill ${runId}`,
  )
  return lines.join('\n')
}

function renderRunLogs(store: AgentRunStore, runId: string, limit: number): string {
  const run = store.getRun(runId)
  if (!run) return `Run not found: ${runId}`
  const events = store.tailEvents(runId, limit)
  if (events.length === 0) return `Run logs: ${runId}\n\nNo events recorded yet.`
  const lines = [`Run logs: ${runId}`, '-'.repeat(40)]
  for (const event of events) {
    lines.push(formatRunEventLine(event))
  }
  return lines.join('\n')
}

function resolveStore(): AgentRunStore {
  return deps().getAgentRunStore()
}

export async function psHandler(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const [status, extra] = args
  if (status === '--help' || status === '-h') {
    writeLine(stdout, usage())
    return
  }
  if (extra) {
    writeLine(stderr, usage('ps accepts at most one optional status filter.'))
    process.exitCode = 1
    return
  }
  const parsed = parseStatus(status)
  if (parsed.error) {
    writeLine(stderr, usage(parsed.error))
    process.exitCode = 1
    return
  }
  writeLine(stdout, renderRunList(resolveStore(), parsed.status))
}

export async function logsHandler(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const [runId, rawLimit, extra] = args
  if (runId === '--help' || runId === '-h') {
    writeLine(stdout, usage())
    return
  }
  if (!runId) {
    writeLine(stderr, usage('logs requires a run id.'))
    process.exitCode = 1
    return
  }
  if (extra) {
    writeLine(stderr, usage('logs accepts a run id and optional limit.'))
    process.exitCode = 1
    return
  }
  const parsedLimit = parseTailLimit(rawLimit)
  if (parsedLimit.error) {
    writeLine(stderr, usage(parsedLimit.error))
    process.exitCode = 1
    return
  }
  const store = resolveStore()
  if (!store.getRun(runId)) {
    writeLine(stderr, `Run not found: ${runId}`)
    process.exitCode = 1
    return
  }
  writeLine(stdout, renderRunLogs(store, runId, parsedLimit.limit ?? 20))
}

export async function attachHandler(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const [runId, rawLimit, extra] = args
  if (runId === '--help' || runId === '-h') {
    writeLine(stdout, usage())
    return
  }
  if (!runId) {
    writeLine(stderr, usage('attach requires a run id.'))
    process.exitCode = 1
    return
  }
  if (extra) {
    writeLine(stderr, usage('attach accepts a run id and optional event limit.'))
    process.exitCode = 1
    return
  }
  const parsedLimit = parseTailLimit(rawLimit)
  if (parsedLimit.error) {
    writeLine(stderr, usage(parsedLimit.error.replace('log limit', 'attach event limit')))
    process.exitCode = 1
    return
  }
  const store = resolveStore()
  if (!store.getRun(runId)) {
    writeLine(stderr, `Run not found: ${runId}`)
    process.exitCode = 1
    return
  }
  writeLine(stdout, renderRunDetail(store, runId, parsedLimit.limit ?? 20))
}

export async function killHandler(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const [runId, extra] = args
  if (runId === '--help' || runId === '-h') {
    writeLine(stdout, usage())
    return
  }
  if (!runId) {
    writeLine(stderr, usage('kill requires a run id.'))
    process.exitCode = 1
    return
  }
  if (extra) {
    writeLine(stderr, usage('kill accepts exactly one run id.'))
    process.exitCode = 1
    return
  }
  const run = resolveStore().cancelRun(runId)
  if (!run) {
    writeLine(stderr, `Run not found: ${runId}`)
    process.exitCode = 1
    return
  }
  writeLine(stdout, `Run stopped: ${runId}`)
}

export async function pauseHandler(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const [runId, extra] = args
  if (runId === '--help' || runId === '-h') {
    writeLine(stdout, usage())
    return
  }
  if (!runId) {
    writeLine(stderr, usage('pause requires a run id.'))
    process.exitCode = 1
    return
  }
  if (extra) {
    writeLine(stderr, usage('pause accepts exactly one run id.'))
    process.exitCode = 1
    return
  }
  const run = resolveStore().pauseRun(runId)
  if (!run) {
    writeLine(stderr, `Run not found: ${runId}`)
    process.exitCode = 1
    return
  }
  writeLine(stdout, `Run paused: ${runId}`)
}

export async function resumeHandler(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const [runId, extra] = args
  if (runId === '--help' || runId === '-h') {
    writeLine(stdout, usage())
    return
  }
  if (!runId) {
    writeLine(stderr, usage('resume requires a run id.'))
    process.exitCode = 1
    return
  }
  if (extra) {
    writeLine(stderr, usage('resume accepts exactly one run id.'))
    process.exitCode = 1
    return
  }
  const run = resolveStore().resumeRun(runId)
  if (!run) {
    writeLine(stderr, `Run not found: ${runId}`)
    process.exitCode = 1
    return
  }
  writeLine(stdout, `Run resumed: ${runId}`)
}

export async function approveHandler(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const [runId, approvalId, extra] = args
  if (runId === '--help' || runId === '-h') {
    writeLine(stdout, usage())
    return
  }
  if (!runId) {
    writeLine(stderr, usage('approve requires a run id.'))
    process.exitCode = 1
    return
  }
  if (extra) {
    writeLine(stderr, usage('approve accepts a run id and optional approval id.'))
    process.exitCode = 1
    return
  }
  const run = resolveStore().approveRun(runId, approvalId)
  if (!run) {
    writeLine(stderr, `Run not found: ${runId}`)
    process.exitCode = 1
    return
  }
  writeLine(stdout, approvalId ? `Run approved: ${runId} (${approvalId})` : `Run approved: ${runId}`)
}

export async function recoverHandler(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const [runId, ...summaryParts] = args
  if (runId === '--help' || runId === '-h') {
    writeLine(stdout, usage())
    return
  }
  if (!runId) {
    writeLine(stderr, usage('recover requires a run id.'))
    process.exitCode = 1
    return
  }
  const run = resolveStore().recoverRun(runId, summaryParts.join(' ').trim() || undefined)
  if (!run) {
    writeLine(stderr, `Run not found: ${runId}`)
    process.exitCode = 1
    return
  }
  writeLine(stdout, `Run marked for recovery: ${runId}`)
}

export async function handleBgFlag(args: string[] = []): Promise<void> {
  const { stdout, stderr } = deps()
  const parsed = parseBgPrompt(args)
  if (parsed.error || !parsed.prompt) {
    writeLine(stderr, usage(parsed.error))
    process.exitCode = 1
    return
  }

  const run = resolveStore().createRun({
    title: titleFromPrompt(parsed.prompt),
    description: parsed.prompt,
    status: 'queued',
    runtimeHarness: 'builtin',
    channelSource: { type: 'headless' },
    progress: {
      summary: 'Registered from --bg; waiting for a background executor.',
    },
  })

  writeLine(
    stdout,
    [
      `Background AgentRun queued: ${run.id}`,
      `Title: ${run.title}`,
      '',
      `Inspect: duckhive attach ${run.id}`,
      `Logs: duckhive logs ${run.id}`,
      `Cancel: duckhive kill ${run.id}`,
    ].join('\n'),
  )
}
