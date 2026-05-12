/**
 * Console emitter - pretty-prints trace events to the console.
 *
 * Useful for development and debugging. Only active when
 * NODE_ENV is 'development' or 'test'.
 */

import type { TraceCallback, TraceEvent } from '../types.js'

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

type ChalkLike = {
  cyan: (s: string) => string
  yellow: (s: string) => string
  green: (s: string) => string
  red: (s: string) => string
  gray: (s: string) => string
  bold: (s: string) => string
}

// Simple ANSI color codes (no external chalk dependency)
const colors: ChalkLike = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

const eventColors: Record<string, keyof ChalkLike> = {
  'trace.start': 'cyan',
  'trace.end': 'cyan',
  'turn.start': 'yellow',
  'turn.end': 'yellow',
  'tool.call': 'green',
  'tool.result': 'green',
  'model.call': 'cyan',
  'model.result': 'cyan',
  'agent.spawn': 'yellow',
  'agent.end': 'yellow',
  'error.occurred': 'red',
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString()
}

function formatEvent(event: TraceEvent): string {
  const colorFn = eventColors[event.type] ?? 'gray'
  const coloredType = colors[colorFn](`[${event.type}]`)
  const ts = colors.gray(formatTimestamp(event.timestamp))
  const runId = event.runId ? colors.gray(` run=${event.runId.slice(0, 8)}`) : ''

  let dataStr = ''
  const { data } = event
  if (data) {
    const entries = Object.entries(data)
    if (entries.length > 0) {
      dataStr = ' ' + entries
        .slice(0, 5)
        .map(([k, v]) => {
          const display =
            typeof v === 'string'
              ? v.slice(0, 50)
              : JSON.stringify(v)?.slice(0, 50) ?? String(v)
          return `${k}=${display}`
        })
        .join(' ')
    }
  }

  return `${ts} ${coloredType}${runId}${dataStr}`
}

export function createConsoleEmitter(): TraceCallback {
  if (!isDev) {
    // No-op in production
    return {}
  }

  return {
    onTraceStart(sessionId: string) {
      console.log(colors.bold(`\n🔍 Tracing started: ${sessionId}\n`))
    },

    onTurnStart(turnNumber: number, runId: string) {
      console.log(
        colors.yellow(`  ↳ Turn ${turnNumber} started`) +
          colors.gray(` (run=${runId.slice(0, 8)})`),
      )
    },

    onTurnEnd(turnNumber: number, runId: string, toolResultCount: number) {
      console.log(
        colors.yellow(`  ↳ Turn ${turnNumber} ended`) +
          colors.gray(` - ${toolResultCount} tool results`),
      )
    },

    onToolCall(toolName: string, _args: Record<string, unknown>, runId: string) {
      console.log(
        `    ${colors.green('→')} ${colors.bold(toolName)}` +
          colors.gray(` (run=${runId.slice(0, 8)})`),
      )
    },

    onToolResult(toolName: string, result: Record<string, unknown>, _runId: string) {
      const status = result.success ? colors.green('✓') : colors.red('✗')
      const hasError = result.error ? colors.red(`: ${String(result.error).slice(0, 50)}`) : ''
      console.log(`    ${status} ${toolName}${hasError}`)
    },

    onModelCall(model: string, inputTokens: number, _runId: string) {
      console.log(
        `  ${colors.cyan('◆')} Model call: ${model}` +
          colors.gray(` ${inputTokens.toLocaleString()} input tokens`),
      )
    },

    onModelResult(model: string, outputTokens: number, durationMs: number, _runId: string) {
      console.log(
        `  ${colors.cyan('◆')} Model result: ${model}` +
          colors.gray(
            ` ${outputTokens.toLocaleString()} output tokens in ${durationMs}ms`,
          ),
      )
    },

    onAgentSpawn(agentType: string, runId: string, parentRunId?: string) {
      const parent = parentRunId ? colors.gray(` from=${parentRunId.slice(0, 8)}`) : ''
      console.log(
        colors.yellow(`  ↗ Spawned`) +
          ` ${colors.bold(agentType)}` +
          colors.gray(` id=${runId.slice(0, 8)}${parent}`),
      )
    },

    onAgentEnd(agentType: string, _runId: string, success: boolean) {
      const status = success ? colors.green('✓') : colors.red('✗')
      console.log(`  ${status} ${colors.bold(agentType)} ended`)
    },

    onError(error: Error, context: Record<string, unknown>) {
      const ctxStr =
        Object.keys(context).length > 0 ? ` ${JSON.stringify(context).slice(0, 100)}` : ''
      console.error(
        colors.red(`  ✗ Error:`) +
          ` ${error.message}${ctxStr}`,
      )
    },

    onEvent(event: TraceEvent) {
      if (
        event.type === 'trace.start' ||
        event.type === 'trace.end'
      ) {
        return // Handled by dedicated callbacks
      }
      console.log(formatEvent(event))
    },

    onTraceEnd(_sessionId: string, durationMs: number) {
      console.log(
        colors.bold(`\n🔍 Tracing ended`) +
          colors.gray(` - total ${durationMs}ms\n`),
      )
    },
  }
}
