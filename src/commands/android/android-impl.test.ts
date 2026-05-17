import { afterEach, describe, expect, test } from 'bun:test'
import { call, setAndroidTestDeps } from './android-impl.js'

afterEach(() => {
  setAndroidTestDeps(null)
})

describe('/android command', () => {
  test('lists devices', async () => {
    setAndroidTestDeps({
      exec: (command: string) => {
        if (command === 'adb devices -l') {
          return 'List of devices attached\n192.168.1.251:40835 device product:test\n'
        }
        throw new Error(`unexpected command: ${command}`)
      },
    })

    const result = await call('devices', {} as never)
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Android devices')
    expect(result.value).toContain('192.168.1.251:40835')
  })

  test('captures a screenshot', async () => {
    const commands: string[] = []
    setAndroidTestDeps({
      exec: (command: string) => {
        commands.push(command)
        if (command === 'adb devices -l') {
          return 'List of devices attached\n192.168.1.251:40835 device\n'
        }
        return ''
      },
    })

    const result = await call('screenshot', {} as never)
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('/tmp/android_screenshot.png')
    expect(commands).toContain(
      'adb -s 192.168.1.251:40835 shell screencap /sdcard/scr.png',
    )
    expect(commands).toContain(
      'adb -s 192.168.1.251:40835 pull /sdcard/scr.png /tmp/android_screenshot.png',
    )
  })

  test('sends tap, swipe, text, and shell actions', async () => {
    const commands: string[] = []
    setAndroidTestDeps({
      exec: (command: string) => {
        commands.push(command)
        if (command === 'adb devices -l') {
          return 'List of devices attached\n192.168.1.251:40835 device\n'
        }
        return 'ok'
      },
    })

    await call('tap 100 200', {} as never)
    await call('swipe 1 2 3 4 500', {} as never)
    await call('text "hello world"', {} as never)
    const shell = await call('shell getprop ro.build.version.release', {} as never)

    expect(commands).toContain('adb -s 192.168.1.251:40835 shell input tap 100 200')
    expect(commands).toContain('adb -s 192.168.1.251:40835 shell input swipe 1 2 3 4 500')
    expect(commands).toContain('adb -s 192.168.1.251:40835 shell input text "hello%sworld"')
    expect(commands).toContain(
      'adb -s 192.168.1.251:40835 shell getprop ro.build.version.release',
    )
    expect(shell.type).toBe('text')
    if (shell.type !== 'text') throw new Error('unexpected result type')
    expect(shell.value).toContain('Android shell')
  })

  test('returns usage for invalid input', async () => {
    const result = await call('tap nope 10', {} as never)
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('tap requires numeric <x> and <y>')
    expect(result.value).toContain('/android tap')
  })
})
