export type StartupScreenIO = {
  stdinIsTTY: boolean
  stdoutIsTTY: boolean
}

export function shouldPrintStartupScreen(
  args: string[],
  io: StartupScreenIO = {
    stdinIsTTY: process.stdin.isTTY === true,
    stdoutIsTTY: process.stdout.isTTY === true,
  },
): boolean {
  if (!io.stdinIsTTY || !io.stdoutIsTTY) {
    return false
  }

  if (args[0] === 'tui') {
    return false
  }

  if (args.includes('--print') || args.includes('-p')) {
    return false
  }

  return true
}
