import type { LocalCommandCall } from '../../types/command.js'
import {
  addProviderProfile,
  getProviderPresetDefaults,
} from '../../utils/providerProfiles.js'

type ParsedArgs =
  | {
      ok: true
      help: boolean
      baseUrl?: string
      model?: string
      apiKey?: string
    }
  | { ok: false; error: string }

function parseArgs(args: string): ParsedArgs {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  const parsed: Extract<ParsedArgs, { ok: true }> = { ok: true, help: false }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const [flag, inlineValue] = token.split(/=(.*)/s, 2)

    if (flag === '--help' || flag === '-h') {
      parsed.help = true
      continue
    }

    if (flag === '--base-url' || flag === '--model' || flag === '--api-key') {
      const value = inlineValue ?? tokens[++i]
      if (!value?.trim()) {
        return { ok: false, error: `${flag} requires a value.` }
      }
      if (flag === '--base-url') parsed.baseUrl = value.trim()
      if (flag === '--model') parsed.model = value.trim()
      if (flag === '--api-key') parsed.apiKey = value.trim()
      continue
    }

    return { ok: false, error: `Unknown option: ${token}` }
  }

  return parsed
}

function usage(error?: string): string {
  const lines = [
    'LM Studio setup',
    '',
    'Usage:',
    '  /lmstudio-init [--base-url <url>] [--model <model>] [--api-key <key>]',
    '',
    'Defaults:',
    '  --base-url http://localhost:1234/v1',
    '  --model local-model',
    '',
    'LM Studio normally accepts any non-empty API key, so DuckHive uses "lm-studio" by default.',
  ]

  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const parsed = parseArgs(args)
  if (!parsed.ok) {
    return { type: 'text', value: usage(parsed.error) }
  }
  if (parsed.help) {
    return { type: 'text', value: usage() }
  }

  const defaults = getProviderPresetDefaults('lmstudio')
  const profile = addProviderProfile(
    {
      provider: defaults.provider,
      name: defaults.name,
      baseUrl: parsed.baseUrl ?? defaults.baseUrl,
      model: parsed.model ?? defaults.model,
      apiKey: parsed.apiKey ?? 'lm-studio',
    },
    { makeActive: true },
  )

  if (!profile) {
    return {
      type: 'text',
      value: 'Could not create the LM Studio provider profile. Check the base URL and model, then try again.',
    }
  }

  return {
    type: 'text',
    value: [
      'LM Studio provider is active.',
      `Endpoint: ${profile.baseUrl}`,
      `Model: ${profile.model}`,
      '',
      'Start the LM Studio local server, then continue in DuckHive. You can edit this later with /provider.',
    ].join('\n'),
  }
}
