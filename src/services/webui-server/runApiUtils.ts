import {
  AGENT_RUN_STATUSES,
  type AgentRunStatus,
} from '../../agent-runs/types.js'

const STATUS_SET = new Set<string>(AGENT_RUN_STATUSES)

export type RunStatusFilterResult =
  | { ok: true; status?: AgentRunStatus }
  | { ok: false; message: string }

export function parseRunStatusFilter(raw: string | null): RunStatusFilterResult {
  if (!raw) return { ok: true }
  if (STATUS_SET.has(raw)) return { ok: true, status: raw as AgentRunStatus }
  return {
    ok: false,
    message: `Invalid run status "${raw}". Expected one of: ${AGENT_RUN_STATUSES.join(', ')}`,
  }
}

export function parseRunEventLimit(
  raw: string | null,
  defaultLimit = 50,
  maxLimit = 200,
): number {
  if (!raw) return defaultLimit
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return defaultLimit
  return Math.min(maxLimit, Math.max(1, Math.floor(parsed)))
}
