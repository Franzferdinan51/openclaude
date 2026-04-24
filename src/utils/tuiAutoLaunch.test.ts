import { expect, test } from 'bun:test'
import {
  buildStandaloneTuiLaunchEnv,
  getDefaultStandaloneTuiBridgeArgs,
  shouldUseStandaloneTuiHelper,
  shouldAutoLaunchStandaloneTui,
} from './tuiAutoLaunch.js'

test('auto-launch stays disabled when legacy is the preferred surface', () => {
  expect(
    shouldAutoLaunchStandaloneTui(
      [],
      { DUCKHIVE_DEFAULT_UI_SURFACE: 'legacy' },
      { stdinIsTTY: true, stdoutIsTTY: true },
    ),
  ).toBe(false)
})

test('auto-launch stays disabled by default until TUI is explicitly preferred', () => {
  expect(
    shouldAutoLaunchStandaloneTui(
      [],
      {},
      { stdinIsTTY: true, stdoutIsTTY: true },
    ),
  ).toBe(false)
})

test('builds bridge wiring for standalone TUI launches', () => {
  const baseDir = '/tmp/duckhive'
  const env = buildStandaloneTuiLaunchEnv(baseDir, {
    env: { DUCKHIVE_NO_AUTO_TUI: '1' },
  })

  expect(env.DUCKHIVE_AUTO_TUI).toBe('1')
  expect(env.DUCKHIVE_DEFAULT_UI_SURFACE).toBe('tui')
  expect(env.DUCKHIVE_NO_AUTO_TUI).toBeUndefined()
  expect(env.CLAUDE_CODE_SIMPLE).toBe('1')
  expect(env.DUCKHIVE_BRIDGE_CMD).toBe(process.execPath)
  expect(env.DUCKHIVE_BRIDGE_ARGS).toBe(
    getDefaultStandaloneTuiBridgeArgs(baseDir).join(' '),
  )
})

test('standalone TUI bridge uses bare mode to reduce JS startup work', () => {
  expect(getDefaultStandaloneTuiBridgeArgs('/tmp/duckhive')).toContain('--bare')
})

test('uses the PTY helper by default when it exists', () => {
  expect(
    shouldUseStandaloneTuiHelper('/tmp/duckhive', {}, path =>
      path.endsWith('/bin/tui-pty-helper.py'),
    ),
  ).toBe(true)
})

test('skips the PTY helper for explicit direct handoff launches', () => {
  expect(
    shouldUseStandaloneTuiHelper(
      '/tmp/duckhive',
      { DUCKHIVE_TUI_DIRECT: '1' },
      () => true,
    ),
  ).toBe(false)
})

test('skips the PTY helper when the escape hatch is set', () => {
  expect(
    shouldUseStandaloneTuiHelper(
      '/tmp/duckhive',
      { DUCKHIVE_TUI_SKIP_PTY_HELPER: 'true' },
      () => true,
    ),
  ).toBe(false)
})
