/**
 * Metrics emitter - aggregates tracing metrics.
 *
 * Tracks token usage, latency, tool call counts, and other metrics
 * across the lifetime of a tracing session.
 */

import type { TraceCallback, TracingMetrics } from '../types.js'

export interface MetricsEmitterOptions {
  onMetricsUpdate?: (metrics: TracingMetrics) => void
}

export function createMetricsEmitter(
  options: MetricsEmitterOptions = {},
): TraceCallback & { getMetrics: () => TracingMetrics } {
  const metrics: TracingMetrics = {
    totalEvents: 0,
    totalTurns: 0,
    totalToolCalls: 0,
    totalAgentSpawns: 0,
    totalErrors: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalDurationMs: 0,
    toolCallCounts: {},
    modelCallCounts: {},
    turnDurationsMs: {},
  }

  let turnStartTimes: Record<number, number> = {}

  function notifyUpdate(): void {
    options.onMetricsUpdate?.(getMetrics())
  }

  function getMetrics(): TracingMetrics {
    return { ...metrics }
  }

  return {
    getMetrics,

    onTraceStart() {
      // Reset metrics on new trace
      metrics.totalEvents = 0
      metrics.totalTurns = 0
      metrics.totalToolCalls = 0
      metrics.totalAgentSpawns = 0
      metrics.totalErrors = 0
      metrics.totalInputTokens = 0
      metrics.totalOutputTokens = 0
      metrics.totalDurationMs = 0
      metrics.toolCallCounts = {}
      metrics.modelCallCounts = {}
      metrics.turnDurationsMs = {}
      turnStartTimes = {}
    },

    onTurnStart(turnNumber: number) {
      metrics.totalTurns++
      turnStartTimes[turnNumber] = Date.now()
      metrics.totalEvents++
      notifyUpdate()
    },

    onTurnEnd(turnNumber: number, _runId: string, _toolResultCount: number) {
      const startTime = turnStartTimes[turnNumber]
      if (startTime) {
        const duration = Date.now() - startTime
        metrics.turnDurationsMs[turnNumber] = duration
        metrics.totalDurationMs += duration
        delete turnStartTimes[turnNumber]
      }
      metrics.totalEvents++
      notifyUpdate()
    },

    onToolCall(toolName: string) {
      metrics.totalToolCalls++
      metrics.toolCallCounts[toolName] = (metrics.toolCallCounts[toolName] ?? 0) + 1
      metrics.totalEvents++
      notifyUpdate()
    },

    onToolResult() {
      metrics.totalEvents++
      notifyUpdate()
    },

    onModelCall(model: string, inputTokens: number) {
      metrics.totalInputTokens += inputTokens
      metrics.modelCallCounts[model] = (metrics.modelCallCounts[model] ?? 0) + 1
      metrics.totalEvents++
      notifyUpdate()
    },

    onModelResult(model: string, outputTokens: number, durationMs: number) {
      metrics.totalOutputTokens += outputTokens
      metrics.totalDurationMs += durationMs
      metrics.totalEvents++
      notifyUpdate()
    },

    onAgentSpawn(agentType: string) {
      metrics.totalAgentSpawns++
      metrics.modelCallCounts[agentType] = (metrics.modelCallCounts[agentType] ?? 0) + 1
      metrics.totalEvents++
      notifyUpdate()
    },

    onAgentEnd() {
      metrics.totalEvents++
      notifyUpdate()
    },

    onError() {
      metrics.totalErrors++
      metrics.totalEvents++
      notifyUpdate()
    },

    onEvent(event) {
      metrics.totalEvents++
      notifyUpdate()
    },
  }
}
