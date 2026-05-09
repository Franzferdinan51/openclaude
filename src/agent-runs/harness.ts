import type { AgentRunEvent } from './types.js'

export type AgentHarnessSupport =
  | { supported: true; priority?: number; reason?: string }
  | { supported: false; reason?: string }

export type AgentHarnessContext = {
  provider?: string
  model?: string
  runtime?: string
  agentType?: string
}

export type AgentHarnessAttemptParams = {
  runId: string
  prompt: string
  provider?: string
  model?: string
  tools?: unknown[]
  images?: unknown[]
  transcriptPath?: string
  onPartialReply?: (chunk: string) => void | Promise<void>
  onAgentEvent?: (event: Omit<AgentRunEvent, 'eventId'>) => void | Promise<void>
}

export type AgentHarnessResult = {
  status: 'completed' | 'failed'
  finalMessage?: string
  error?: string
  nativeSessionId?: string
}

export type AgentHarness = {
  id: string
  label: string
  supports(ctx: AgentHarnessContext): AgentHarnessSupport
  runAttempt(params: AgentHarnessAttemptParams): Promise<AgentHarnessResult>
  reset?(runId: string): Promise<void> | void
}

export type ResolvedAgentHarness = {
  harness: AgentHarness
  source: 'forced' | 'auto' | 'fallback'
}

export type AgentHarnessEnv = {
  DUCKHIVE_AGENT_RUNTIME?: string
  DUCKHIVE_AGENT_HARNESS_FALLBACK?: string
}

export class AgentHarnessRegistry {
  private readonly harnesses = new Map<string, AgentHarness>()

  register(harness: AgentHarness): void {
    this.harnesses.set(harness.id, harness)
  }

  get(id: string): AgentHarness | undefined {
    return this.harnesses.get(id)
  }

  list(): AgentHarness[] {
    return [...this.harnesses.values()]
  }

  findBest(ctx: AgentHarnessContext): AgentHarness | undefined {
    return this.list()
      .map(harness => ({ harness, support: harness.supports(ctx) }))
      .filter(
        (entry): entry is { harness: AgentHarness; support: { supported: true; priority?: number } } =>
          entry.support.supported,
      )
      .sort((a, b) => (b.support.priority ?? 0) - (a.support.priority ?? 0))[0]
      ?.harness
  }
}

export const builtinAgentHarness: AgentHarness = {
  id: 'builtin',
  label: 'DuckHive built-in agent runtime',
  supports() {
    return { supported: true, priority: 0 }
  },
  async runAttempt() {
    return {
      status: 'failed',
      error:
        'The built-in harness is selected through DuckHive core execution, not run directly through the experimental harness API.',
    }
  },
}

const globalRegistry = new AgentHarnessRegistry()
globalRegistry.register(builtinAgentHarness)

export function getAgentHarnessRegistry(): AgentHarnessRegistry {
  return globalRegistry
}

export function registerAgentHarness(harness: AgentHarness): void {
  globalRegistry.register(harness)
}

export function resolveAgentHarness(
  ctx: AgentHarnessContext,
  registry = globalRegistry,
  env: AgentHarnessEnv = getRuntimeHarnessEnv(),
): ResolvedAgentHarness {
  const requested = env.DUCKHIVE_AGENT_RUNTIME ?? ctx.runtime ?? 'auto'
  const fallback = env.DUCKHIVE_AGENT_HARNESS_FALLBACK ?? 'builtin'

  if (requested !== 'auto') {
    const forced = registry.get(requested)
    if (!forced) {
      throw new Error(`DuckHive agent harness "${requested}" is not registered`)
    }
    const support = forced.supports(ctx)
    if (!support.supported) {
      throw new Error(
        `DuckHive agent harness "${requested}" does not support provider "${ctx.provider ?? 'unknown'}" model "${ctx.model ?? 'unknown'}"`,
      )
    }
    return { harness: forced, source: 'forced' }
  }

  const best = registry.findBest(ctx)
  if (best && best.id !== 'builtin') {
    return { harness: best, source: 'auto' }
  }

  if (fallback === 'none') {
    throw new Error(
      `No DuckHive agent harness supports provider "${ctx.provider ?? 'unknown'}" model "${ctx.model ?? 'unknown'}"`,
    )
  }

  const builtin = registry.get('builtin')
  if (!builtin) {
    throw new Error('DuckHive built-in agent harness is not registered')
  }
  return { harness: builtin, source: 'fallback' }
}

function getRuntimeHarnessEnv(): AgentHarnessEnv {
  return (globalThis as { process?: { env?: AgentHarnessEnv } }).process?.env ?? {}
}
