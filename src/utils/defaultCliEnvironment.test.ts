import { expect, test } from 'bun:test'
import { applyDefaultCliEnvironment } from './defaultCliEnvironment.js'

test('Windows CLI defaults to safe REPL stdin ownership', () => {
  const env: NodeJS.ProcessEnv = {}
  applyDefaultCliEnvironment(env, { platform: 'win32' })

  expect(env.DUCKHIVE_DISABLE_EARLY_INPUT).toBe('1')
  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
})

test('Windows CLI clears fragile inherited stdin overrides by default', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_USE_DATA_STDIN: '1',
    OPENCLAUDE_USE_DATA_STDIN: '1',
    DUCKHIVE_USE_READABLE_STDIN: '0',
    OPENCLAUDE_USE_READABLE_STDIN: '0',
    DUCKHIVE_USE_CONIN_STDIN: '1',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' })

  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
  expect(env.OPENCLAUDE_USE_DATA_STDIN).toBeUndefined()
  expect(env.DUCKHIVE_USE_READABLE_STDIN).toBeUndefined()
  expect(env.OPENCLAUDE_USE_READABLE_STDIN).toBeUndefined()
  expect(env.DUCKHIVE_USE_CONIN_STDIN).toBeUndefined()
})

test('Windows CLI can opt into fragile stdin diagnostics', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_ALLOW_FRAGILE_STDIN: '1',
    DUCKHIVE_USE_DATA_STDIN: '1',
    DUCKHIVE_USE_CONIN_STDIN: '1',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' })

  expect(env.DUCKHIVE_USE_DATA_STDIN).toBe('1')
  expect(env.DUCKHIVE_USE_CONIN_STDIN).toBe('1')
})

test('Windows early-input experiment leaves stdin env untouched', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_WINDOWS_EARLY_INPUT_EXPERIMENT: '1',
    DUCKHIVE_USE_DATA_STDIN: '1',
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
