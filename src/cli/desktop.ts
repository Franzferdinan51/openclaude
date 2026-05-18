import { createCliLocalCommandContext } from './localCommandContext.js'

export async function desktopHandler(args: string[]): Promise<void> {
  const commandArgs =
    args.includes('--help') || args.includes('-h')
      ? 'help'
      : args.join(' ')

  const { call } = await import('../commands/desktop/desktop-impl.js')
  const result = await call(commandArgs, createCliLocalCommandContext())

  if (result.type === 'text' && result.value.trim().length > 0) {
    process.stdout.write(`${result.value}\n`)
  }
}
