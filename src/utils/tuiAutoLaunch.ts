import { existsSync } from 'fs'
import { join } from 'path'

export function shouldAutoLaunchStandaloneTui(args: string[] = process.argv.slice(2)): boolean {
  // REPL auto-launches when stdin/stdout are both TTY (real terminal)
  return (
    args.length === 0 &&
    process.stdin.isTTY === true &&
    process.stdout.isTTY === true &&
    process.env.DUCKHIVE_NO_AUTO_TUI !== '1'
  )
}

export async function launchStandaloneTui(baseDir: string): Promise<boolean> {
  // This is no longer used — REPL is launched directly from bin/duckhive
  return false
}
