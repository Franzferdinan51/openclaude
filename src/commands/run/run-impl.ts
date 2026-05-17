import type { LocalCommandCall } from '../../types/command.js'
import {
  AGENT_RUN_STATUSES,
  getAgentRunStore,
  type AgentRunStatus,
  type AgentRunStore,
} from '../../agent-runs/index.js'

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

function splitCommandArgs(args: string): { args: string[]; error?: string } {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let tokenStarted = false

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!

    if (quote) {
      if (ch === quote) {
        quote = null
        continue
      }
      if (ch === '\\' && i + 1 < args.length) {
        const next = args[i + 1]!
        if (next === quote || next === '\\') {
          current += next
          i += 1
          continue
        }
      }
      current += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      tokenStarted = true
      continue
    }

    if (/\s/.test(ch)) {
      if (tokenStarted) {
        tokens.push(current)
        current = ''
        tokenStarted = false
      }
      continue
    }

    current += ch
    tokenStarted = true
  }

  if (quote) {
    return { args: tokens, error: 'Unterminated quoted string in /run arguments.' }
  }

  if (tokenStarted) tokens.push(current)
  return { args: tokens }
}

function usage(error?: string): string {
  const lines = [
    'Agent Runs',
    '',
    'Usage:',
    '',
    'Terminal usage:',
    '  duckhive run list [status]',
    '  duckhive run <id>',
    '  duckhive run tail <id> [limit]',
    '  duckhive run pause <id>',
    '  duckhive run resume <id>',
    '  duckhive run stop <id>',
    '  duckhive run approve <id> [approval-id]',
    '  duckhive run recover <id> [summary]',
    '',
    'REPL usage:',
    '  /run list [status]',
    '  /run <id>',
    '  /run tail <id> [limit]',
    '  /run pause <id>',
    '  /run resume <id>',
    '  /run stop <id>',
    '  /run approve <id> [approval-id]',
    '  /run recover <id> [summary]',
    '',
    'Terminal examples:',
    '  duckhive run list running',
    '  duckhive run run_123',
    '  duckhive run tail run_123 50',
    '  duckhive run approve run_123 approval-1',
    '',
    'REPL examples:',
    '  /run list running',
    '  /run run_123',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

function formatDate(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleString() : 'n/a'
}

function parseRunStatus(status?: string): { status?: AgentRunStatus; error?: string } {
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
  if (!Number.isFinite(limit) || limit < 1) {
    return { error: `Invalid tail limit: ${raw}` }
  }
  return { limit: Math.min(200, Math.floor(limit)) }
}

function renderRunList(store: AgentRunStore, status?: AgentRunStatus): string {
  const runs = store.listRuns(status ? { status } : {})
  if (runs.length === 0) {
    return status
      ? `Agent Runs\n\nNo runs with status: ${status}`
      : 'Agent Runs\n\nNo runs recorded yet.'
  }

  const lines = ['Agent Runs', '-'.repeat(40)]
  for (const run of runs) {
    const agent = run.selectedAgent ? ` - ${run.selectedAgent}` : ''
    lines.push(`- ${run.id} [${run.status}] ${run.title}${agent}`)
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
  const parsedArgs = splitCommandArgs(args)
  if (parsedArgs.error) return { type: 'text', value: usage(parsedArgs.error) }
  const tokens = parsedArgs.args
  const subcommand = tokens[0]?.toLowerCase()
  const store = resolveStore()

  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    return { type: 'text', value: usage() }
  }

  if (!subcommand || subcommand === 'list') {
    if (tokens.length > 2) {
      return { type: 'text', value: usage('list accepts at most one optional status filter.') }
    }
    const parsedStatus = parseRunStatus(tokens[1])
    if (parsedStatus.error) return { type: 'text', value: usage(parsedStatus.error) }
    return { type: 'text', value: renderRunList(store, parsedStatus.status) }
  }

  if (subcommand === 'tail') {
    const runId = tokens[1]
    if (!runId) return { type: 'text', value: usage('tail requires a run id.') }
    if (tokens.length > 3) return { type: 'text', value: usage('tail accepts at most a run id and optional limit.') }
    const parsedLimit = parseTailLimit(tokens[2])
    if (parsedLimit.error) return { type: 'text', value: usage(parsedLimit.error) }
    return { type: 'text', value: renderTail(store, runId, parsedLimit.limit ?? 20) }
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
