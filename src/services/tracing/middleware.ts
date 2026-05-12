/**
 * Tracing middleware - Express-style middleware for wrapping agent turns with tracing.
 *
 * This middleware:
 * - Automatically emits turn start/end events
 * - Injects trace context into tool calls
 * - Reports model call events
 * - Tracks agent lifecycle
 *
 * It integrates with the existing AgentRunStore event system.
 */

import type { Span } from './types.js'
import { createSpan, endSpan, emitTurnStart, emitTurnEnd } from './index.js'

export interface TracingMiddlewareContext {
  runId: string
  sessionId?: string
  turnNumber?: { current: number }
}

/**
 * Create tracing middleware for agent turns.
 *
 * Attach to your agent run context:
 * ```typescript
 * const ctx = createTracingMiddleware({
 *   runId: run.id,
 *   sessionId: session.id,
 *   turnNumber: { current: 1 },
 * })
 * ```
 */
export function createTracingMiddleware(
  initialContext: TracingMiddlewareContext,
) {
  const context = { ...initialContext }
  const turnSpans: Span[] = []

  return {
    /**
     * Get current tracing context.
     */
    getContext(): TracingMiddlewareContext {
      return { ...context }
    },

    /**
     * Update tracing context (e.g., with new runId).
     */
    updateContext(updates: Partial<TracingMiddlewareContext>): void {
      Object.assign(context, updates)
    },

    /**
     * Mark the start of a turn. Returns a span for the turn.
     */
    onTurnStart(): Span {
      const turnNumber = context.turnNumber?.current ?? 1
      const span = createSpan(`turn-${turnNumber}`, context.runId)
      turnSpans.push(span)
      emitTurnStart(turnNumber, context.runId)
      return span
    },

    /**
     * Mark the end of a turn.
     */
    onTurnEnd(toolResultCount: number, span?: Span): void {
      const turnNumber = context.turnNumber?.current ?? 1
      emitTurnEnd(turnNumber, context.runId, toolResultCount)

      // End the turn span if provided
      if (span) {
        endSpan(span, { toolResultCount, turnNumber })
      }

      // Increment turn number if tracking
      if (context.turnNumber) {
        context.turnNumber.current++
      }
    },

    /**
     * Create a child span within the current turn.
     */
    createChildSpan(name: string): Span {
      const parentSpan = turnSpans[turnSpans.length - 1]
      return createSpan(name, parentSpan?.spanId)
    },
  }
}

/**
 * Create a tool-call wrapper that automatically traces tool execution.
 *
 * Usage:
 * ```typescript
 * const traceToolCall = createToolTracer({ runId: run.id })
 *
 * // Instead of calling tool directly:
 * const result = await tool.handler(args)
 *
 * // Call via tracer:
 * const result = await traceToolCall(tool.name, () => tool.handler(args))
 * ```
 */
export function createToolTracer(context: TracingMiddlewareContext) {
  return async function traceToolCall<T>(
    toolName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const { emitToolCall, emitToolResult } = await import('./index.js')

    emitToolCall(toolName, {}, context.runId)

    try {
      const result = await fn()
      emitToolResult(toolName, { success: true }, context.runId)
      return result
    } catch (error) {
      emitToolResult(toolName, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, context.runId)
      throw error
    }
  }
}

/**
 * Create a model call tracer.
 */
export function createModelTracer(context: TracingMiddlewareContext) {
  return {
    async traceCall<T>(
      model: string,
      inputTokens: number,
      fn: () => Promise<T>,
    ): Promise<T> {
      const { emitModelCall, emitModelResult } = await import('./index.js')

      emitModelCall(model, inputTokens, context.runId)
      const startTime = Date.now()

      try {
        const result = await fn()
        const duration = Date.now() - startTime
        emitModelResult(model, 0, duration, context.runId) // output tokens would come from result
        return result
      } catch (error) {
        const duration = Date.now() - startTime
        emitModelResult(model, 0, duration, context.runId)
        throw error
      }
    },
  }
}
