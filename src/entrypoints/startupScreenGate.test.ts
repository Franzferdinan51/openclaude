import { expect, test } from 'bun:test'
import { shouldPrintStartupScreen } from './startupScreenGate.js'

const tty = { stdinIsTTY: true, stdoutIsTTY: true }

test('startup screen is skipped for the TUI subcommand', () => {
  expect(shouldPrintStartupScreen(['tui'], tty)).toBe(false)
})

test('startup screen is skipped for non-interactive print mode', () => {
  expect(shouldPrintStartupScreen(['--print'], tty)).toBe(false)
  expect(shouldPrintStartupScreen(['-p'], tty)).toBe(false)
})

test('startup screen is skipped when stdio is not interactive', () => {
  expect(
    shouldPrintStartupScreen([], { stdinIsTTY: false, stdoutIsTTY: true }),
  ).toBe(false)
  expect(
    shouldPrintStartupScreen([], { stdinIsTTY: true, stdoutIsTTY: false }),
  ).toBe(false)
})

test('startup screen remains enabled for the interactive REPL', () => {
  expect(shouldPrintStartupScreen([], tty)).toBe(true)
})
