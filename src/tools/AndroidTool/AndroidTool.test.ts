import { afterEach, describe, expect, test } from 'bun:test'
import { tmpdir } from 'os'
import { join } from 'path'
import { AndroidTool, setAndroidToolTestDeps } from './AndroidTool.js'

afterEach(() => {
  setAndroidToolTestDeps(null)
})

describe('AndroidTool', () => {
  test('pulls screenshots into an OS temp path', async () => {
    const commands: string[] = []
    setAndroidToolTestDeps({
      exec: (command: string) => {
        commands.push(command)
        if (command === 'adb devices -l') {
          return 'List of devices attached\n192.168.1.251:40835 device\n'
        }
        return ''
      },
    })

    const result = await AndroidTool.call(
      { action: 'screenshot_pull' },
      {} as never,
      undefined as never,
      undefined as never,
    )
    const screenshotPath = join(tmpdir(), 'duckhive-android-screenshot.png')

    expect(result.data.success).toBe(true)
    expect(result.data.image_path).toBe(screenshotPath)
    expect(commands).toContain('adb -s 192.168.1.251:40835 shell screencap /sdcard/scr.png')
    expect(commands).toContain(
      `adb -s 192.168.1.251:40835 pull /sdcard/scr.png "${screenshotPath}"`,
    )
  })
})
