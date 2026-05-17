import { isEnvTruthy } from './envUtils.js'

export function applyDefaultCliEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  runtime = { platform: process.platform },
): NodeJS.ProcessEnv {
  if (
    runtime.platform === 'win32' &&
    !isEnvTruthy(env.DUCKHIVE_WINDOWS_EARLY_INPUT_EXPERIMENT)
  ) {
    env.DUCKHIVE_DISABLE_EARLY_INPUT ??= '1'
    env.DUCKHIVE_USE_DATA_STDIN ??= '1'
  }

  return env
}
