import type { LocalCommandCall } from '../../types/command.js'
import { execSync_DEPRECATED } from '../../utils/execSyncWrapper.js'
import type { ExecSyncOptionsWithStringEncoding } from 'child_process'

type AndroidDeps = {
  exec: (command: string, options: ExecSyncOptionsWithStringEncoding) => string
}

let androidTestDeps: Partial<AndroidDeps> | null = null

function getAndroidDeps(): AndroidDeps {
  return {
    exec: (command, options) => execSync_DEPRECATED(command, options),
    ...androidTestDeps,
  }
}

export function setAndroidTestDeps(overrides: Partial<AndroidDeps> | null): void {
  androidTestDeps = overrides
}

function splitCommandArgs(args: string): string[] {
  return (
    args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg =>
      arg.replace(/^["']|["']$/g, ''),
    ) ?? []
  )
}

function getPhoneDevice(exec: AndroidDeps['exec']): string {
  try {
    const out = exec('adb devices -l', { encoding: 'utf8', timeout: 5000 })
    const match = out.match(/192\.168\.1\.251:(\d+)/)
    if (match) return `192.168.1.251:${match[1]}`
  } catch {}
  return '192.168.1.251:40835'
}

function usage(error?: string): string {
  const lines = [
    'Android control',
    '',
    'Usage:',
    '  /android devices',
    '  /android screenshot',
    '  /android battery',
    '  /android tap <x> <y>',
    '  /android swipe <x1> <y1> <x2> <y2> [durationMs]',
    '  /android text <message>',
    '  /android shell <command>',
    '',
    'Examples:',
    '  /android screenshot',
    '  /android tap 500 500',
    '  /android swipe 100 500 300 500 300',
    '  /android text "hello world"',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const exec = getAndroidDeps().exec
  const tokens = splitCommandArgs(args)
  const subcommand = tokens[0]?.toLowerCase() ?? ''

  try {
    if (subcommand === 'devices') {
      const output = exec('adb devices -l', { encoding: 'utf8', timeout: 5000 })
      return { type: 'text', value: `Android devices\n${'-'.repeat(40)}\n${output.trim()}` }
    }

    if (subcommand === 'screenshot') {
      const device = getPhoneDevice(exec)
      const adb = (rest: string) =>
        exec(`adb -s ${device} ${rest}`, { encoding: 'utf8', timeout: 20000 })
      adb('shell screencap /sdcard/scr.png')
      adb('pull /sdcard/scr.png /tmp/android_screenshot.png')
      return {
        type: 'text',
        value: 'Android screenshot saved to /tmp/android_screenshot.png',
      }
    }

    if (subcommand === 'battery') {
      const device = getPhoneDevice(exec)
      const adb = (rest: string) =>
        exec(`adb -s ${device} ${rest}`, { encoding: 'utf8', timeout: 20000 })
      const output = adb('shell dumpsys battery')
      return { type: 'text', value: `Android battery\n${'-'.repeat(40)}\n${output.trim()}` }
    }

    if (subcommand === 'tap') {
      const x = Number(tokens[1])
      const y = Number(tokens[2])
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { type: 'text', value: usage('tap requires numeric <x> and <y>.') }
      }
      const device = getPhoneDevice(exec)
      const adb = (rest: string) =>
        exec(`adb -s ${device} ${rest}`, { encoding: 'utf8', timeout: 20000 })
      adb(`shell input tap ${x} ${y}`)
      return { type: 'text', value: `Tapped Android screen at ${x}, ${y}.` }
    }

    if (subcommand === 'swipe') {
      const [x1, y1, x2, y2] = tokens.slice(1, 5).map(Number)
      const duration = tokens[5] ? Number(tokens[5]) : 300
      if (![x1, y1, x2, y2, duration].every(Number.isFinite)) {
        return {
          type: 'text',
          value: usage('swipe requires numeric <x1> <y1> <x2> <y2> [durationMs].'),
        }
      }
      const device = getPhoneDevice(exec)
      const adb = (rest: string) =>
        exec(`adb -s ${device} ${rest}`, { encoding: 'utf8', timeout: 20000 })
      adb(`shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`)
      return {
        type: 'text',
        value: `Swiped Android screen from ${x1},${y1} to ${x2},${y2} in ${duration}ms.`,
      }
    }

    if (subcommand === 'text') {
      const text = tokens.slice(1).join(' ').trim()
      if (!text) {
        return { type: 'text', value: usage('text requires a message.') }
      }
      const escaped = text.replace(/ /g, '%s')
      const device = getPhoneDevice(exec)
      const adb = (rest: string) =>
        exec(`adb -s ${device} ${rest}`, { encoding: 'utf8', timeout: 20000 })
      adb(`shell input text "${escaped}"`)
      return { type: 'text', value: `Sent text to Android device: ${text}` }
    }

    if (subcommand === 'shell') {
      const shellCommand = tokens.slice(1).join(' ').trim()
      if (!shellCommand) {
        return { type: 'text', value: usage('shell requires a command string.') }
      }
      const device = getPhoneDevice(exec)
      const adb = (rest: string) =>
        exec(`adb -s ${device} ${rest}`, { encoding: 'utf8', timeout: 20000 })
      const output = adb(`shell ${shellCommand}`)
      return { type: 'text', value: `Android shell\n${'-'.repeat(40)}\n${output.trim()}` }
    }

    return { type: 'text', value: usage(subcommand ? `Unknown android action: ${subcommand}` : undefined) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { type: 'text', value: `Android command failed: ${message}` }
  }
}
