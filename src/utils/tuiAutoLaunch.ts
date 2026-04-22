import { existsSync } from 'fs'
import { join } from 'path'

export function shouldAutoLaunchStandaloneTui(args: string[] = process.argv.slice(2)): boolean {
  return false // Go TUI auto-launch disabled
}

export async function launchStandaloneTui(baseDir: string): Promise<boolean> {
  return false // Go TUI auto-launch disabled
}
