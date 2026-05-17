import { isEnvTruthy } from './envUtils.js'

const WINDOWS_FRAGILE_STDIN_ENV = [
  'DUCKHIVE_USE_DATA_STDIN',
  'OPENCLAUDE_USE_DATA_STDIN',
  'DUCKHIVE_USE_READABLE_STDIN',
  'OPENCLAUDE_USE_READABLE_STDIN',
  'DUCKHIVE_USE_CONIN_STDIN',
] as const

export function applyDefaultCliEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  runtime = { platform: process.platform },
): NodeJS.ProcessEnv {
  if (runtime.platform !== 'win32') {
    return env
  }

  if (!isEnvTruthy(env.DUCKHIVE_ALLOW_FRAGILE_STDIN)) {
    for (const key of WINDOWS_FRAGILE_STDIN_ENV) {
      delete env[key]
    }
  }

  if (!isEnvTruthy(env.DUCKHIVE_WINDOWS_EARLY_INPUT_EXPERIMENT)) {
    env.DUCKHIVE_DISABLE_EARLY_INPUT ??= '1'
  }

  return env
}
