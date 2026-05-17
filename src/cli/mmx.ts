import { MMX_HELP_TEXT } from '../commands/mmx/duckhiveMmxCommand.js'
import { runMmxCommand } from '../commands/mmx/index.js'

export async function mmxHandler(args: string[]): Promise<void> {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${MMX_HELP_TEXT}\n`)
    return
  }

  try {
    await runMmxCommand(['--non-interactive', ...args])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Error: ${message}\n`)
    process.exitCode = 1
  }
}
