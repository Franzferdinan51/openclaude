import { afterEach, describe, expect, test } from 'bun:test'
import { tmpdir } from 'os'
import { join } from 'path'
import { call, setVisionTestDeps } from './vision-impl.js'

afterEach(() => {
  setVisionTestDeps(null)
})

describe('/vision command', () => {
  test('captures a phone screenshot', async () => {
    const commands: string[] = []
    setVisionTestDeps({
      exec: (command: string) => {
        commands.push(command)
        return ''
      },
    })

    const result = await call('phone_screenshot', {} as never)
    const screenshotPath = join(tmpdir(), 'duckhive-vision-screenshot.png')
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain(screenshotPath)
    expect(commands).toContain(
      'adb -s 192.168.1.251:40835 shell screencap /sdcard/scr.png',
    )
    expect(commands).toContain(
      `adb -s 192.168.1.251:40835 pull /sdcard/scr.png "${screenshotPath}"`,
    )
  })

  test('accepts an analysis prompt', async () => {
    const result = await call('analyze "Describe the screenshot"', {} as never)
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Vision analysis queued')
    expect(result.value).toContain('Describe the screenshot')
    expect(result.value).toContain(join(tmpdir(), 'duckhive-vision-screenshot.png'))
  })

  test('preserves escaped quotes in analysis prompts', async () => {
    const result = await call(
      'analyze "Describe the \\"duck\\" screenshot"',
      {} as never,
    )

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Describe the "duck" screenshot')
  })

  test('rejects unterminated quotes before running vision commands', async () => {
    const commands: string[] = []
    setVisionTestDeps({
      exec: (command: string) => {
        commands.push(command)
        return ''
      },
    })

    const result = await call('phone_tap "10 20', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Unterminated quoted string in /vision arguments')
    expect(commands).toEqual([])
  })

  test('sends a phone tap', async () => {
    const commands: string[] = []
    setVisionTestDeps({
      exec: (command: string) => {
        commands.push(command)
        return ''
      },
    })

    const result = await call('phone_tap 10 20', {} as never)
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Vision tap sent to 10, 20')
    expect(commands).toContain('adb -s 192.168.1.251:40835 shell input tap 10 20')
  })

  test('returns usage for invalid input', async () => {
    const result = await call('phone_tap nope 20', {} as never)
    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('phone_tap requires numeric <x> and <y>')
    expect(result.value).toContain('/vision phone_tap')
  })
})
