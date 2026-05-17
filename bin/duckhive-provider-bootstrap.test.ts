import { describe, expect, test } from 'bun:test'
import { applyLauncherProviderDefaults } from './duckhive-provider-bootstrap.js'

describe('applyLauncherProviderDefaults', () => {
  test('copies configured default provider into DUCKHIVE_PROVIDER when unset', () => {
    const env: NodeJS.ProcessEnv = {}

    applyLauncherProviderDefaults(env, {
      providers: { default: 'minimax' },
    })

    expect(env.DUCKHIVE_PROVIDER).toBe('minimax')
  })

  test('does not override an existing DUCKHIVE_PROVIDER', () => {
    const env: NodeJS.ProcessEnv = {
      DUCKHIVE_PROVIDER: 'openrouter',
      OPENAI_MODEL: 'already-set',
    }

    applyLauncherProviderDefaults(env, {
      providers: { default: 'chatgpt' },
    })

    expect(env.DUCKHIVE_PROVIDER).toBe('openrouter')
    expect(env.OPENAI_MODEL).toBe('already-set')
  })

  test('does not inject provider-specific OPENAI defaults from launcher config', () => {
    const env: NodeJS.ProcessEnv = {}

    applyLauncherProviderDefaults(env, {
      providers: { default: 'chatgpt' },
    })

    expect(env.CLAUDE_CODE_USE_OPENAI).toBeUndefined()
    expect(env.OPENAI_BASE_URL).toBeUndefined()
    expect(env.OPENAI_API_KEY).toBeUndefined()
    expect(env.OPENAI_MODEL).toBeUndefined()
  })
})
