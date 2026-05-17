import { expect, test } from 'bun:test'
import { EventEmitter } from 'events'
import { buildTuiSlashCommandEnv, waitForTuiHandoff } from './tui.js'

class FakeChild extends EventEmitter {
  override once(event: string, listener: (...args: any[]) => void): this {
    return super.once(event, listener)
  }
}

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

test('/tui handoff does not exit the REPL when the child fails immediately', async () => {
  const child = new FakeChild()
  let exited = false

  const resultPromise = waitForTuiHandoff(child, {
    graceMs: 20,
    exitCurrentProcess: () => {
      exited = true
    },
  })

  child.emit('spawn')
  child.emit('close', 1, null)

  const result = await resultPromise
  expect(exited).toBe(false)
  expect(result.type).toBe('text')
  expect(result.type === 'text' ? result.value : '').toContain(
    'failed before the handoff completed',
  )
  expect(result.type === 'text' ? result.value : '').toContain('classic REPL')
})

test('/tui handoff exits the parent only after the child survives the grace window', async () => {
  const child = new FakeChild()
  let exited = false

  const resultPromise = waitForTuiHandoff(child, {
    graceMs: 5,
    exitCurrentProcess: () => {
      exited = true
    },
  })

  child.emit('spawn')
  await Bun.sleep(20)

  const result = await resultPromise
  expect(exited).toBe(true)
  expect(result).toEqual({ type: 'skip' })
})
