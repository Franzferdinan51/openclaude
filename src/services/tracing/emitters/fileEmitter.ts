/**
 * File emitter - writes trace events to a .trace.jsonl file.
 *
 * Each line is a JSON object representing one trace event.
 * Useful for persistence and later analysis.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { TraceCallback, TraceEvent } from '../types.js'

const TRACE_FILE_NAME = '.trace.jsonl'

export interface FileEmitterOptions {
  dir?: string
  sessionId?: string
}

/**
 * Create a file emitter that writes events to a .trace.jsonl file.
 */
export function createFileEmitter(
  options: FileEmitterOptions = {},
): TraceCallback {
  let filePath: string | undefined
  let eventCount = 0

  return {
    onTraceStart(sessionId: string) {
      const dir = options.dir ?? process.cwd()
      const baseSessionId = options.sessionId ?? sessionId
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      filePath = join(dir, `${baseSessionId}.${TRACE_FILE_NAME}`)
      eventCount = 0
    },

    onEvent(event: TraceEvent) {
      if (!filePath) return
      try {
        const line = JSON.stringify(event) + '\n'
        appendFileSync(filePath, line, 'utf8')
        eventCount++
      } catch {
        // Swallow file write errors
      }
    },

    onTraceEnd(sessionId: string, durationMs: number) {
      if (!filePath) return
      try {
        const summary = JSON.stringify({
          type: 'trace.summary',
          sessionId,
          durationMs,
          totalEvents: eventCount,
          timestamp: Date.now(),
        }) + '\n'
        appendFileSync(filePath, summary, 'utf8')
      } catch {
        // Swallow
      }
    },
  }
}
