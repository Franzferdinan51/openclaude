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
  onUnavailable?: (result: StandaloneTuiUnavailableResult) => void
}

export type StandaloneTuiBuildCommand = {
  cwd: string
  command: string
  args: string[]
}

export type StandaloneTuiUnavailableReason =
  | 'missing-source'
  | 'missing-go'
  | 'build-failed'
  | 'missing-binary'

export type StandaloneTuiAvailableResult = {
  available: true
  executablePath: string
}

export type StandaloneTuiUnavailableResult = {
  available: false
  executablePath: string
  reason: StandaloneTuiUnavailableReason
  message: string
}

type StandaloneTuiAvailabilityResult =
  | StandaloneTuiAvailableResult
  | StandaloneTuiUnavailableResult

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

export function formatStandaloneTuiUnavailableMessage(
  baseDir: string,
  reason: StandaloneTuiUnavailableReason,
  platform = process.platform,
): string {
  const isWindows = platform === 'win32'
  const executablePath = isWindows ? 'tui\\duckhive-tui.exe' : 'tui/duckhive-tui'
  const sourcePath = isWindows
    ? 'tui\\cmd\\duckhive-tui\\main.go'
    : 'tui/cmd/duckhive-tui/main.go'
  const installScript = isWindows ? 'scripts\\install.ps1' : 'scripts/install.sh'
  const build = getStandaloneTuiBuildCommand(baseDir, platform)
  const buildCommand = isWindows
    ? `cd tui; ${build.command} ${build.args.join(' ')}`
    : `cd tui && ${build.command} ${build.args.join(' ')}`

  switch (reason) {
    case 'missing-go':
      return `DuckHive TUI binary was not found and Go is not installed, so DuckHive could not build \`${executablePath}\`. Install Go from https://go.dev/dl/, then run \`${installScript}\` or \`duckhive tui\` again. The default classic REPL still works with \`duckhive\`.`
    case 'missing-source':
      return `DuckHive TUI source was not found at \`${sourcePath}\`. Reinstall DuckHive from GitHub or use the default classic REPL with \`duckhive\`.`
    case 'build-failed':
      return `DuckHive TUI binary was not found and the on-demand build failed. Run \`${buildCommand}\` to see the Go compiler error, or use the default classic REPL with \`duckhive\`.`
    case 'missing-binary':
      return `DuckHive TUI build completed but \`${executablePath}\` was still not created. Run \`${installScript}\` or \`${buildCommand}\`, then try \`duckhive tui\` again.`
  }
}

async function ensureStandaloneTuiExecutable(
  baseDir: string,
): Promise<StandaloneTuiAvailabilityResult> {
  const tuiPath = getStandaloneTuiExecutablePath(baseDir)
  if (existsSync(tuiPath)) {
    return {
      available: true,
      executablePath: tuiPath,
    }
  }

  if (!existsSync(join(baseDir, 'tui', 'cmd', 'duckhive-tui', 'main.go'))) {
    return {
      available: false,
      executablePath: tuiPath,
      reason: 'missing-source',
      message: formatStandaloneTuiUnavailableMessage(baseDir, 'missing-source'),
    }
  }

  const { spawnSync } = await import('child_process')
  const build = getStandaloneTuiBuildCommand(baseDir)
  const result = spawnSync(build.command, build.args, {
    cwd: build.cwd,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error && 'code' in result.error && result.error.code === 'ENOENT') {
    return {
      available: false,
      executablePath: tuiPath,
      reason: 'missing-go',
      message: formatStandaloneTuiUnavailableMessage(baseDir, 'missing-go'),
    }
  }

  if (result.status !== 0) {
    return {
      available: false,
      executablePath: tuiPath,
      reason: 'build-failed',
      message: formatStandaloneTuiUnavailableMessage(baseDir, 'build-failed'),
    }
  }

  if (!existsSync(tuiPath)) {
    return {
      available: false,
      executablePath: tuiPath,
      reason: 'missing-binary',
      message: formatStandaloneTuiUnavailableMessage(baseDir, 'missing-binary'),
    }
  }

  return {
    available: true,
    executablePath: tuiPath,
  }
}

export async function launchStandaloneTui(
  baseDir: string,
  options?: LaunchStandaloneTuiOptions,
): Promise<boolean> {
  const args = options?.args ?? []
  const env = buildStandaloneTuiLaunchEnv(baseDir, options)

  const availability = await ensureStandaloneTuiExecutable(baseDir)
  if (!availability.available) {
    options?.onUnavailable?.(availability)
    return false
  }
  const tuiPath = availability.executablePath

  const helperPath = join(baseDir, 'bin', 'tui-pty-helper.py')
  const isSnapshot = args.includes('--snapshot') || args.includes('snapshot')
  if (!isSnapshot && shouldUseStandaloneTuiHelper(baseDir, env)) {
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
