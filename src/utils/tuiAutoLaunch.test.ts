import { expect, test } from 'bun:test'
import {
  buildStandaloneTuiLaunchEnv,
  formatStandaloneTuiUnavailableMessage,
  getDefaultStandaloneTuiBridgeArgs,
  getStandaloneTuiBuildCommand,
  getStandaloneTuiExecutablePath,
  isStandaloneTuiNonInteractiveMode,
  launchStandaloneTui,
  resolveDuckHiveBaseDir,
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
      {},
    ),
  ).toBe(false)
})

test('auto-launch starts when TUI is explicitly preferred in config', () => {
  expect(
    shouldAutoLaunchStandaloneTui(
      [],
      {},
      { stdinIsTTY: true, stdoutIsTTY: true },
      { ui: { defaultSurface: 'tui' } },
      { platform: 'linux' },
    ),
  ).toBe(true)
})

test('auto-launch stays disabled on Windows by default even when TUI is preferred', () => {
  expect(
    shouldAutoLaunchStandaloneTui(
      [],
      {},
      { stdinIsTTY: true, stdoutIsTTY: true },
      { ui: { defaultSurface: 'tui' } },
      { platform: 'win32' },
    ),
  ).toBe(false)
})

test('auto-launch can be re-enabled on Windows with an explicit env opt-in', () => {
  expect(
    shouldAutoLaunchStandaloneTui(
      [],
      { DUCKHIVE_TUI_WINDOWS_EXPERIMENT: '1' },
      { stdinIsTTY: true, stdoutIsTTY: true },
      { ui: { defaultSurface: 'tui' } },
      { platform: 'win32' },
    ),
  ).toBe(true)
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

test('resolves the DuckHive base directory from bundled and source paths', () => {
  const seen = new Set([
    '/repo/package.json',
    '/repo/bin/duckhive',
    '/repo/dist/cli.mjs',
  ])
  const fileExists = (path: string) => seen.has(path.replace(/\\/g, '/'))

  expect(resolveDuckHiveBaseDir('/repo/dist/cli.mjs', fileExists)).toBe('/repo')
  expect(resolveDuckHiveBaseDir('/repo/src/utils/tuiAutoLaunch.ts', fileExists)).toBe('/repo')
})

test('uses the Windows TUI executable name on Windows', () => {
  expect(getStandaloneTuiExecutablePath('/tmp/duckhive', 'win32').replace(/\\/g, '/')).toBe(
    '/tmp/duckhive/tui/duckhive-tui.exe',
  )
  expect(getStandaloneTuiExecutablePath('/tmp/duckhive', 'linux').replace(/\\/g, '/')).toBe(
    '/tmp/duckhive/tui/duckhive-tui',
  )
})

test('build command targets the platform-specific TUI binary', () => {
  const windows = getStandaloneTuiBuildCommand('/tmp/duckhive', 'win32')
  expect(windows.cwd.replace(/\\/g, '/')).toBe('/tmp/duckhive/tui')
  expect(windows.command).toBe('go')
  expect(windows.args).toEqual([
    'build',
    '-o',
    'duckhive-tui.exe',
    './cmd/duckhive-tui',
  ])

  const linux = getStandaloneTuiBuildCommand('/tmp/duckhive', 'linux')
  expect(linux.args).toContain('duckhive-tui')
  expect(linux.args).not.toContain('duckhive-tui.exe')
})

test('detects non-interactive TUI diagnostic modes', () => {
  expect(isStandaloneTuiNonInteractiveMode(['--snapshot'])).toBe(true)
  expect(isStandaloneTuiNonInteractiveMode(['snapshot'])).toBe(true)
  expect(isStandaloneTuiNonInteractiveMode(['--input-smoke', 'typed'])).toBe(true)
  expect(isStandaloneTuiNonInteractiveMode(['input-smoke'])).toBe(true)
  expect(isStandaloneTuiNonInteractiveMode(['--submit-smoke', 'submitted'])).toBe(true)
  expect(isStandaloneTuiNonInteractiveMode(['submit-smoke'])).toBe(true)
  expect(isStandaloneTuiNonInteractiveMode([])).toBe(false)
})

test('input smoke launch bypasses the PTY helper and exits from the TUI binary', async () => {
  const ok = await launchStandaloneTui(process.cwd(), {
    args: ['--input-smoke', 'typed through launcher test'],
    env: {
      DUCKHIVE_TUI_DIRECT: '0',
      DUCKHIVE_TUI_SKIP_PTY_HELPER: '0',
    },
  })

  expect(ok).toBe(true)
})

test('submit smoke launch bypasses the PTY helper and exits from the TUI binary', async () => {
  const ok = await launchStandaloneTui(process.cwd(), {
    args: ['--submit-smoke', 'submitted through launcher test'],
    env: {
      DUCKHIVE_TUI_DIRECT: '0',
      DUCKHIVE_TUI_SKIP_PTY_HELPER: '0',
    },
  })

  expect(ok).toBe(true)
})

test('formats actionable Windows TUI prerequisite errors', () => {
  const message = formatStandaloneTuiUnavailableMessage(
    '/tmp/duckhive',
    'missing-go',
    'win32',
  )

  expect(message).toContain('Go is not installed')
  expect(message).toContain('tui\\duckhive-tui.exe')
  expect(message).toContain('https://go.dev/dl/')
  expect(message).toContain('duckhive tui')
  expect(message).toContain('classic REPL')
})

test('formats actionable TUI build failure errors', () => {
  const message = formatStandaloneTuiUnavailableMessage(
    '/tmp/duckhive',
    'build-failed',
    'linux',
  )

  expect(message).toContain('on-demand build failed')
  expect(message).toContain('cd tui && go build -o duckhive-tui ./cmd/duckhive-tui')
  expect(message).toContain('classic REPL')
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

test('snapshot launch bypasses the PTY helper and exits from the TUI binary', async () => {
  const ok = await launchStandaloneTui(process.cwd(), {
    args: ['--snapshot'],
    env: {
      DUCKHIVE_TUI_DIRECT: '0',
      DUCKHIVE_TUI_SKIP_PTY_HELPER: '0',
    },
  })

  expect(ok).toBe(true)
})
