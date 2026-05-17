const PROVIDER_FREE_COMMANDS = new Set([
  'agents',
  'auth',
  'auto-mode',
  'doctor',
  'doctor-runtime',
  'install',
  'mcp',
  'plugin',
  'plugins',
  'runtime-doctor',
  'setup-token',
  'tui',
  'update',
  'upgrade',
])

export function isVersionRequest(args: readonly string[]): boolean {
  return args.some(arg => arg === '--version' || arg === '-v' || arg === '-V')
}

export function shouldSkipProviderStartup(args: string[]): boolean {
  if (args.includes('--help') || args.includes('-h') || isVersionRequest(args)) {
    return true
  }

  if (args.includes('--print') || args.includes('-p')) {
    return false
  }

  const command = args.find(arg => arg && !arg.startsWith('-'))
  return command !== undefined && PROVIDER_FREE_COMMANDS.has(command)
}
