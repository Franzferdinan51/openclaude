import { beforeEach, describe, expect, test } from 'bun:test'
import {
  getModelCapability,
  refreshModelCapabilities,
} from './modelCapabilities.js'

describe('modelCapabilities', () => {
  beforeEach(async () => {
    await refreshModelCapabilities()
  })

  test('returns descriptor-backed capability data for registered models', () => {
    const capability = getModelCapability('claude-sonnet-4-6')

    expect(capability).toEqual({
      id: 'claude-sonnet-4-6',
      max_input_tokens: 200_000,
      max_tokens: 8192,
      supportsVision: true,
    })
  })

  test('normalizes explicit [1m] suffix lookups to the base model id', () => {
    const capability = getModelCapability('claude-sonnet-4-6 [1m]')

    expect(capability?.id).toBe('claude-sonnet-4-6')
    expect(capability?.max_input_tokens).toBe(200_000)
  })

  test('returns undefined for unknown models', () => {
    expect(getModelCapability('missing-model')).toBeUndefined()
  })
})
