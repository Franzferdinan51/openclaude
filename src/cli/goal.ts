export async function goalHandler(args: string[]): Promise<void> {
  const goalCommandArgs =
    args.includes('--help') || args.includes('-h')
      ? ['help']
      : args

  const { default: goalCommand } = await import('../commands/goal/goal.js')
  const output = await goalCommand(goalCommandArgs)

  if (output.trim().length > 0) {
    process.stdout.write(`${output}\n`)
  }
}
