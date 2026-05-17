#!/usr/bin/env node

/**
 * Keep the outer Node launcher narrowly focused on repo-local concerns.
 *
 * Provider/model resolution belongs to the real CLI bootstrap
 * (entrypoints/cli.tsx -> buildStartupEnvFromProfile). If the launcher starts
 * forcing OPENAI_* defaults first, it can override the saved provider/profile
 * state and make startup appear to "default back" to ChatGPT/OpenAI.
 */

export function applyLauncherProviderDefaults(
  env = process.env,
  config = null,
) {
  const nextEnv = env

  if (config?.providers?.default && !nextEnv.DUCKHIVE_PROVIDER) {
    nextEnv.DUCKHIVE_PROVIDER = config.providers.default
  }

  return nextEnv
}
