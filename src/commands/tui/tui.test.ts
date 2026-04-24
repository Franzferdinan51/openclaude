import { expect, test } from 'bun:test'
import { buildTuiSlashCommandEnv } from './tui.js'

test('/tui handoff clears direct mode so the PTY helper can run', () => {
  const env = buildTuiSlashCommandEnv({
    DUCKHIVE_AUTO_TUI: '1',
    DUCKHIVE_NO_AUTO_TUI: '1',
    DUCKHIVE_TUI_DIRECT: '1',
    DUCKHIVE_TUI_SKIP_PTY_HELPER: '1',
  })

  expect(env.DUCKHIVE_DEFAULT_UI_SURFACE).toBe('tui')
  expect(env.DUCKHIVE_AUTO_TUI).toBeUndefined()
  expect(env.DUCKHIVE_NO_AUTO_TUI).toBeUndefined()
  expect(env.DUCKHIVE_TUI_DIRECT).toBeUndefined()
  expect(env.DUCKHIVE_TUI_SKIP_PTY_HELPER).toBe('1')
})
