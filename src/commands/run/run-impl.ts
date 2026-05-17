import type { LocalCommandCall } from '../../types/command.js'
import { getAgentRunStore, type AgentRunStore } from '../../agent-runs/index.js'

type RunDeps = {
  getAgentRunStore: typeof getAgentRunStore
}

let runTestDeps: Partial<RunDeps> | null = null

function getRunDeps(): RunDeps {
  return {
    getAgentRunStore,
    ...runTestDeps,
  }
}

export function setRunTestDeps(overrides: Partial<RunDeps> | null): void {
  runTestDeps = overrides
}

function splitCommandArgs(args: string): string[] {
  return (
    args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg =>
      arg.replace(/^["']|["']$/g, ''),
    ) ?? []
  )
}

function usage(error?: string): string {
  const lines = [
    'Agent Runs',
    '',
    'Usage:',
    '  /run list [status]',
    '  /run <id>',
    '  /run tail <id> [limit]',
    '  /run pause <id>',
    '  /run resume <id>',
    '  /run stop <id>',
    '  /run approve <id> [approval-id]',
    '  /run recover <id> [summary]',
    '',
    'Examples:',
    '  /run list running',
    '  /run run_123',
    '  /run tail run_123 50',
    '  /run approve run_123 approval-1',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

function formatDate(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleString() : 'n/a'
}

function renderRunList(store: AgentRunStore, status?: string): string {
  const runs = store.listRuns(status ? { status: status as any } : {})
  if (runs.length === 0) {
    return status
      ? `Agent Runs\n\nNo runs with status: ${status}`
      : 'Agent Runs\n\nNo runs recorded yet.'
  }

  const lines = ['Agent Runs', '-'.repeat(40)]
  for (const run of runs) {
    lines.push(
      `- ${run.id} [${run.status}] ${run.title}${run.selectedAgent ? ` · ${run.selectedAgent}` : ''}`,
    )
  }
  return lines.join('\n')
}

function renderRunDetail(store: AgentRunStore, runId: string): string {
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
  if (run.provider || run.model) {
    lines.push(`Model: ${run.provider ?? 'unknown'}/${run.model ?? 'unknown'}`)
  }
  if (run.progress?.summary) lines.push(`Progress: ${run.progress.summary}`)
  if (run.permissionState?.pendingApprovalIds?.length) {
    lines.push(`Pending approvals: ${run.permissionState.pendingApprovalIds.join(', ')}`)
  }
  if (run.childRunIds.length) lines.push(`Children: ${run.childRunIds.join(', ')}`)
  return lines.join('\n')
}

function renderTail(store: AgentRunStore, runId: string, limit: number): string {
  const run = store.getRun(runId)
  if (!run) return `Run not found: ${runId}`
  const events = store.tailEvents(runId, limit)
  if (events.length === 0) return `Run tail\n\nNo events recorded yet for ${runId}.`

  const lines = [`Run tail: ${runId}`, '-'.repeat(40)]
  for (const event of events) {
    const payload = event.payload ? ` ${JSON.stringify(event.payload)}` : ''
    lines.push(
      `${new Date(event.timestamp).toLocaleTimeString()} ${event.type}${payload}`,
    )
  }
  return lines.join('\n')
}

function resolveStore(): AgentRunStore {
  return getRunDeps().getAgentRunStore()
}

export const call: LocalCommandCall = async (args: string) => {
  const tokens = splitCommandArgs(args)
  const subcommand = tokens[0]?.toLowerCase()
  const store = resolveStore()

  if (!subcommand || subcommand === 'list') {
    if (tokens.length > 2) {
      return { type: 'text', value: usage('list accepts at most one optional status filter.') }
    }
    return { type: 'text', value: renderRunList(store, tokens[1]) }
  }

  if (subcommand === 'tail') {
    const runId = tokens[1]
    const limit = tokens[2] ? Number(tokens[2]) : 20
    if (!runId) return { type: 'text', value: usage('tail requires a run id.') }
    if (tokens.length > 3) return { type: 'text', value: usage('tail accepts at most a run id and optional limit.') }
    if (!Number.isFinite(limit) || limit < 1) {
      return { type: 'text', value: usage(`Invalid tail limit: ${tokens[2]}`) }
    }
    return { type: 'text', value: renderTail(store, runId, limit) }
  }

  if (subcommand === 'pause') {
    const runId = tokens[1]
    if (!runId) return { type: 'text', value: usage('pause requires a run id.') }
    if (tokens.length > 2) return { type: 'text', value: usage('pause accepts exactly one run id.') }
    const run = store.pauseRun(runId)
    return {
      type: 'text',
      value: run ? `Run paused: ${runId}` : `Run not found: ${runId}`,
    }
  }

  if (subcommand === 'resume') {
    const runId = tokens[1]
    if (!runId) return { type: 'text', value: usage('resume requires a run id.') }
    if (tokens.length > 2) return { type: 'text', value: usage('resume accepts exactly one run id.') }
    const run = store.resumeRun(runId)
    return {
      type: 'text',
      value: run ? `Run resumed: ${runId}` : `Run not found: ${runId}`,
    }
  }

  if (subcommand === 'stop' || subcommand === 'cancel') {
    const runId = tokens[1]
    if (!runId) return { type: 'text', value: usage('stop requires a run id.') }
    if (tokens.length > 2) return { type: 'text', value: usage('stop accepts exactly one run id.') }
    const run = store.cancelRun(runId)
    return {
      type: 'text',
      value: run ? `Run stopped: ${runId}` : `Run not found: ${runId}`,
    }
  }

  if (subcommand === 'approve') {
    const runId = tokens[1]
    const approvalId = tokens[2]
    if (!runId) return { type: 'text', value: usage('approve requires a run id.') }
    if (tokens.length > 3) return { type: 'text', value: usage('approve accepts a run id and optional approval id.') }
    const run = store.approveRun(runId, approvalId)
    return {
      type: 'text',
      value: run ? `Run approved: ${runId}` : `Run not found: ${runId}`,
    }
  }

  if (subcommand === 'recover') {
    const runId = tokens[1]
    const summary = tokens.slice(2).join(' ').trim()
    if (!runId) return { type: 'text', value: usage('recover requires a run id.') }
    const run = store.recoverRun(runId, summary || undefined)
    return {
      type: 'text',
      value: run ? `Run marked for recovery: ${runId}` : `Run not found: ${runId}`,
    }
  }

  if (tokens.length > 1) {
    return { type: 'text', value: usage(`Unknown run command or extra arguments: ${tokens.join(' ')}`) }
  }

  return { type: 'text', value: renderRunDetail(store, tokens[0]) }
}
