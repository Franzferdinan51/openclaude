import { describe, expect, test } from 'bun:test'
import { ReadStream } from 'tty'
import {
  createStdinOverride,
  getTerminalInputDevicePath,
} from './renderOptions.js'

describe('terminal stdin override', () => {
  test('uses CONIN$ as the Windows terminal input device', () => {
    expect(getTerminalInputDevicePath('win32')).toBe('CONIN$')
  })

  test('uses /dev/tty as the Unix terminal input device', () => {
    expect(getTerminalInputDevicePath('linux')).toBe('/dev/tty')
  })

  test('does not override stdin when stdin is already a TTY', () => {
    expect(
      createStdinOverride({
        stdinIsTTY: true,
        platform: 'win32',
        openDevice: () => {
          throw new Error('should not open')
        },
      }),
    ).toBeUndefined()
  })

  test('skips CONIN$ on Windows by default to preserve OpenClaude stdin behavior', () => {
    expect(
      createStdinOverride({
        stdinIsTTY: false,
        platform: 'win32',
        argv: ['node', 'duckhive'],
        env: {},
        openDevice: () => {
          throw new Error('should not open')
        },
      }),
    ).toBeUndefined()
  })

  test('opens CONIN$ for explicit Windows stdin diagnostics', () => {
    const opened: string[] = []
    const fakeStream = { isTTY: true } as ReadStream

    const stream = createStdinOverride({
      stdinIsTTY: false,
      platform: 'win32',
      argv: ['node', 'duckhive'],
      env: { DUCKHIVE_USE_CONIN_STDIN: '1' },
      openDevice: path => {
        opened.push(path)
        return 42
      },
      createReadStream: fd => {
        expect(fd).toBe(42)
        return fakeStream
      },
      log: () => {
        throw new Error('should not log')
      },
    })

    expect(opened).toEqual(['CONIN$'])
    expect(stream).toBe(fakeStream)
  })

  test('skips override for MCP processes', () => {
    expect(
      createStdinOverride({
        stdinIsTTY: false,
        platform: 'win32',
        argv: ['node', 'duckhive', 'mcp'],
        openDevice: () => {
          throw new Error('should not open')
        },
      }),
    ).toBeUndefined()
  })

  test('closes the opened device if stream creation fails', () => {
    const closed: number[] = []
    const errors: string[] = []

    const stream = createStdinOverride({
      stdinIsTTY: false,
      platform: 'win32',
      argv: ['node', 'duckhive'],
      env: { DUCKHIVE_USE_CONIN_STDIN: '1' },
      openDevice: () => 7,
      createReadStream: () => {
        throw new Error('bad console handle')
      },
      closeDevice: fd => {
        closed.push(fd)
      },
      log: err => {
        errors.push(err.message)
      },
    })

    expect(stream).toBeUndefined()
    expect(closed).toEqual([7])
    expect(errors).toEqual(['bad console handle'])
  })
})
