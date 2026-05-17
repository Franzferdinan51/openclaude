import { beforeEach, describe, expect, test } from 'bun:test'
import { refreshModelCapabilities } from './modelCapabilities.js'
import { resolveVisionModelOverride } from './visionRouting.js'

describe('resolveVisionModelOverride', () => {
  beforeEach(async () => {
    await refreshModelCapabilities()
  })

  test('keeps current model when it already supports vision', () => {
    expect(
      resolveVisionModelOverride('claude-sonnet-4-6', {
        ANTHROPIC_API_KEY: 'test-key',
      }),
    ).toBeUndefined()
  })

  test('upgrades MiniMax text-only models to a vision-capable route model', () => {
    const override = resolveVisionModelOverride('MiniMax-Text-01', {
      MINIMAX_API_KEY: 'test-key',
    })

    expect(override).toBeString()
    expect(
      resolveVisionModelOverride('MiniMax-Text-01', {
        MINIMAX_API_KEY: 'test-key',
      }),
    ).toContain('MiniMax-')
  })

  test('leaves the model unchanged when the active route has no known vision option', () => {
    expect(
      resolveVisionModelOverride('deepseek-v4-pro', {
        DEEPSEEK_API_KEY: 'test-key',
      }),
    ).toBeUndefined()
  })
})
