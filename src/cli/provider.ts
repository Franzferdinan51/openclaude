function hasHelpFlag(args: readonly string[]): boolean {
  return args.includes('--help') || args.includes('-h')
}

function usage(): string {
  return [
    'DuckHive provider profiles',
    '',
    'Usage:',
    '  duckhive provider status',
    '  duckhive provider --help',
    '',
    'REPL:',
    '  /provider',
    '',
    'The interactive /provider manager adds, edits, deletes, and activates provider profiles.',
    'The terminal status command is provider-free so provider routing can be diagnosed before the chat UI starts.',
  ].join('\n')
}

export async function providerHandler(args: readonly string[]): Promise<void> {
  const command = args[0]?.toLowerCase()
  if (!command || hasHelpFlag(args) || command === 'help') {
    process.stdout.write(`${usage()}\n`)
    return
  }

  if (command !== 'status' && command !== 'show') {
    process.stderr.write(`${usage()}\n\nUnknown provider command: ${args[0]}\n`)
    process.exitCode = 1
    return
  }

  const { applySafeConfigEnvironmentVariables } = await import('../utils/managedEnv.js')
  applySafeConfigEnvironmentVariables()
  const { hydrateGithubModelsTokenFromSecureStorage } = await import('../utils/githubModelsCredentials.js')
  hydrateGithubModelsTokenFromSecureStorage()

  const { applyActiveProviderProfileFromConfig } = await import('../utils/providerProfiles.js')
  applyActiveProviderProfileFromConfig(undefined, { force: true })

  const {
    getRouteDefaultBaseUrl,
    getRouteDefaultModel,
    getRouteLabel,
    resolveActiveRouteIdFromEnv,
  } = await import('../integrations/index.js')
  const { buildCurrentProviderSummary } = await import('../commands/provider/provider.js')
  const summary = buildCurrentProviderSummary()
  const routeId = resolveActiveRouteIdFromEnv(process.env)
  const providerLabel =
    routeId && routeId !== 'anthropic'
      ? (getRouteLabel(routeId) ?? summary.providerLabel)
      : summary.providerLabel
  const modelLabel =
    routeId && routeId !== 'anthropic'
      ? (process.env.OPENAI_MODEL || getRouteDefaultModel(routeId) || summary.modelLabel)
      : summary.modelLabel
  const endpointLabel =
    routeId && routeId !== 'anthropic'
      ? (process.env.OPENAI_BASE_URL || getRouteDefaultBaseUrl(routeId) || summary.endpointLabel)
      : summary.endpointLabel
  process.stdout.write(
    [
      'DuckHive Provider Status',
      '-'.repeat(40),
      `Provider: ${providerLabel}`,
      `Model: ${modelLabel}`,
      `Endpoint: ${endpointLabel}`,
      `Saved profile: ${summary.savedProfileLabel}`,
      '',
      'Run /provider in the REPL to add, edit, delete, or activate provider profiles.',
    ].join('\n') + '\n',
  )
}
