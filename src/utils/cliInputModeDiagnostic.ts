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
    env.DUCKHIVE_USE_READABLE_STDIN === '1' ||
    env.OPENCLAUDE_USE_READABLE_STDIN === '1'
  ) {
    warnings.push({
      issue: 'Windows readable stdin override is enabled',
      fix: 'Remove DUCKHIVE_USE_READABLE_STDIN=1/OPENCLAUDE_USE_READABLE_STDIN=1 to restore DuckHive\'s PowerShell-safe data input path.',
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
