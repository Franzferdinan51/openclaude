/**
 * TraceManager - Singleton that manages registered tracing callbacks and event emission.
 *
 * This is the central hub for Duck CLI's tracing system. Callbacks register
 * themselves to receive lifecycle events (turns, tool calls, model calls, etc.).
 */

import { randomUUID } from 'crypto'
import type {
  Span,
  TraceCallback,
  TraceEvent,
  TraceEventType,
  TracingConfig,
} from './types.js'
import {
  DEFAULT_TRACING_CONFIG,
  isTracingEnabled,
  shouldExcludeEvent,
} from './types.js'

let instance: TraceManager | null = null

export class TraceManager {
  private readonly callbacks = new Set<TraceCallback>()
  private config: TracingConfig = DEFAULT_TRACING_CONFIG
  private sessionId: string | undefined
  private isActive = false
  private traceStartTime: number | undefined

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): TraceManager {
    if (!instance) {
      instance = new TraceManager()
    }
    return instance
  }

  /**
   * Initialize tracing with the given configuration.
   * Registers default emitters if level is not 'off'.
   */
  init(config: TracingConfig = DEFAULT_TRACING_CONFIG): void {
    this.config = config
    this.sessionId = config.sessionId ?? randomUUID()
    this.isActive = isTracingEnabled(config)

    if (this.isActive) {
      this.traceStartTime = Date.now()
      this.emitToCallbacks('onTraceStart', this.sessionId, config)
    }
  }

  /**
   * Register a callback and return a deregistration function.
   */
  registerCallback(callback: TraceCallback): () => void {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Check if tracing is currently active.
   */
  isTracingActive(): boolean {
    return this.isActive
  }

  /**
   * Get the current tracing configuration.
   */
  getConfig(): TracingConfig {
    return { ...this.config }
  }

  /**
   * Get the current session ID.
   */
  getSessionId(): string | undefined {
    return this.sessionId
  }

  /**
   * Create a new span for nested tracing.
   */
  createSpan(name: string, parent?: string): Span {
    const span: Span = {
      name,
      spanId: randomUUID(),
      parentSpanId: parent,
      startTime: Date.now(),
      metadata: {},
      childSpans: [],
    }
    return span
  }

  /**
   * End a span and record its duration.
   */
  endSpan(span: Span, metadata?: Record<string, unknown>): Span {
    span.endTime = Date.now()
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata }
    }
    return span
  }

  /**
   * Emit a trace event to all registered callbacks.
   */
  emit(event: TraceEvent): void {
    if (!this.isActive) return
    if (shouldExcludeEvent(this.config, event.type)) return

    // Attach session context if available
    const enrichedEvent: TraceEvent = {
      ...event,
      sessionId: event.sessionId ?? this.sessionId,
    }

    for (const callback of this.callbacks) {
      try {
        callback.onEvent?.(enrichedEvent)
      } catch {
        // Swallow callback errors to avoid breaking other callbacks
      }
    }
  }

  /**
   * Emit a specific lifecycle event by type.
   */
  emitByType(
    type: TraceEventType,
    data: Record<string, unknown>,
    runId?: string,
  ): void {
    const event: TraceEvent = {
      type,
      timestamp: Date.now(),
      runId,
      sessionId: this.sessionId,
      data,
    }
    this.emit(event)
  }

  /**
   * Emit turn start event.
   */
  emitTurnStart(turnNumber: number, runId: string): void {
    this.emitByType('turn.start', { turnNumber }, runId)
    for (const callback of this.callbacks) {
      try {
        callback.onTurnStart?.(turnNumber, runId)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Emit turn end event.
   */
  emitTurnEnd(turnNumber: number, runId: string, toolResultCount: number): void {
    this.emitByType('turn.end', { turnNumber, toolResultCount }, runId)
    for (const callback of this.callbacks) {
      try {
        callback.onTurnEnd?.(turnNumber, runId, toolResultCount)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Emit tool call event.
   */
  emitToolCall(toolName: string, args: Record<string, unknown>, runId: string): void {
    this.emitByType('tool.call', { toolName, args }, runId)
    for (const callback of this.callbacks) {
      try {
        callback.onToolCall?.(toolName, args, runId)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Emit tool result event.
   */
  emitToolResult(
    toolName: string,
    result: Record<string, unknown>,
    runId: string,
  ): void {
    this.emitByType('tool.result', { toolName, result }, runId)
    for (const callback of this.callbacks) {
      try {
        callback.onToolResult?.(toolName, result, runId)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Emit model call event.
   */
  emitModelCall(model: string, inputTokens: number, runId: string): void {
    this.emitByType('model.call', { model, inputTokens }, runId)
    for (const callback of this.callbacks) {
      try {
        callback.onModelCall?.(model, inputTokens, runId)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Emit model result event.
   */
  emitModelResult(
    model: string,
    outputTokens: number,
    durationMs: number,
    runId: string,
  ): void {
    this.emitByType('model.result', { model, outputTokens, durationMs }, runId)
    for (const callback of this.callbacks) {
      try {
        callback.onModelResult?.(model, outputTokens, durationMs, runId)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Emit agent spawn event.
   */
  emitAgentSpawn(
    agentType: string,
    runId: string,
    parentRunId?: string,
  ): void {
    this.emitByType('agent.spawn', { agentType, parentRunId }, runId)
    for (const callback of this.callbacks) {
      try {
        callback.onAgentSpawn?.(agentType, runId, parentRunId)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Emit agent end event.
   */
  emitAgentEnd(agentType: string, runId: string, success: boolean): void {
    this.emitByType('agent.end', { agentType, success }, runId)
    for (const callback of this.callbacks) {
      try {
        callback.onAgentEnd?.(agentType, runId, success)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Emit error occurred event.
   */
  emitError(error: Error, context: Record<string, unknown>): void {
    this.emitByType('error.occurred', {
      errorMessage: error.message,
      errorName: error.name,
      stack: error.stack,
      context,
    })
    for (const callback of this.callbacks) {
      try {
        callback.onError?.(error, context)
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Shutdown tracing and notify callbacks of trace end.
   */
  shutdown(): void {
    if (this.traceStartTime && this.sessionId) {
      const durationMs = Date.now() - this.traceStartTime
      this.emitByType('trace.end', { durationMs })
      for (const callback of this.callbacks) {
        try {
          callback.onTraceEnd?.(this.sessionId, durationMs)
        } catch {
          // Swallow
        }
      }
    }
    this.isActive = false
    this.traceStartTime = undefined
  }

  // Private helper to emit to specific callback methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private emitToCallbacks(method: keyof TraceCallback, ...args: any[]): void {
    for (const callback of this.callbacks) {
      try {
        const fn = callback[method]
        if (typeof fn === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(fn as (...args: any[]) => void).call(callback, ...args)
        }
      } catch {
        // Swallow
      }
    }
  }
}

/**
 * Get the global TraceManager instance.
 */
export function getTraceManager(): TraceManager {
  return TraceManager.getInstance()
}
