/**
 * Tracing service - public API for Duck CLI's callback-based observability system.
 *
 * This module provides a unified tracing interface that integrates with Duck CLI's
 * lifecycle events. It is additive and configurable - tracing is off by default
 * for performance.
 *
 * Usage:
 * ```typescript
 * import { initTracing, createSpan, wrapAsync } from 'src/services/tracing'
 *
 * // Initialize with default emitters (console in dev, file)
 * initTracing({ level: 'basic' })
 *
 * // Or with explicit emitters
 * import { createFileEmitter, createConsoleEmitter } from './emitters'
 * initTracing({
 *   level: 'verbose',
 *   sessionId: mySessionId,
 *   emitters: [createFileEmitter(), createConsoleEmitter()]
 * })
 *
 * // Create spans for manual instrumentation
 * const span = createSpan('my-operation')
 * // ... do work ...
 * endSpan(span, { result: 'success' })
 *
 * // Wrap async functions for automatic tracing
 * const result = await wrapAsync('fetch-data', async () => {
 *   return await fetchFromAPI()
 * })
 * ```
 */

import { randomUUID } from 'crypto'
import type { Span, TracingConfig, TracingMetrics } from './types.js'
import { DEFAULT_TRACING_CONFIG } from './types.js'
import { getTraceManager } from './TraceManager.js'

// Re-export types
export type { TraceEvent, TraceCallback, TracingConfig, TracingMetrics } from './types.js'

// Re-export emitters
export { createFileEmitter } from './emitters/fileEmitter.js'
export { createConsoleEmitter } from './emitters/consoleEmitter.js'
export { createMetricsEmitter } from './emitters/metricsEmitter.js'
export type { FileEmitterOptions } from './emitters/fileEmitter.js'
export type { MetricsEmitterOptions } from './emitters/metricsEmitter.js'

/**
 * Initialize tracing with the given configuration.
 * Default emitters (console in dev, file) are registered if level is not 'off'.
 */
export function initTracing(config: TracingConfig = DEFAULT_TRACING_CONFIG): void {
  const manager = getTraceManager()
  manager.init(config)
}

/**
 * Get the current tracing configuration.
 */
export function getTracingConfig(): TracingConfig {
  return getTraceManager().getConfig()
}

/**
 * Check if tracing is currently active.
 */
export function isTracingActive(): boolean {
  return getTraceManager().isTracingActive()
}

/**
 * Register a custom tracing callback.
 * Returns a deregistration function.
 */
export function registerTracingCallback(
  callback: Parameters<ReturnType<typeof getTraceManager>['registerCallback']>[0],
): () => void {
  return getTraceManager().registerCallback(callback)
}

/**
 * Create a new span for manual instrumentation.
 * Spans track start time, end time, metadata, and child spans.
 */
export function createSpan(name: string, parentSpanId?: string): Span {
  return getTraceManager().createSpan(name, parentSpanId)
}

/**
 * End a span and record its duration.
 */
export function endSpan(span: Span, metadata?: Record<string, unknown>): Span {
  return getTraceManager().endSpan(span, metadata)
}

/**
 * Emit a turn start event.
 */
export function emitTurnStart(turnNumber: number, runId: string): void {
  getTraceManager().emitTurnStart(turnNumber, runId)
}

/**
 * Emit a turn end event.
 */
export function emitTurnEnd(
  turnNumber: number,
  runId: string,
  toolResultCount: number,
): void {
  getTraceManager().emitTurnEnd(turnNumber, runId, toolResultCount)
}

/**
 * Emit a tool call event.
 */
export function emitToolCall(
  toolName: string,
  args: Record<string, unknown>,
  runId: string,
): void {
  getTraceManager().emitToolCall(toolName, args, runId)
}

/**
 * Emit a tool result event.
 */
export function emitToolResult(
  toolName: string,
  result: Record<string, unknown>,
  runId: string,
): void {
  getTraceManager().emitToolResult(toolName, result, runId)
}

/**
 * Emit a model call event.
 */
export function emitModelCall(model: string, inputTokens: number, runId: string): void {
  getTraceManager().emitModelCall(model, inputTokens, runId)
}

/**
 * Emit a model result event.
 */
export function emitModelResult(
  model: string,
  outputTokens: number,
  durationMs: number,
  runId: string,
): void {
  getTraceManager().emitModelResult(model, outputTokens, durationMs, runId)
}

/**
 * Emit an agent spawn event.
 */
export function emitAgentSpawn(
  agentType: string,
  runId: string,
  parentRunId?: string,
): void {
  getTraceManager().emitAgentSpawn(agentType, runId, parentRunId)
}

/**
 * Emit an agent end event.
 */
export function emitAgentEnd(agentType: string, runId: string, success: boolean): void {
  getTraceManager().emitAgentEnd(agentType, runId, success)
}

/**
 * Emit an error event.
 */
export function emitError(error: Error, context: Record<string, unknown>): void {
  getTraceManager().emitError(error, context)
}

/**
 * Wrap an async function for automatic tracing.
 * The function is executed and its result is returned normally.
 * Errors propagate and are traced via emitError.
 *
 * ```typescript
 * const result = await wrapAsync('fetch-data', async () => {
 *   return await api.fetch()
 * })
 * ```
 */
export async function wrapAsync<T>(
  name: string,
  fn: () => Promise<T>,
  runId?: string,
): Promise<T> {
  const span = createSpan(name)
  const manager = getTraceManager()

  try {
    const result = await fn()
    manager.endSpan(span, { result: 'success' })
    return result
  } catch (error) {
    manager.endSpan(span, { result: 'error', error: String(error) })
    if (error instanceof Error) {
      manager.emitError(error, { operation: name, runId })
    }
    throw error
  }
}

/**
 * Wrap a sync function for automatic tracing.
 *
 * ```typescript
 * const result = wrapSync('compute', () => {
 *   return heavyComputation()
 * })
 * ```
 */
export function wrapSync<T>(
  name: string,
  fn: () => T,
  runId?: string,
): T {
  const span = createSpan(name)
  const manager = getTraceManager()

  try {
    const result = fn()
    manager.endSpan(span, { result: 'success' })
    return result
  } catch (error) {
    manager.endSpan(span, { result: 'error', error: String(error) })
    if (error instanceof Error) {
      manager.emitError(error, { operation: name, runId })
    }
    throw error
  }
}

/**
 * Shutdown the tracing system.
 */
export function shutdownTracing(): void {
  getTraceManager().shutdown()
}
