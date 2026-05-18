const PROVIDER_FREE_COMMANDS = new Set([
  'agents',
  'auth',
  'auto-mode',
  'doctor',
  'doctor:runtime',
  'doctor-runtime',
  'input-test',
  'install',
  'mcp',
  'plugin',
  'plugins',
  'skill',
  'skill-workshop',
  'skills',
  'goal',
  'g',
  'computer-use',
  'cu',
  'comput-use',
  'config',
  'settings',
  'mmx',
  'minimax',
  'provider',
  'permissions',
  'allowed-tools',
  'run',
  'runs',
  'agent-run',
  'channel',
  'connect',
  'telegram',
  'team',
  'council',
  'senate',
  'decree',
  'swarm',
  'orchestrate',
  'spawn',
  'subagent',
  'deep-dive',
  'ps',
  'logs',
  'attach',
  'pause',
  'resume',
  'approve',
  'recover',
  'kill',
  'runtime-doctor',
  'setup-token',
  'tui',
  'update',
  'upgrade',
])

const PROVIDER_FREE_PRINT_SLASH_COMMANDS = new Set([
  ...PROVIDER_FREE_COMMANDS,
  'android',
  'adb',
  'vision',
  'vision-assist',
  'shadow',
  'shadow-git',
  'checkpoint',
  'snap',
  'savepoint',
  'router',
  'route-model',
  'model-router',
  'budget',
  'spend',
  'cache',
  'provider-cache',
  'export',
  'loop',
  'permissions',
  'allowed-tools',
])

const GLOBAL_OPTIONS_WITH_VALUE = new Set([
  '--debug-file',
  '--effort',
  '--fallback-model',
  '--input-format',
  '--json-schema',
  '--max-budget-usd',
  '--max-turns',
  '--model',
  '--name',
  '--output-format',
  '--permission-mode',
  '--provider',
  '--session-id',
  '--setting-sources',
  '--settings',
  '--stdin-mode',
  '--system-prompt',
])

export function isVersionRequest(args: readonly string[]): boolean {
  return args.some(arg => arg === '--version' || arg === '-v' || arg === '-V')
}

export function getCliCommandPosition(
  args: readonly string[],
): { command: string; index: number } | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '--') {
      const command = args[i + 1]
      return command ? { command, index: i + 1 } : undefined
    }

    if (arg.startsWith('--')) {
      const option = arg.split('=', 1)[0]
      if (!arg.includes('=') && GLOBAL_OPTIONS_WITH_VALUE.has(option)) {
        i++
      }
      continue
    }

    if (arg.startsWith('-')) {
      continue
    }

    return { command: arg, index: i }
  }

  return undefined
}

function getPrintPrompt(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-p' || arg === '--print') {
      return args[i + 1]
    }
  }
  return undefined
}

function isProviderFreePrintSlashCommand(args: readonly string[]): boolean {
  const prompt = getPrintPrompt(args)
  if (!prompt?.startsWith('/')) {
    return false
  }

  const command = prompt.slice(1).trim().split(/\s+/, 1)[0]
  return Boolean(command && PROVIDER_FREE_PRINT_SLASH_COMMANDS.has(command))
}

export function shouldSkipProviderStartup(args: string[]): boolean {
  if (args.includes('--help') || args.includes('-h') || isVersionRequest(args)) {
    return true
  }

  if (args.includes('--bg') || args.includes('--background')) {
    return true
  }

  if (args.includes('--print') || args.includes('-p')) {
    return isProviderFreePrintSlashCommand(args)
  }

  const command = getCliCommandPosition(args)?.command
  return command !== undefined && PROVIDER_FREE_COMMANDS.has(command)
}
