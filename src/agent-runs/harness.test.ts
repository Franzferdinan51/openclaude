import { describe, expect, test } from 'bun:test'
import {
  AgentHarnessRegistry,
  builtinAgentHarness,
  resolveAgentHarness,
  type AgentHarness,
} from './harness.js'

const matchingHarness: AgentHarness = {
  id: 'native-test',
  label: 'Native Test Harness',
  supports(ctx) {
    return ctx.provider === 'native'
      ? { supported: true, priority: 90 }
      : { supported: false }
  },
  async runAttempt(params) {
    params.onAgentEvent?.({
      type: 'run_progress',
      runId: params.runId,
      timestamp: 1,
      payload: { summary: 'fixture event' },
    })
    params.onPartialReply?.('fixture reply')
    return { status: 'completed', finalMessage: 'done' }
  },
}

describe('AgentHarnessRegistry', () => {
  test('auto-selects the highest-priority supported harness', () => {
    const registry = new AgentHarnessRegistry()
    registry.register(builtinAgentHarness)
    registry.register(matchingHarness)

    const resolved = resolveAgentHarness(
      { provider: 'native', model: 'native/model', runtime: 'auto' },
      registry,
      {},
    )

    expect(resolved.harness.id).toBe('native-test')
    expect(resolved.source).toBe('auto')
  })

  test('uses builtin fallback when auto has no match', () => {
    const registry = new AgentHarnessRegistry()
    registry.register(builtinAgentHarness)

    const resolved = resolveAgentHarness(
      { provider: 'unknown', model: 'unknown/model', runtime: 'auto' },
      registry,
      { DUCKHIVE_AGENT_HARNESS_FALLBACK: 'builtin' },
    )

    expect(resolved.harness.id).toBe('builtin')
    expect(resolved.source).toBe('fallback')
  })

  test('throws when fallback is disabled and no harness supports the run', () => {
    const registry = new AgentHarnessRegistry()
    registry.register(builtinAgentHarness)

    expect(() =>
      resolveAgentHarness(
        { provider: 'unknown', model: 'unknown/model', runtime: 'auto' },
        registry,
        { DUCKHIVE_AGENT_HARNESS_FALLBACK: 'none' },
      ),
    ).toThrow('No DuckHive agent harness supports provider "unknown"')
  })

  test('honors forced runtime from env', () => {
    const registry = new AgentHarnessRegistry()
    registry.register(builtinAgentHarness)
    registry.register(matchingHarness)

    const resolved = resolveAgentHarness(
      { provider: 'native', model: 'native/model' },
      registry,
      { DUCKHIVE_AGENT_RUNTIME: 'native-test' },
    )

    expect(resolved.harness.id).toBe('native-test')
    expect(resolved.source).toBe('forced')
  })
})
