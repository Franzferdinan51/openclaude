import { existsSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

type FindMmxOptions = {
  env?: NodeJS.ProcessEnv
  exists?: (path: string) => boolean
  homeDir?: string
  platform?: NodeJS.Platform
}

function pushIfSet(paths: string[], value: string | undefined, executable: string): void {
  if (value?.trim()) paths.push(resolve(value, executable))
}

export function getMmxCandidatePaths({
  env = process.env,
  homeDir = homedir(),
  platform = process.platform,
}: Pick<FindMmxOptions, 'env' | 'homeDir' | 'platform'> = {}): string[] {
  const executable = platform === 'win32' ? 'mmx.cmd' : 'mmx'
  const locations: string[] = []

  if (homeDir.trim()) {
    locations.push(resolve(homeDir, '.npm-global', 'bin', executable))
  }

  if (platform === 'win32') {
    pushIfSet(locations, env.APPDATA ? resolve(env.APPDATA, 'npm') : undefined, executable)
    pushIfSet(
      locations,
      env.LOCALAPPDATA ? resolve(env.LOCALAPPDATA, 'Programs', 'npm') : undefined,
      executable,
    )
  }

  locations.push(`/usr/local/bin/${executable}`, `/usr/bin/${executable}`)
  return locations
}

export function findMmx({
  env = process.env,
  exists = existsSync,
  homeDir = homedir(),
  platform = process.platform,
}: FindMmxOptions = {}): string {
  if (env.MMX_BIN?.trim()) return env.MMX_BIN
  const executable = platform === 'win32' ? 'mmx.cmd' : 'mmx'
  const locations = getMmxCandidatePaths({ env, homeDir, platform })
  for (const loc of locations) {
    if (exists(loc)) return loc
  }
  return executable
}
