export type ParsedSpawnArgs = {
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
