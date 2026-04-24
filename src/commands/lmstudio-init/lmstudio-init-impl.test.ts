import { afterEach, describe, expect, mock, test } from 'bun:test'

import type { ProviderProfileInput } from '../../utils/providerProfiles.js'

type CapturedAddProviderProfile = {
  input: ProviderProfileInput
  options?: { makeActive?: boolean }
}

let capturedAddProviderProfile: CapturedAddProviderProfile | undefined

afterEach(() => {
  mock.restore()
  capturedAddProviderProfile = undefined
})

async function importCommandImpl() {
  mock.module('../../utils/providerProfiles.js', () => ({
    getProviderPresetDefaults: () => ({
      provider: 'openai',
      name: 'LM Studio',
      baseUrl: 'http://localhost:1234/v1',
      model: 'local-model',
      apiKey: '',
      requiresApiKey: false,
    }),
    addProviderProfile: (
      input: ProviderProfileInput,
      options?: { makeActive?: boolean },
    ) => {
      capturedAddProviderProfile = { input, options }
      return {
        id: 'provider_lmstudio',
        ...input,
      }
    },
  }))

  return import(`./lmstudio-init-impl.js?ts=${Date.now()}-${Math.random()}`)
}

describe('/lmstudio-init', () => {
  test('adds an active LM Studio provider profile with local defaults', async () => {
    const { call } = await importCommandImpl()

    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('LM Studio')
    expect(capturedAddProviderProfile).toEqual({
      input: {
        provider: 'openai',
        name: 'LM Studio',
        baseUrl: 'http://localhost:1234/v1',
        model: 'local-model',
        apiKey: 'lm-studio',
      },
      options: { makeActive: true },
    })
  })

  test('accepts explicit base URL, model, and API key flags', async () => {
    const { call } = await importCommandImpl()

    await call(
      '--base-url http://127.0.0.1:1234/v1 --model qwen2.5-coder --api-key local-key',
      {} as never,
    )

    expect(capturedAddProviderProfile?.input).toMatchObject({
      baseUrl: 'http://127.0.0.1:1234/v1',
      model: 'qwen2.5-coder',
      apiKey: 'local-key',
    })
  })
})
