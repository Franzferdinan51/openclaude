import { expect, test } from 'bun:test'
import { applyDefaultCliEnvironment } from './defaultCliEnvironment.js'

test('Windows CLI defaults to safe REPL stdin ownership', () => {
  const env: NodeJS.ProcessEnv = {}
  applyDefaultCliEnvironment(env, { platform: 'win32' })

  expect(env.DUCKHIVE_DISABLE_EARLY_INPUT).toBe('1')
  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
})

test('Windows early-input experiment leaves stdin env untouched', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_WINDOWS_EARLY_INPUT_EXPERIMENT: '1',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' })

  expect(env.DUCKHIVE_DISABLE_EARLY_INPUT).toBeUndefined()
  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
})

test('non-Windows CLI keeps OpenClaude-style readable defaults', () => {
  const env: NodeJS.ProcessEnv = {}
  applyDefaultCliEnvironment(env, { platform: 'linux' })

  expect(env.DUCKHIVE_DISABLE_EARLY_INPUT).toBeUndefined()
  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
})
