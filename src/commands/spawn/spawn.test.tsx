import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'
import stripAnsi from 'strip-ansi'
import { createRoot } from '../../ink.js'

const SYNC_START = '\x1B[?2026h'
const SYNC_END = '\x1B[?2026l'

function extractLastFrame(output: string): string {
  let lastFrame: string | null = null
  let cursor = 0

  while (cursor < output.length) {
    const start = output.indexOf(SYNC_START, cursor)
    if (start === -1) break
    const contentStart = start + SYNC_START.length
    const end = output.indexOf(SYNC_END, contentStart)
    if (end === -1) break
    const frame = output.slice(contentStart, end)
    if (frame.trim().length > 0) lastFrame = frame
    cursor = end + SYNC_END.length
  }

  return lastFrame ?? output
}

async function renderSpawnAndWait(node: React.ReactNode): Promise<string> {
  let output = ''
  const stdout = new PassThrough()
  const stdin = new PassThrough()
  stdout.on('data', chunk => {
    output += chunk.toString()
  })

  const root = await createRoot({
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    patchConsole: false,
  })

  root.render(node)

  const startedAt = Date.now()
  while (Date.now() - startedAt < 3000) {
    const frame = stripAnsi(extractLastFrame(output))
    if (frame.includes('Spawned') || frame.includes('Error:')) {
      root.unmount()
      stdin.end()
      stdout.end()
      return frame
    }
    await Bun.sleep(10)
  }

  root.unmount()
  stdin.end()
  stdout.end()
  throw new Error('Timed out waiting for Spawn component output')
}

describe('/spawn command UI', () => {
  beforeEach(() => {
    mock.module('../../subagentSystem.js', () => ({
      sessions_spawn: mock(async ({ task }: { task: string }) => `spawned:${task}`),
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test('auto-spawns on mount when given a task', async () => {
    const { default: Spawn } = await import(
      `./spawn.tsx?spawn-test=${Date.now()}-${Math.random()}`
    )

    const output = await renderSpawnAndWait(
      <Spawn args={['investigate', 'agent', 'routing']} context={{} as never} />,
    )

    expect(output).toContain('Subagent Spawn')
    expect(output).toContain('Task: investigate agent routing')
    expect(output).toContain('Status: Spawned')
    expect(output).toContain('spawned:investigate agent routing')
  })
})
