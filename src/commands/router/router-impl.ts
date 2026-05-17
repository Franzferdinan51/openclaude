import type { LocalCommandCall } from '../../types/command.js'
import {
  listModels,
  routeTask,
  type ModelInfo,
  type RouteResult,
} from '../../orchestrator/multi-model/multi-model-router.js'

type RouterDeps = {
  routeTask: typeof routeTask
  listModels: typeof listModels
}

let routerTestDeps: Partial<RouterDeps> | null = null

function getRouterDeps(): RouterDeps {
  return {
    routeTask,
    listModels,
    ...routerTestDeps,
  }
}

export function setRouterTestDeps(overrides: Partial<RouterDeps> | null): void {
  routerTestDeps = overrides
}

function splitCommandArgs(args: string): string[] {
  return (
    args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg =>
      arg.replace(/^["']|["']$/g, ''),
    ) ?? []
  )
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return null
}

function usage(error?: string): string {
  const lines = [
    'Model router',
    '',
    'Usage:',
    '  /router route <task> [complexity=<1-10>] [vision=true|false] [functionCalling=true|false] [preferSpeed=true|false] [preferQuality=true|false] [maxCost=<usd>]',
    '  /router list',
    '  /router compare <task> [complexity=<1-10>] [vision=true|false] [functionCalling=true|false]',
    '',
    'Examples:',
    '  /router route "build a Flutter app" complexity=7 vision=true',
    '  /router route "quick text cleanup" --complexity=1 --preferSpeed=true',
    '  /router list',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

type ParsedRequest = {
  action: 'route' | 'list' | 'compare'
  task?: string
  complexity: number
  vision: boolean
  functionCalling: boolean
  preferSpeed: boolean
  preferQuality: boolean
  maxCost?: number
}

function parseArgs(args: string):
  | { ok: true; value: ParsedRequest }
  | { ok: false; error: string } {
  const tokens = splitCommandArgs(args)
  const action = (tokens[0]?.toLowerCase() ?? 'list') as ParsedRequest['action']

  if (!['route', 'list', 'compare'].includes(action)) {
    return { ok: false, error: `Unknown router action: ${tokens[0]}` }
  }

  const parsed: ParsedRequest = {
    action,
    complexity: 5,
    vision: false,
    functionCalling: false,
    preferSpeed: false,
    preferQuality: false,
  }

  const positional: string[] = []

  for (const token of tokens.slice(1)) {
    const normalized = token.startsWith('--') ? token.slice(2) : token
    const [key, value] = normalized.split(/=(.*)/s, 2)

    if (value === undefined) {
      positional.push(token)
      continue
    }

    if (key === 'complexity') {
      const complexity = Number(value)
      if (!Number.isFinite(complexity) || complexity < 1 || complexity > 10) {
        return {
          ok: false,
          error: `complexity must be a number from 1 to 10: ${value}`,
        }
      }
      parsed.complexity = complexity
      continue
    }

    if (key === 'maxCost') {
      const maxCost = Number(value)
      if (!Number.isFinite(maxCost) || maxCost < 0) {
        return { ok: false, error: `maxCost must be a non-negative number: ${value}` }
      }
      parsed.maxCost = maxCost
      continue
    }

    if (
      key === 'vision' ||
      key === 'functionCalling' ||
      key === 'preferSpeed' ||
      key === 'preferQuality'
    ) {
      const parsedBoolean = parseBoolean(value)
      if (parsedBoolean == null) {
        return { ok: false, error: `${key} must be true or false: ${value}` }
      }
      parsed[key] = parsedBoolean
      continue
    }

    return { ok: false, error: `Unknown router option: ${key}` }
  }

  if (parsed.action !== 'list') {
    parsed.task = positional.join(' ').trim()
    if (!parsed.task) {
      return { ok: false, error: `${parsed.action} requires a task description.` }
    }
  } else if (positional.length > 0) {
    return { ok: false, error: 'list does not accept extra positional arguments.' }
  }

  return { ok: true, value: parsed }
}

function renderRoute(task: string, result: RouteResult): string {
  const lines = ['Model route', '-'.repeat(40)]
  lines.push(`Task: ${task}`)
  lines.push(`Primary: ${result.provider}/${result.model}`)
  lines.push(`Reason: ${result.reason}`)
  lines.push(`Estimated cost: $${result.costEstimate.toFixed(2)}`)
  if (result.fallback) {
    lines.push(`Fallback: ${result.fallback.provider}/${result.fallback.model}`)
  }
  return lines.join('\n')
}

function renderList(models: ModelInfo[]): string {
  const lines = ['Available models', '-'.repeat(40)]
  for (const model of models) {
    lines.push(
      `- ${model.provider}/${model.model} · ${model.speed} · vision=${model.vision} · functionCalling=${model.functionCalling}`,
    )
  }
  return lines.join('\n')
}

function renderCompare(task: string, models: ModelInfo[], primary: RouteResult): string {
  const lines = ['Model compare', '-'.repeat(40)]
  lines.push(`Task: ${task}`)
  lines.push(`Recommended: ${primary.provider}/${primary.model}`)
  lines.push(`Reason: ${primary.reason}`)
  lines.push('\nCandidates:')
  for (const model of models.slice(0, 5)) {
    lines.push(
      `- ${model.provider}/${model.model} · speed=${model.speed} · vision=${model.vision} · strengths=${model.strengths.join(', ')}`,
    )
  }
  return lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const parsed = parseArgs(args)
  if (!parsed.ok) {
    return { type: 'text', value: usage(parsed.error) }
  }

  const deps = getRouterDeps()

  if (parsed.value.action === 'list') {
    return { type: 'text', value: renderList(deps.listModels()) }
  }

  const request = {
    task: parsed.value.task!,
    complexity: parsed.value.complexity,
    vision: parsed.value.vision,
    functionCalling: parsed.value.functionCalling,
    preferSpeed: parsed.value.preferSpeed,
    preferQuality: parsed.value.preferQuality,
    maxCost: parsed.value.maxCost,
  }

  const result = deps.routeTask(request)

  if (parsed.value.action === 'compare') {
    return {
      type: 'text',
      value: renderCompare(parsed.value.task!, deps.listModels(), result),
    }
  }

  return { type: 'text', value: renderRoute(parsed.value.task!, result) }
}
