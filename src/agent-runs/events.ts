import { getAgentRunStore } from './AgentRunStore.js'
import type { AgentRunEventType } from './types.js'

/**
 * pi-style event emitters.
 * Call these from harness/task code to emit rich runtime events
 * that flow through the SSE /api/events stream to the WebUI.
 */

export function emitPiEvent(
  type: AgentRunEventType,
  runId: string,
  payload: Record<string, unknown>,
): void {
  getAgentRunStore().emitEvent(type, { ...payload, runId })
}

export function emitToolStart(
  runId: string,
  toolName: string,
  args: Record<string, unknown>,
): void {
  emitPiEvent('tool_execution_start', runId, { toolName, args })
}

export function emitToolEnd(
  runId: string,
  toolName: string,
  result: Record<string, unknown>,
): void {
  emitPiEvent('tool_execution_end', runId, { toolName, result })
}

export function emitMsgDelta(
  runId: string,
  role: string,
  delta: string,
): void {
  emitPiEvent('message_delta', runId, { role, delta })
}

export function emitMsgEnd(runId: string, role: string): void {
  emitPiEvent('message_end', runId, { role })
}

export function emitTurnStart(runId: string, turnNumber: number): void {
  emitPiEvent('turn_start', runId, { turnNumber })
}

export function emitTurnEnd(
  runId: string,
  turnNumber: number,
  toolResults = 0,
): void {
  emitPiEvent('turn_end', runId, { turnNumber, toolResults })
}

export function emitAgentStart(runId: string, prompt: string): void {
  emitPiEvent('agent_start', runId, { prompt })
}

export function emitAgentEnd(runId: string): void {
  emitPiEvent('agent_end', runId, {})
}