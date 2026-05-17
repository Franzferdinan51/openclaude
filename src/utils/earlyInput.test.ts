import { expect, test } from 'bun:test'
import { shouldStartCapturingEarlyInput } from './earlyInput.js'

test('early input capture stays disabled on Windows by default', () => {
  expect(
    shouldStartCapturingEarlyInput({
      argv: ['duckhive'],
      stdinIsTTY: true,
      platform: 'win32',
      env: {},
    }),
  ).toBe(false)
})

test('early input capture can be re-enabled on Windows with explicit opt-in', () => {
  expect(
    shouldStartCapturingEarlyInput({
      argv: ['duckhive'],
      stdinIsTTY: true,
      platform: 'win32',
      env: {
        DUCKHIVE_WINDOWS_EARLY_INPUT_EXPERIMENT: '1',
      },
    }),
  ).toBe(true)
})

test('early input capture stays enabled on non-Windows interactive startup', () => {
  expect(
    shouldStartCapturingEarlyInput({
      argv: ['duckhive'],
      stdinIsTTY: true,
      platform: 'linux',
      env: {},
    }),
  ).toBe(true)
})

test('early input capture stays disabled in print mode', () => {
  expect(
    shouldStartCapturingEarlyInput({
      argv: ['duckhive', '--print'],
      stdinIsTTY: true,
      platform: 'linux',
      env: {},
    }),
  ).toBe(false)
})
