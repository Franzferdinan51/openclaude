import { closeSync, openSync } from 'fs'
import { ReadStream } from 'tty'
import type { RenderOptions } from '../ink.js'
import { isEnvTruthy } from './envUtils.js'
import { logError } from './log.js'

// Cached stdin override - computed once per process
let cachedStdinOverride: ReadStream | undefined | null = null

type StdinOverrideOptions = {
  stdinIsTTY?: boolean
  stdoutIsTTY?: boolean
  argv?: string[]
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  openDevice?: (path: string) => number
  createReadStream?: (fd: number) => ReadStream
  closeDevice?: (fd: number) => void
  log?: (error: Error) => void
}

export function getTerminalInputDevicePath(
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  if (platform === 'win32') {
    return 'CONIN$'
  }
  return '/dev/tty'
}

function createTTYReadStream(fd: number): ReadStream {
  const ttyStream = new ReadStream(fd)
  // Some runtimes do not mark streams created from device paths as TTY.
  ttyStream.isTTY = true
  return ttyStream
}

export function createStdinOverride(
  options: StdinOverrideOptions = {},
): ReadStream | undefined {
  const stdinIsTTY = options.stdinIsTTY ?? process.stdin.isTTY
  const stdoutIsTTY = options.stdoutIsTTY ?? process.stdout.isTTY
  const argv = options.argv ?? process.argv
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const openDevice = options.openDevice ?? ((path: string) => openSync(path, 'r'))
  const createReadStream = options.createReadStream ?? createTTYReadStream
  const closeDevice = options.closeDevice ?? closeSync
  const log = options.log ?? logError

  // No override needed if stdin is already a TTY
  if (stdinIsTTY) {
    return undefined
  }

  // Skip in CI environments
  if (isEnvTruthy(env.CI)) {
    return undefined
  }

  // Skip if running MCP (input hijacking breaks MCP)
  if (argv.includes('mcp')) {
    return undefined
  }

  // In normal PowerShell/cmd launches process.stdin is already the right
  // console stream. When shims or parent processes detach stdin while stdout
  // is still a TTY, Ink can paint the REPL but cannot enter raw input mode.
  // In that specific case, reopen CONIN$ as the keyboard owner.
  if (
    platform === 'win32' &&
    !stdoutIsTTY &&
    !isEnvTruthy(env.DUCKHIVE_USE_CONIN_STDIN)
  ) {
    return undefined
  }

  if (platform === 'win32' && isEnvTruthy(env.DUCKHIVE_DISABLE_CONIN_STDIN)) {
    return undefined
  }

  const inputDevicePath = getTerminalInputDevicePath(platform)
  if (!inputDevicePath) {
    return undefined
  }

  let fd: number | undefined
  try {
    fd = openDevice(inputDevicePath)
    return createReadStream(fd)
  } catch (err) {
    if (fd !== undefined) {
      try {
        closeDevice(fd)
      } catch {
        // Best effort: the original error explains why the override failed.
      }
    }
    log(err as Error)
    return undefined
  }
}

/**
 * Gets a ReadStream for the terminal input device when stdin is piped.
 * This allows interactive Ink rendering even when stdin is a pipe.
 * On Windows this leaves process.stdin alone when it is already a TTY. If a
 * PowerShell/npm shim detaches stdin while stdout is still interactive, it
 * falls back to CONIN$ so the classic REPL can actually receive keystrokes.
 * Set DUCKHIVE_DISABLE_CONIN_STDIN=1 to opt out for diagnostics.
 * Result is cached for the lifetime of the process.
 */
function getStdinOverride(): ReadStream | undefined {
  // Return cached result if already computed
  if (cachedStdinOverride !== null) {
    return cachedStdinOverride
  }

  cachedStdinOverride = createStdinOverride()
  return cachedStdinOverride
}

/**
 * Returns base render options for Ink, including stdin override when needed.
 * Use this for all render() calls to ensure piped input works correctly.
 *
 * @param exitOnCtrlC - Whether to exit on Ctrl+C (usually false for dialogs)
 */
export function getBaseRenderOptions(
  exitOnCtrlC: boolean = false,
): RenderOptions {
  const stdin = getStdinOverride()
  const options: RenderOptions = { exitOnCtrlC }
  if (stdin) {
    options.stdin = stdin
  }
  return options
}
