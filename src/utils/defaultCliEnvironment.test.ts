import { expect, test } from 'bun:test'
import { applyDefaultCliEnvironment } from './defaultCliEnvironment.js'

test('Windows CLI defaults to safe REPL stdin ownership', () => {
  const env: NodeJS.ProcessEnv = {}
  applyDefaultCliEnvironment(env, { platform: 'win32' }, ['node', 'duckhive'])

  expect(env.DUCKHIVE_DISABLE_EARLY_INPUT).toBe('1')
  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
  expect(env.DUCKHIVE_DEFAULT_UI_SURFACE).toBe('legacy')
  expect(env.DUCKHIVE_NO_AUTO_TUI).toBe('1')
})

test('Windows CLI clears fragile inherited stdin overrides by default', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_USE_DATA_STDIN: '1',
    OPENCLAUDE_USE_DATA_STDIN: '1',
    DUCKHIVE_USE_READABLE_STDIN: '0',
    OPENCLAUDE_USE_READABLE_STDIN: '0',
    DUCKHIVE_USE_CONIN_STDIN: '1',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' }, ['node', 'duckhive'])

  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
  expect(env.OPENCLAUDE_USE_DATA_STDIN).toBeUndefined()
  expect(env.DUCKHIVE_USE_READABLE_STDIN).toBeUndefined()
  expect(env.OPENCLAUDE_USE_READABLE_STDIN).toBeUndefined()
  expect(env.DUCKHIVE_USE_CONIN_STDIN).toBeUndefined()
})

test('Windows CLI clears inherited TUI handoff flags for classic startup', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_AUTO_TUI: '1',
    DUCKHIVE_TUI_DIRECT: '1',
    DUCKHIVE_DEFAULT_UI_SURFACE: 'tui',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' }, ['node', 'duckhive'])

  expect(env.DUCKHIVE_AUTO_TUI).toBeUndefined()
  expect(env.DUCKHIVE_TUI_DIRECT).toBeUndefined()
  expect(env.DUCKHIVE_DEFAULT_UI_SURFACE).toBe('legacy')
  expect(env.DUCKHIVE_NO_AUTO_TUI).toBe('1')
})

test('Windows explicit TUI launch preserves TUI environment', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_AUTO_TUI: '1',
    DUCKHIVE_TUI_DIRECT: '1',
    DUCKHIVE_DEFAULT_UI_SURFACE: 'tui',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' }, ['node', 'duckhive', 'tui'])

  expect(env.DUCKHIVE_AUTO_TUI).toBe('1')
  expect(env.DUCKHIVE_TUI_DIRECT).toBe('1')
  expect(env.DUCKHIVE_DEFAULT_UI_SURFACE).toBe('tui')
  expect(env.DUCKHIVE_NO_AUTO_TUI).toBeUndefined()
})

test('Windows CLI can opt into fragile stdin diagnostics', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_ALLOW_FRAGILE_STDIN: '1',
    DUCKHIVE_USE_DATA_STDIN: '1',
    DUCKHIVE_USE_CONIN_STDIN: '1',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' }, ['node', 'duckhive'])

  expect(env.DUCKHIVE_USE_DATA_STDIN).toBe('1')
  expect(env.DUCKHIVE_USE_CONIN_STDIN).toBe('1')
})

test('Windows CLI preserves explicit stdin mode flag through startup sanitizing', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_USE_DATA_STDIN: '1',
    OPENCLAUDE_USE_DATA_STDIN: '1',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' }, [
    'node',
    'duckhive',
    '--stdin-mode',
    'data',
  ])

  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
  expect(env.OPENCLAUDE_USE_DATA_STDIN).toBeUndefined()
  expect(env.DUCKHIVE_STDIN_MODE).toBe('data')
})

test('Windows CLI accepts equals-form explicit stdin mode flag', () => {
  const env: NodeJS.ProcessEnv = {}
  applyDefaultCliEnvironment(env, { platform: 'win32' }, [
    'node',
    'duckhive',
    '--stdin-mode=readable',
  ])

  expect(env.DUCKHIVE_STDIN_MODE).toBe('readable')
})

test('Windows early-input experiment leaves stdin env untouched', () => {
  const env: NodeJS.ProcessEnv = {
    DUCKHIVE_WINDOWS_EARLY_INPUT_EXPERIMENT: '1',
    DUCKHIVE_USE_DATA_STDIN: '1',
  }
  applyDefaultCliEnvironment(env, { platform: 'win32' }, ['node', 'duckhive'])

  expect(env.DUCKHIVE_DISABLE_EARLY_INPUT).toBeUndefined()
  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
  expect(env.DUCKHIVE_DEFAULT_UI_SURFACE).toBe('legacy')
})

test('non-Windows CLI keeps OpenClaude-style readable defaults', () => {
  const env: NodeJS.ProcessEnv = {}
  applyDefaultCliEnvironment(env, { platform: 'linux' }, ['node', 'duckhive'])

  expect(env.DUCKHIVE_DISABLE_EARLY_INPUT).toBeUndefined()
  expect(env.DUCKHIVE_USE_DATA_STDIN).toBeUndefined()
})
