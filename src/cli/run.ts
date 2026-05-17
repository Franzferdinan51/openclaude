export async function runHandler(args: string[]): Promise<void> {
  const commandArgs =
    args.includes('--help') || args.includes('-h')
      ? 'help'
      : args.join(' ')

  const { call } = await import('../commands/run/run-impl.js')
  const result = await call(commandArgs)

  if (result.type === 'text' && result.value.trim().length > 0) {
    process.stdout.write(`${result.value}\n`)
  }
}
