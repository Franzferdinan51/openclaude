type HiveCommand =
  | 'council'
  | 'decree'
  | 'orchestrate'
  | 'senate'
  | 'swarm'
  | 'team'

const HIVE_COMMANDS: Record<HiveCommand, () => Promise<{ call: (args: string) => Promise<{ type: string; value?: string }> }>> = {
  council: () => import('../commands/hive-council/council-impl.js'),
  decree: () => import('../commands/hive-decree/decree-impl.js'),
  orchestrate: () => import('../commands/hive-orchestrate/orchestrate-impl.js'),
  senate: () => import('../commands/hive-senate/senate-impl.js'),
  swarm: () => import('../commands/hive-swarm/swarm-impl.js'),
  team: () => import('../commands/hive-team/team-impl.js'),
}

export async function hiveCommandHandler(command: HiveCommand, args: string[]): Promise<void> {
  const helpArgsByCommand: Record<HiveCommand, string> = {
    council: '',
    decree: '',
    orchestrate: '',
    senate: '',
    swarm: '',
    team: 'help',
  }
  const commandArgs =
    args.includes('--help') || args.includes('-h')
      ? helpArgsByCommand[command]
      : args.join(' ')

  const { call } = await HIVE_COMMANDS[command]()
  const result = await call(commandArgs)

  if (result.type === 'text' && result.value?.trim()) {
    process.stdout.write(`${result.value}\n`)
  }
}

export function isHiveCommand(command: string | undefined): command is HiveCommand {
  return command !== undefined && command in HIVE_COMMANDS
}
