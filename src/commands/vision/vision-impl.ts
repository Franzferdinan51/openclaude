import type { LocalCommandCall } from '../../types/command.js'
import { execSync } from 'child_process'

type VisionDeps = {
  exec: (command: string, options?: { timeout?: number }) => string | Buffer
}

let visionTestDeps: Partial<VisionDeps> | null = null

function getVisionDeps(): VisionDeps {
  return {
    exec: (command, options) => execSync(command, options),
    ...visionTestDeps,
  }
}

export function setVisionTestDeps(overrides: Partial<VisionDeps> | null): void {
  visionTestDeps = overrides
}

function splitCommandArgs(args: string): { args: string[]; error?: string } {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaping = false

  for (const char of args) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === '\\') {
      escaping = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (escaping) {
    current += '\\'
  }

  if (quote) {
    return {
      args: [],
      error: `Unterminated quoted string in /vision arguments. Close the ${quote} quote and try again.`,
    }
  }

  if (current) {
    tokens.push(current)
  }

  return { args: tokens }
}

function usage(error?: string): string {
  const lines = [
    'Vision',
    '',
    'Usage:',
    '  /vision phone_screenshot',
    '  /vision analyze <prompt>',
    '  /vision phone_tap <x> <y>',
    '',
    'Examples:',
    '  /vision phone_screenshot',
    '  /vision analyze "Describe the screenshot"',
    '  /vision phone_tap 500 500',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const exec = getVisionDeps().exec
  const parsed = splitCommandArgs(args)
  if (parsed.error) {
    return { type: 'text', value: usage(parsed.error) }
  }
  const tokens = parsed.args
  const subcommand = tokens[0]?.toLowerCase() ?? ''
  const device = '192.168.1.251:40835'

  try {
    if (subcommand === 'phone_screenshot' || subcommand === 'capture') {
      exec(`adb -s ${device} shell screencap /sdcard/scr.png`, { timeout: 10000 })
      exec(`adb -s ${device} pull /sdcard/scr.png /tmp/vision_screenshot.png`, { timeout: 10000 })
      return {
        type: 'text',
        value: 'Vision screenshot saved to /tmp/vision_screenshot.png',
      }
    }

    if (subcommand === 'analyze') {
      const prompt = tokens.slice(1).join(' ').trim()
      if (!prompt) {
        return { type: 'text', value: usage('analyze requires a prompt.') }
      }
      return {
        type: 'text',
        value: `Vision analysis queued\n${'-'.repeat(40)}\nPrompt: ${prompt}\nImage: /tmp/vision_screenshot.png`,
      }
    }

    if (subcommand === 'phone_tap') {
      const x = Number(tokens[1])
      const y = Number(tokens[2])
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { type: 'text', value: usage('phone_tap requires numeric <x> and <y>.') }
      }
      exec(`adb -s ${device} shell input tap ${x} ${y}`, { timeout: 5000 })
      return { type: 'text', value: `Vision tap sent to ${x}, ${y}.` }
    }

    return { type: 'text', value: usage(subcommand ? `Unknown vision action: ${subcommand}` : undefined) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { type: 'text', value: `Vision command failed: ${message}` }
  }
}
