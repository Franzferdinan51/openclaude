import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  getPreferredDuckHiveUISurface,
  type DuckHiveConfig,
} from './duckhiveUi.js'
import { isEnvTruthy } from './envUtils.js'

export type LaunchStandaloneTuiOptions = {
  args?: string[]
  env?: NodeJS.ProcessEnv
  bridgeCmd?: string
  bridgeArgs?: string[]
}

export type StandaloneTuiBuildCommand = {
  cwd: string
  command: string
  args: string[]
}

export function resolveDuckHiveBaseDir(
  startPath = fileURLToPath(import.meta.url),
  fileExists: (path: string) => boolean = existsSync,
): string {
  let currentDir = dirname(startPath)

  for (let i = 0; i < 8; i++) {
    if (
      fileExists(join(currentDir, 'package.json')) &&
      (fileExists(join(currentDir, 'bin', 'duckhive')) ||
        fileExists(join(currentDir, 'dist', 'cli.mjs')))
    ) {
      return currentDir
    }

    const parent = dirname(currentDir)
    if (parent === currentDir) break
    currentDir = parent
  }

  return dirname(dirname(startPath))
}

export function shouldAutoLaunchStandaloneTui(
  args: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  io = {
    stdinIsTTY: process.stdin.isTTY === true,
    stdoutIsTTY: process.stdout.isTTY === true,
  },
  config?: DuckHiveConfig,
  runtime = {
    platform: process.platform,
  },
): boolean {
  // Windows console input through the standalone Bubble Tea handoff is not yet
  // reliable enough for the default no-args startup path. Keep the classic REPL
  // as the safe default there unless the user explicitly opts back in.
  if (
    runtime.platform === 'win32' &&
    !isEnvTruthy(env.DUCKHIVE_TUI_WINDOWS_EXPERIMENT)
  ) {
    return false
  }

  return (
    args.length === 0 &&
    io.stdinIsTTY &&
    io.stdoutIsTTY &&
    getPreferredDuckHiveUISurface(env, config) === 'tui'
  )
}

async function spawnAndWaitForStart(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  const { spawn } = await import('child_process')

  return await new Promise(resolve => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    })

    let started = false
    const exitPoll = setInterval(() => {
      if (child.exitCode !== null || child.signalCode !== null) {
        finish(child.exitCode, child.signalCode)
      }
    }, 50)

    const resolveOnce = (value: boolean) => {
      clearInterval(exitPoll)
      resolve(value)
    }
    const finish = (code: number | null, signal?: NodeJS.Signals | null) => {
      if (!started) {
        resolveOnce(false)
        return
      }
      if (signal === 'SIGINT') {
        process.exitCode = 130
      } else {
        process.exitCode = code ?? 0
      }
      resolveOnce(true)
    }
    const onError = () => resolveOnce(false)

    child.once('error', onError)
    child.once('close', finish)
    child.once('spawn', () => {
      started = true
      child.off('error', onError)
    })
  })
}

export function getDefaultStandaloneTuiBridgeArgs(baseDir: string): string[] {
  return [
    join(baseDir, 'dist', 'cli.mjs'),
    '--print',
    '--bare',
    '--verbose',
    '--output-format=stream-json',
    '--input-format=stream-json',
  ]
}

export function shouldUseStandaloneTuiHelper(
  baseDir: string,
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (path: string) => boolean = existsSync,
): boolean {
  const isTruthy = (value: string | undefined): boolean =>
    value !== undefined && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())

  if (
    isTruthy(env.DUCKHIVE_TUI_DIRECT) ||
    isTruthy(env.DUCKHIVE_TUI_SKIP_PTY_HELPER)
  ) {
    return false
  }

  const helperPath = join(baseDir, 'bin', 'tui-pty-helper.py')
  return fileExists(helperPath.replace(/\\/g, '/'))
}

export function buildStandaloneTuiLaunchEnv(
  baseDir: string,
  options?: LaunchStandaloneTuiOptions,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...options?.env,
    DUCKHIVE_AUTO_TUI: '1',
    DUCKHIVE_DEFAULT_UI_SURFACE: 'tui',
    CLAUDE_CODE_SIMPLE: '1',
  }

  delete env.DUCKHIVE_NO_AUTO_TUI

  const bridgeCmd = options?.bridgeCmd ?? process.execPath
  const bridgeArgs =
    options?.bridgeArgs ?? getDefaultStandaloneTuiBridgeArgs(baseDir)

  env.DUCKHIVE_BRIDGE_CMD = bridgeCmd
  env.DUCKHIVE_BRIDGE_ARGS = bridgeArgs.join(' ')
  env.DUCKHIVE_LAUNCHER_CMD = process.execPath
  if (process.argv[1]) {
    env.DUCKHIVE_LAUNCHER_ENTRY = process.argv[1]
  }

  return env
}

export function getStandaloneTuiExecutablePath(
  baseDir: string,
  platform = process.platform,
): string {
  return join(
    baseDir,
    'tui',
    platform === 'win32' ? 'duckhive-tui.exe' : 'duckhive-tui',
  )
}

export function getStandaloneTuiBuildCommand(
  baseDir: string,
  platform = process.platform,
): StandaloneTuiBuildCommand {
  return {
    cwd: join(baseDir, 'tui'),
    command: 'go',
    args: [
      'build',
      '-o',
      platform === 'win32' ? 'duckhive-tui.exe' : 'duckhive-tui',
      './cmd/duckhive-tui',
    ],
  }
}

async function ensureStandaloneTuiExecutable(
  baseDir: string,
): Promise<boolean> {
  const tuiPath = getStandaloneTuiExecutablePath(baseDir)
  if (existsSync(tuiPath)) {
    return true
  }

  if (!existsSync(join(baseDir, 'tui', 'cmd', 'duckhive-tui', 'main.go'))) {
    return false
  }

  const { spawnSync } = await import('child_process')
  const build = getStandaloneTuiBuildCommand(baseDir)
  const result = spawnSync(build.command, build.args, {
    cwd: build.cwd,
    env: process.env,
    stdio: 'inherit',
  })

  return result.status === 0 && existsSync(tuiPath)
}

export async function launchStandaloneTui(
  baseDir: string,
  options?: LaunchStandaloneTuiOptions,
): Promise<boolean> {
  const args = options?.args ?? []
  const env = buildStandaloneTuiLaunchEnv(baseDir, options)

  const tuiPath = getStandaloneTuiExecutablePath(baseDir)
  if (!(await ensureStandaloneTuiExecutable(baseDir))) {
    return false
  }

  const helperPath = join(baseDir, 'bin', 'tui-pty-helper.py')
  if (shouldUseStandaloneTuiHelper(baseDir, env)) {
    const helperStarted = await spawnAndWaitForStart(
      'python3',
      [helperPath, ...args],
      env,
    )
    if (helperStarted) {
      return true
    }
  }

  return await spawnAndWaitForStart(tuiPath, args, env)
}
