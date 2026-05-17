import { describe, expect, test } from 'bun:test'
import { determineStdinMode } from './App.js'

describe('determineStdinMode', () => {
  test('uses readable events on Windows by default to match the OpenClaude input path', () => {
    expect(determineStdinMode({ env: {}, platform: 'win32' })).toBe('readable')
  })

  test('keeps readable events on Windows with explicit opt-in', () => {
    expect(
      determineStdinMode({
        env: { DUCKHIVE_USE_READABLE_STDIN: '1' },
        platform: 'win32',
      }),
    ).toBe('readable')
  })

  test('keeps readable events on non-Windows by default', () => {
    expect(determineStdinMode({ env: {}, platform: 'linux' })).toBe('readable')
  })

  test('honors explicit data-mode opt-in on non-Windows', () => {
    expect(
      determineStdinMode({
        env: { DUCKHIVE_USE_DATA_STDIN: '1' },
        platform: 'linux',
      }),
    ).toBe('data')
  })

  test('honors explicit readable-mode opt-out on non-Windows', () => {
    expect(
      determineStdinMode({
        env: { DUCKHIVE_USE_READABLE_STDIN: '0' },
        platform: 'linux',
      }),
    ).toBe('data')
  })

  test('preserves OpenClaude stdin env compatibility', () => {
    expect(
      determineStdinMode({
        env: { OPENCLAUDE_USE_DATA_STDIN: '1' },
        platform: 'linux',
      }),
    ).toBe('data')
  })
})
