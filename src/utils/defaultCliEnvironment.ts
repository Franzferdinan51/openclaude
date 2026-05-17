import { isEnvTruthy } from './envUtils.js'

const WINDOWS_FRAGILE_STDIN_ENV = [
  'DUCKHIVE_USE_DATA_STDIN',
  'OPENCLAUDE_USE_DATA_STDIN',
  'DUCKHIVE_USE_READABLE_STDIN',
  'OPENCLAUDE_USE_READABLE_STDIN',
  'DUCKHIVE_USE_CONIN_STDIN',
] as const

const WINDOWS_INHERITED_TUI_ENV = [
  'DUCKHIVE_AUTO_TUI',
  'DUCKHIVE_TUI_DIRECT',
] as const

function getExplicitStdinMode(argv: string[]): 'data' | 'readable' | undefined {
  const equalsArg = argv.find(arg => arg.startsWith('--stdin-mode='))
  const flagIndex = argv.indexOf('--stdin-mode')
  const rawMode = equalsArg
    ? equalsArg.slice('--stdin-mode='.length)
    : flagIndex >= 0
      ? argv[flagIndex + 1]
      : undefined

  return rawMode === 'data' || rawMode === 'readable'
    ? rawMode
    : undefined
}

function isExplicitTuiLaunch(argv: string[]): boolean {
  return argv.slice(2).includes('tui')
}

export function applyDefaultCliEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  runtime = { platform: process.platform },
  argv: string[] = process.argv,
): NodeJS.ProcessEnv {
  if (runtime.platform !== 'win32') {
    return env
  }

  const explicitStdinMode = getExplicitStdinMode(argv)
  if (explicitStdinMode) {
    env.DUCKHIVE_STDIN_MODE = explicitStdinMode
  } else {
    env.DUCKHIVE_STDIN_MODE ??= 'data'
  }

  if (!isEnvTruthy(env.DUCKHIVE_ALLOW_FRAGILE_STDIN)) {
    for (const key of WINDOWS_FRAGILE_STDIN_ENV) {
      delete env[key]
    }
  }

  if (!isEnvTruthy(env.DUCKHIVE_WINDOWS_EARLY_INPUT_EXPERIMENT)) {
    env.DUCKHIVE_DISABLE_EARLY_INPUT ??= '1'
  }

  if (
    !isExplicitTuiLaunch(argv) &&
    !isEnvTruthy(env.DUCKHIVE_TUI_WINDOWS_EXPERIMENT)
  ) {
    for (const key of WINDOWS_INHERITED_TUI_ENV) {
      delete env[key]
    }

    env.DUCKHIVE_DEFAULT_UI_SURFACE = 'legacy'
    env.DUCKHIVE_NO_AUTO_TUI = '1'
  }

  return env
}
