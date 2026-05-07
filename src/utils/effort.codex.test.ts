import { afterEach, expect, mock, test } from 'bun:test'
// Keep mocked module surfaces complete. Bun's mock.module() is process-global,
// so reduced mock factories here can break later tests that import the same
// modules through the API shim/client stack.
import * as actualAuth from './auth.js'
import * as actualProviderConfig from '../services/api/providerConfig.js'
import * as actualThinking from './thinking.js'
import * as actualGrowthbook from 'src/services/analytics/growthbook.js'
import * as actualProviders from './model/providers.js'
import * as actualModelSupportOverrides from './model/modelSupportOverrides.js'

afterEach(() => {
  mock.restore()
})

async function importFreshEffortModule(options: {
  provider: 'codex' | 'openai' | 'firstParty'
  supportsCodexReasoningEffort: boolean
}) {
  mock.module('./model/providers.js', () => ({
    ...actualProviders,
    getAPIProvider: () => options.provider,
  }))
  mock.module('./model/modelSupportOverrides.js', () => ({
    ...actualModelSupportOverrides,
    get3PModelCapabilityOverride: () => undefined,
  }))
  mock.module('../services/api/providerConfig.js', () => ({
    ...actualProviderConfig,
    supportsCodexReasoningEffort: () => options.supportsCodexReasoningEffort,
  }))
  mock.module('./auth.js', () => ({
    ...actualAuth,
    isProSubscriber: () => false,
    isMaxSubscriber: () => false,
    isTeamSubscriber: () => false,
  }))
  mock.module('./thinking.js', () => ({
    ...actualThinking,
    isUltrathinkEnabled: () => false,
  }))
  mock.module('src/services/analytics/growthbook.js', () => ({
    ...actualGrowthbook,
    getFeatureValue_CACHED_MAY_BE_STALE: (_key: string, fallback: unknown) =>
      fallback,
  }))

  return import(`./effort.js?ts=${Date.now()}-${Math.random()}`)
}

test('gpt-5.4 on the ChatGPT Codex backend supports effort selection', async () => {
  const { getAvailableEffortLevels, modelSupportsEffort } =
    await importFreshEffortModule({
      provider: 'codex',
      supportsCodexReasoningEffort: true,
    })

  expect(modelSupportsEffort('gpt-5.4')).toBe(true)
  expect(getAvailableEffortLevels('gpt-5.4')).toEqual([
    'low',
    'medium',
    'high',
    'xhigh',
  ])
})

test('gpt-5.4 on the OpenAI provider still supports effort selection', async () => {
  const { getAvailableEffortLevels, modelSupportsEffort } =
    await importFreshEffortModule({
      provider: 'openai',
      supportsCodexReasoningEffort: true,
    })

  expect(modelSupportsEffort('gpt-5.4')).toBe(true)
  expect(getAvailableEffortLevels('gpt-5.4')).toEqual([
    'low',
    'medium',
    'high',
    'xhigh',
  ])
})

test('gpt-5.3-codex-spark stays without effort controls', async () => {
  const { getAvailableEffortLevels, modelSupportsEffort } =
    await importFreshEffortModule({
      provider: 'codex',
      supportsCodexReasoningEffort: false,
    })

  expect(modelSupportsEffort('gpt-5.3-codex-spark')).toBe(false)
  expect(getAvailableEffortLevels('gpt-5.3-codex-spark')).toEqual([])
})

test('toPersistableEffort normalizes xhigh to max so it survives settings write', async () => {
  const { toPersistableEffort } = await importFreshEffortModule({
    provider: 'openai',
    supportsCodexReasoningEffort: true,
  })

  expect(toPersistableEffort('xhigh')).toBe('max')
  expect(toPersistableEffort('max')).toBe('max')
  expect(toPersistableEffort('high')).toBe('high')
  expect(toPersistableEffort('medium')).toBe('medium')
  expect(toPersistableEffort('low')).toBe('low')
  expect(toPersistableEffort(undefined)).toBeUndefined()
})

test('standardEffortToOpenAI maps max to xhigh for shim payload', async () => {
  const { standardEffortToOpenAI, openAIEffortToStandard } =
    await importFreshEffortModule({
      provider: 'openai',
      supportsCodexReasoningEffort: true,
    })

  expect(standardEffortToOpenAI('max')).toBe('xhigh')
  expect(standardEffortToOpenAI('high')).toBe('high')
  expect(openAIEffortToStandard('xhigh')).toBe('max')
  expect(openAIEffortToStandard('high')).toBe('high')
})

test('e2e: xhigh persists as max and resolves back to xhigh for OpenAI/Codex wire payloads', async () => {
  const {
    toPersistableEffort,
    resolveAppliedEffort,
    standardEffortToOpenAI,
  } = await importFreshEffortModule({
    provider: 'openai',
    supportsCodexReasoningEffort: true,
  })

  const persisted = toPersistableEffort('xhigh')
  expect(persisted).toBe('max')

  const applied = resolveAppliedEffort('gpt-5.4', persisted)
  expect(applied).toBe('max')
  expect(standardEffortToOpenAI(applied as 'max')).toBe('xhigh')
})

test('max on non-Opus Anthropic models still clamps to high', async () => {
  const { resolveAppliedEffort } = await importFreshEffortModule({
    provider: 'firstParty',
    supportsCodexReasoningEffort: false,
  })

  expect(resolveAppliedEffort('claude-sonnet-4-6', 'max')).toBe('high')
})
