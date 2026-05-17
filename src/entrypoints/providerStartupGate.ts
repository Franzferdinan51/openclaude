const PROVIDER_FREE_COMMANDS = new Set([
  'agents',
  'auth',
  'auto-mode',
  'doctor',
  'install',
  'mcp',
  'plugin',
  'plugins',
  'setup-token',
  'tui',
  'update',
  'upgrade',
])

export function shouldSkipProviderStartup(args: string[]): boolean {
  if (args.includes('--help') || args.includes('-h')) {
    return true
  }

  const command = args.find(arg => arg && !arg.startsWith('-'))
  return command !== undefined && PROVIDER_FREE_COMMANDS.has(command)
}
