import { call } from '../commands/voice/voice.js'
import { createCliLocalCommandContext } from './localCommandContext.js'

export async function voiceHandler(args: readonly string[]): Promise<void> {
  const commandArgs =
    args.length === 0 || args.includes('--help') || args.includes('-h')
      ? args.length === 0
        ? 'status'
        : 'help'
      : args.join(' ')
  const result = await call(commandArgs, createCliLocalCommandContext())

  if (result.type === 'text' && result.value.trim().length > 0) {
    process.stdout.write(`${result.value}\n`)
  }
}
