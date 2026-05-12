/**
 * Tracing integration helper for local/non-bun environments.
 *
 * Since Duck CLI uses bun but this file needs to work standalone,
 * we export a no-op stub. Import tracing functions directly from
 * 'src/services/tracing' for actual tracing.
 *
 * This file provides optional tracing integration points that can be
 * called from various parts of the codebase without introducing hard
 * dependencies on the tracing system.
 */

import { randomUUID } from 'crypto'

/**
 * Stub type matching TraceCallback from tracing/types
 */
export interface TracingStub {
  onAgentSpawn?(agentType: string, runId: string, parentRunId?: string): void
  onAgentEnd?(agentType: string, runId: string, success: boolean): void
  onTurnStart?(turnNumber: number, runId: string): void
  onTurnEnd?(turnNumber: number, runId: string, toolResultCount: number): void
  onToolCall?(toolName: string, args: Record<string, unknown>, runId: string): void
  onToolResult?(toolName: string, result: Record<string, unknown>, runId: string): void
}

/**
 * Try to get tracing functions, returning no-ops on failure.
 * This makes tracing integration optional - if tracing isn't initialized,
 * calls are simply ignored.
 */
export async function getTracingIntegration(): Promise<{
  emitAgentSpawn: (agentType: string, agentId: string, parentAgentId?: string) => void
  emitAgentEnd: (agentType: string, agentId: string, success: boolean) => void
  emitTurnStart: (turnNumber: number, agentId: string) => void
  emitTurnEnd: (turnNumber: number, agentId: string, toolResultCount: number) => void
  emitToolCall: (toolName: string, args: Record<string, unknown>, agentId: string) => void
  emitToolResult: (toolName: string, result: Record<string, unknown>, agentId: string) => void
}> {
  try {
    const tracing = await import('./index.js')
    return {
      emitAgentSpawn: tracing.emitAgentSpawn,
      emitAgentEnd: tracing.emitAgentEnd,
      emitTurnStart: tracing.emitTurnStart,
      emitTurnEnd: tracing.emitTurnEnd,
      emitToolCall: tracing.emitToolCall,
      emitToolResult: tracing.emitToolResult,
    }
  } catch {
    // Tracing not available or not initialized - use no-ops
    return {
      emitAgentSpawn: () => {},
      emitAgentEnd: () => {},
      emitTurnStart: () => {},
      emitTurnEnd: () => {},
      emitToolCall: () => {},
      emitToolResult: () => {},
    }
  }
}

/**
 * Wrapper for runAgent that adds tracing calls around agent lifecycle.
 * Usage: import { withAgentTracing } from 'src/services/tracing/integration'
 *
 * Note: This is a stub for environments where the tracing module
 * may not be loaded. For full tracing support, initialize tracing
 * at app startup and import tracing functions directly.
 */
export async function withAgentTracing<T>(
  agentType: string,
  agentId: string,
  parentAgentId: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const tracing = await getTracingIntegration()
  tracing.emitAgentSpawn(agentType, agentId, parentAgentId)

  try {
    const result = await fn()
    tracing.emitAgentEnd(agentType, agentId, true)
    return result
  } catch (error) {
    tracing.emitAgentEnd(agentType, agentId, false)
    throw error
  }
}
