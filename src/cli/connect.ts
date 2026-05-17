import { createCliLocalCommandContext } from './localCommandContext.js'

export async function connectHandler(args: string[]): Promise<void> {
  const commandArgs =
    args.includes('--help') || args.includes('-h')
      ? ''
      : args.join(' ')

  const { call } = await import('../commands/connect/connect-impl.js')
  const result = await call(commandArgs, createCliLocalCommandContext())

  if (result.type === 'text' && result.value.trim().length > 0) {
    process.stdout.write(`${result.value}\n`)
  }
}
