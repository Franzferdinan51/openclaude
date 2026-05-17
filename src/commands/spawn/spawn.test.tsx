import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'
import stripAnsi from 'strip-ansi'
import { createRoot } from '../../ink.js'
import { parseSpawnArgs } from './parseSpawnArgs.ts'
import { call } from './spawn.tsx'

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
  const sessionsSpawn = mock(
    async ({
      task,
      label,
    }: {
      task: string
      label?: string
    }) => `spawned:${label ?? 'none'}:${task}`,
  )

  beforeEach(() => {
    mock.module('../../subagentSystem.js', () => ({
      sessions_spawn: sessionsSpawn,
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
    expect(output).toContain('spawned:spawned-agent:investigate agent routing')
  })

  test('passes a custom --label through to sessions_spawn', async () => {
    const { default: Spawn } = await import(
      `./spawn.tsx?spawn-test=${Date.now()}-${Math.random()}`
    )

    const output = await renderSpawnAndWait(
      <Spawn
        args={['implement', 'router', '--label=reviewer']}
        context={{} as never}
      />,
    )

    expect(output).toContain('Task: implement router')
    expect(output).toContain('Label: reviewer')
    expect(output).toContain('spawned:reviewer:implement router')
    expect(sessionsSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'reviewer',
        task: 'implement router',
      }),
    )
  })

  test('supports README-style spawn prefix, agent type, and explicit model', async () => {
    const { default: Spawn } = await import(
      `./spawn.tsx?spawn-test=${Date.now()}-${Math.random()}`
    )

    const output = await renderSpawnAndWait(
      <Spawn
        args={['spawn', 'coding', 'Implement', 'a', 'REST', 'API', '--model', 'qwen3.6-35b']}
        context={{} as never}
      />,
    )

    expect(output).toContain('Task: Implement a REST API')
    expect(output).toContain('Agent type: coding')
    expect(output).toContain('Model: qwen3.6-35b')
    expect(sessionsSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'coding',
        model: 'qwen3.6-35b',
        task: 'Implement a REST API',
      }),
    )
  })

  test('returns provider-free help in noninteractive slash mode', async () => {
    const completions: string[] = []

    const rendered = await call(
      result => {
        if (result) completions.push(result)
      },
      {
        options: {
          isNonInteractiveSession: true,
        },
      } as never,
      '--help',
    )

    expect(rendered).toBeNull()
    expect(completions.join('\n')).toContain('DuckHive spawn - Hermes-style subagent spawning')
    expect(completions.join('\n')).toContain('/subagent spawn coding "Implement a REST API"')
  })
})

describe('parseSpawnArgs', () => {
  test('extracts --label=value without polluting the task text', () => {
    expect(
      parseSpawnArgs(['analyze', 'routing', '--label=reviewer']),
    ).toEqual({
      task: 'analyze routing',
      label: 'reviewer',
    })
  })

  test('extracts --label <value> form and leaves other words in the task', () => {
    expect(
      parseSpawnArgs(['analyze', '--label', 'reviewer', 'routing']),
    ).toEqual({
      task: 'analyze routing',
      label: 'reviewer',
    })
  })

  test('supports optional spawn prefix plus agent type and --model', () => {
    expect(
      parseSpawnArgs(['spawn', 'coding', 'Implement', 'REST', 'API', '--model=qwen3.6-35b']),
    ).toEqual({
      agentType: 'coding',
      model: 'qwen3.6-35b',
      task: 'Implement REST API',
      label: undefined,
    })
  })
})
