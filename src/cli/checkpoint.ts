import { call } from '../commands/checkpoint/checkpoint-impl.js'
import { createCliLocalCommandContext } from './localCommandContext.js'

export async function checkpointHandler(args: readonly string[]): Promise<void> {
  const commandArgs =
    args.includes('--help') || args.includes('-h')
      ? 'help'
      : args.join(' ')
  const result = await call(commandArgs, createCliLocalCommandContext())

  if (result.type === 'text' && result.value.trim().length > 0) {
    process.stdout.write(`${result.value}\n`)
  }
}
