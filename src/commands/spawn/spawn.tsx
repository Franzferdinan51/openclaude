/**
 * Spawn Command - Subagent Teammate Spawning
 *
 * Provides a UI for spawning subagent teammates.
 */

import React, { useState } from 'react'
import { Box, Text } from '../../ink.js'
import { sessions_spawn } from '../../subagentSystem.js'
import type { ToolUseContext } from '../../Tool.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { parseSpawnArgs } from './parseSpawnArgs.js'

const SPAWN_USAGE = `DuckHive spawn - Hermes-style subagent spawning

Usage:
  /spawn <task description>
  /spawn spawn <agent-type> <task description> [--model <model>]
  /spawn <task description> --label <name>
  /subagent spawn coding "Implement a REST API"

Terminal:
  duckhive spawn <task description>
  duckhive subagent spawn coding "Audit router" --model qwen3.6-35b

Headless /spawn help is provider-free. Use top-level duckhive spawn/subagent for queued AgentRun execution outside the REPL.`

interface SpawnProps {
  args: string[]
  context: ToolUseContext
}

export function Spawn({ args, context }: SpawnProps) {
  const [status, setStatus] = useState<string>('Ready')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { task, label, model, agentType } = parseSpawnArgs(args)

  const handleSpawn = async () => {
    if (!task) {
      setError('No task specified. Usage: /spawn <task description>')
      return
    }

    setStatus('Spawning subagent...')
    setError(null)

    try {
      const spawnResult = await sessions_spawn({
        agentType,
        label: label ?? 'spawned-agent',
        model,
        task,
        context,
      })
      setResult(spawnResult)
      setStatus('Spawned')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('Failed')
    }
  }

  // Auto-spawn on mount if task provided
  React.useEffect(() => {
    if (task) {
      handleSpawn()
    }
  }, [])

  return (
    <Box flexDirection="column">
      <Text bold>Subagent Spawn</Text>
      <Text dimColor>Task: {task || '(none)'}</Text>
      {agentType && <Text dimColor>Agent type: {agentType}</Text>}
      {label && <Text dimColor>Label: {label}</Text>}
      {model && <Text dimColor>Model: {model}</Text>}
      <Text dimColor>Status: {status}</Text>
      {result && (
        <Box marginTop={1}>
          <Text>{result}</Text>
        </Box>
      )}
      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
    </Box>
  )
}

function splitSpawnCommandArgs(args: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let tokenStarted = false

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!

    if (quote) {
      if (ch === quote) {
        quote = null
        continue
      }
      if (ch === '\\' && i + 1 < args.length) {
        const next = args[i + 1]!
        if (next === quote || next === '\\') {
          current += next
          i += 1
          continue
        }
      }
      current += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      tokenStarted = true
      continue
    }

    if (/\s/.test(ch)) {
      if (tokenStarted) {
        tokens.push(current)
        current = ''
        tokenStarted = false
      }
      continue
    }

    current += ch
    tokenStarted = true
  }

  if (tokenStarted) tokens.push(current)
  return tokens
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext,
  args: string,
): Promise<React.ReactNode> {
  const trimmed = args.trim().toLowerCase()
  if (
    trimmed === '' ||
    trimmed === 'help' ||
    trimmed === '--help' ||
    trimmed === '-h' ||
    context.options.isNonInteractiveSession
  ) {
    onDone(SPAWN_USAGE, { display: 'system' })
    return null
  }

  return <Spawn args={splitSpawnCommandArgs(args)} context={context} />
}

export default Spawn
