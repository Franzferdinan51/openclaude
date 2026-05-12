/**
 * Tracing types for Duck CLI's callback-based observability system.
 *
 * Provides structured types for lifecycle events, spans, and callback configuration.
 */

export type TraceEventType =
  | 'trace.start'
  | 'trace.end'
  | 'turn.start'
  | 'turn.end'
  | 'tool.call'
  | 'tool.result'
  | 'model.call'
  | 'model.result'
  | 'agent.spawn'
  | 'agent.end'
  | 'error.occurred'

export type TracingLevel = 'off' | 'basic' | 'verbose'

export interface TraceEvent {
  type: TraceEventType
  timestamp: number
  sessionId?: string
  runId?: string
  spanId?: string
  parentSpanId?: string
  data: Record<string, unknown>
}

export interface Span {
  name: string
  spanId: string
  parentSpanId?: string
  startTime: number
  endTime?: number
  metadata: Record<string, unknown>
  childSpans: Span[]
}

export interface TracingConfig {
  level: TracingLevel
  sessionId?: string
  runId?: string
  includeMetadata?: boolean
  filters?: {
    excludeEvents?: TraceEventType[]
    excludePatterns?: string[]
  }
}

/**
 * Core callback interface for receiving trace events.
 * Implement this to create custom trace consumers.
 */
export interface TraceCallback {
  onTraceStart?(sessionId: string, config: TracingConfig): void
  onTraceEnd?(sessionId: string, durationMs: number): void
  onTurnStart?(turnNumber: number, runId: string): void
  onTurnEnd?(turnNumber: number, runId: string, toolResultCount: number): void
  onToolCall?(toolName: string, args: Record<string, unknown>, runId: string): void
  onToolResult?(toolName: string, result: Record<string, unknown>, runId: string): void
  onModelCall?(model: string, inputTokens: number, runId: string): void
  onModelResult?(model: string, outputTokens: number, durationMs: number, runId: string): void
  onAgentSpawn?(agentType: string, runId: string, parentRunId?: string): void
  onAgentEnd?(agentType: string, runId: string, success: boolean): void
  onError?(error: Error, context: Record<string, unknown>): void
  onEvent?(event: TraceEvent): void
}

/**
 * Metrics aggregated by the metrics emitter.
 */
export interface TracingMetrics {
  totalEvents: number
  totalTurns: number
  totalToolCalls: number
  totalAgentSpawns: number
  totalErrors: number
  totalInputTokens: number
  totalOutputTokens: number
  totalDurationMs: number
  toolCallCounts: Record<string, number>
  modelCallCounts: Record<string, number>
  turnDurationsMs: Record<number, number>
}

export const DEFAULT_TRACING_CONFIG: TracingConfig = {
  level: 'off',
  includeMetadata: false,
  filters: {
    excludeEvents: [],
    excludePatterns: [],
  },
}

export function isTracingEnabled(config: TracingConfig): boolean {
  return config.level !== 'off'
}

export function shouldExcludeEvent(
  config: TracingConfig,
  eventType: TraceEventType,
): boolean {
  if (!config.filters?.excludeEvents) return false
  return config.filters.excludeEvents.includes(eventType)
}
