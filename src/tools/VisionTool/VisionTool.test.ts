import { afterEach, describe, expect, test } from 'bun:test'
import { tmpdir } from 'os'
import { join } from 'path'
import { VisionTool, setVisionToolTestDeps } from './VisionTool.js'

afterEach(() => {
  setVisionToolTestDeps(null)
})

describe('VisionTool', () => {
  test('pulls phone screenshots into an OS temp path', async () => {
    const commands: string[] = []
    setVisionToolTestDeps({
      exec: (command: string) => {
        commands.push(command)
        return ''
      },
    })

    const result = await VisionTool.call(
      { action: 'phone_screenshot' },
      {} as never,
      undefined as never,
      undefined as never,
    )
    const screenshotPath = join(tmpdir(), 'duckhive-vision-screenshot.png')

    expect(result.data.success).toBe(true)
    expect(result.data.image_path).toBe(screenshotPath)
    expect(commands).toContain('adb -s 192.168.1.251:40835 shell screencap /sdcard/scr.png')
    expect(commands).toContain(
      `adb -s 192.168.1.251:40835 pull /sdcard/scr.png "${screenshotPath}"`,
    )
  })

  test('analyze reports the same OS temp screenshot path', async () => {
    const result = await VisionTool.call(
      { action: 'analyze', prompt: 'Describe the screen' },
      {} as never,
      undefined as never,
      undefined as never,
    )

    expect(result.data.success).toBe(true)
    expect(result.data.image_path).toBe(join(tmpdir(), 'duckhive-vision-screenshot.png'))
    expect(result.data.analysis).toBe('Describe the screen')
  })
})
