import { isEnvTruthy } from './envUtils.js'

export type CliInputModeWarning = {
  issue: string
  fix: string
}

export function detectCliInputModeWarnings(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): CliInputModeWarning[] {
  if (platform !== 'win32') {
    return []
  }

  const warnings: CliInputModeWarning[] = []

  if (
    env.DUCKHIVE_USE_DATA_STDIN === '1' ||
    env.OPENCLAUDE_USE_DATA_STDIN === '1' ||
    env.DUCKHIVE_USE_READABLE_STDIN === '0' ||
    env.OPENCLAUDE_USE_READABLE_STDIN === '0'
  ) {
    warnings.push({
      issue: 'Windows data stdin override is enabled',
      fix: 'Remove DUCKHIVE_USE_DATA_STDIN=1/OPENCLAUDE_USE_DATA_STDIN=1 or readable-stdin opt-outs to restore the default OpenClaude-compatible readable input path.',
    })
  }

  if (isEnvTruthy(env.DUCKHIVE_USE_CONIN_STDIN)) {
    warnings.push({
      issue: 'Windows CONIN$ stdin override is enabled',
      fix: 'Remove DUCKHIVE_USE_CONIN_STDIN if the UI starts but typing does not appear.',
    })
  }

  return warnings
}
