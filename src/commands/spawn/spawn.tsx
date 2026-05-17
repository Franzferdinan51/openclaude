/**
 * Spawn Command - Subagent Teammate Spawning
 *
 * Provides a UI for spawning subagent teammates.
 */

import React, { useState } from 'react'
import { Box, Text } from '../../ink.js'
import { sessions_spawn } from '../../subagentSystem.js'
import type { ToolUseContext } from '../../Tool.js'

interface SpawnProps {
  args: string[]
  context: ToolUseContext
}

type ParsedSpawnArgs = {
  agentType?: string
  model?: string
  task: string
  label?: string
}

export function parseSpawnArgs(args: string[]): ParsedSpawnArgs {
  const positional: string[] = []
  let label: string | undefined
  let model: string | undefined
  const hasExplicitSpawnKeyword = args[0]?.toLowerCase() === 'spawn'

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (!arg) continue

    if (index === 0 && arg.toLowerCase() === 'spawn') {
      continue
    }

    if (arg.startsWith('--label=')) {
      const value = arg.slice('--label='.length).trim()
      label = value || label
      continue
    }

    if (arg === '--label') {
      const value = args[index + 1]?.trim()
      if (value) {
        label = value
        index += 1
      }
      continue
    }

    if (arg.startsWith('--model=')) {
      const value = arg.slice('--model='.length).trim()
      model = value || model
      continue
    }

    if (arg === '--model') {
      const value = args[index + 1]?.trim()
      if (value) {
        model = value
        index += 1
      }
      continue
    }

    positional.push(arg)
  }

  let agentType: string | undefined
  let taskParts = positional
  if (hasExplicitSpawnKeyword && positional.length > 1) {
    agentType = positional[0]
    taskParts = positional.slice(1)
  }

  return {
    agentType,
    model,
    task: taskParts.join(' ').trim(),
    label,
  }
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

export default Spawn
