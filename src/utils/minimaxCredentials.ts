import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { execFileNoThrow } from './execFileNoThrow.js'

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>

type MiniMaxCredentialRefreshDeps = {
  execFileNoThrow: typeof execFileNoThrow
  now: () => number
}

export type MiniMaxCredential =
  | { kind: 'api-key'; credential: string; source: string }
  | { kind: 'oauth-access-token'; credential: string; source: string }

const MINI_MAX_REFRESH_COOLDOWN_MS = 5 * 60 * 1000

let lastMiniMaxRefreshAttemptAt = 0

function trimString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined
}

function readJsonFile(path: string): unknown {
  try {
    if (!existsSync(path)) {
      return undefined
    }
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

function getMiniMaxHome(processEnv: EnvLike): string {
  const override = trimString(processEnv.MMX_HOME)
  return override ?? join(homedir(), '.mmx')
}

function getMiniMaxHomeDisplayPath(processEnv: EnvLike): string {
  const override = trimString(processEnv.MMX_HOME)
  return override ?? '~/.mmx'
}

function mmxExecutableName(platform = process.platform): string {
  return platform === 'win32' ? 'mmx.cmd' : 'mmx'
}

function executableExists(path: string): boolean {
  try {
    return existsSync(path)
  } catch {
    return false
  }
}

function findInPath(
  executable: string,
  processEnv: EnvLike,
): string | undefined {
  const pathValue = trimString(processEnv.PATH)
  if (!pathValue) {
    return undefined
  }

  for (const dir of pathValue.split(delimiter)) {
    if (!dir) {
      continue
    }

    const candidate = join(dir, executable)
    if (executableExists(candidate)) {
      return candidate
    }
  }

  return undefined
}

function resolveMiniMaxCliBinary(
  processEnv: EnvLike = process.env,
  platform = process.platform,
): string | undefined {
  const override = trimString(processEnv.MMX_BIN)
  if (override) {
    return override
  }

  const executable = mmxExecutableName(platform)
  const candidates = [
    resolve(homedir(), '.npm-global', 'bin', executable),
    processEnv.LOCALAPPDATA
      ? resolve(processEnv.LOCALAPPDATA, 'Programs', 'npm', executable)
      : '',
    `/usr/local/bin/${executable}`,
    `/usr/bin/${executable}`,
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (executableExists(candidate)) {
      return candidate
    }
  }

  return findInPath(executable, processEnv)
}

function walkForNamedString(
  value: unknown,
  predicate: (key: string, value: string) => boolean,
): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const trimmed = trimString(nested)
    if (trimmed && predicate(key, trimmed)) {
      return trimmed
    }
    const nestedMatch = walkForNamedString(nested, predicate)
    if (nestedMatch) {
      return nestedMatch
    }
  }

  return undefined
}

function readMiniMaxConfigApiKey(path: string): string | undefined {
  const json = readJsonFile(path)
  return walkForNamedString(json, (key, value) => {
    const normalizedKey = key.trim().toLowerCase().replace(/[-_\s]+/g, '')
    if (
      normalizedKey !== 'apikey' &&
      normalizedKey !== 'minimaxapikey' &&
      normalizedKey !== 'token'
    ) {
      return false
    }
    return value.startsWith('sk-')
  })
}

function readMiniMaxOauthAccessToken(path: string): string | undefined {
  const json = readJsonFile(path)
  return walkForNamedString(json, (key, value) => {
    const normalizedKey = key.trim().toLowerCase().replace(/[-_\s]+/g, '')
    if (
      normalizedKey !== 'accesstoken' &&
      normalizedKey !== 'token' &&
      normalizedKey !== 'bearertoken'
    ) {
      return false
    }
    return value.length >= 16
  })
}

export function readMiniMaxCredential(
  processEnv: EnvLike = process.env,
): MiniMaxCredential | null {
  const envApiKey = trimString(processEnv.MINIMAX_API_KEY)
  if (envApiKey) {
    return {
      kind: 'api-key',
      credential: envApiKey,
      source: 'MINIMAX_API_KEY',
    }
  }

  const mmxApiKey = trimString(processEnv.MMX_API_KEY)
  if (mmxApiKey) {
    return {
      kind: 'api-key',
      credential: mmxApiKey,
      source: 'MMX_API_KEY',
    }
  }

  const mmxHome = getMiniMaxHome(processEnv)
  const configApiKey = readMiniMaxConfigApiKey(join(mmxHome, 'config.json'))
  if (configApiKey) {
    return {
      kind: 'api-key',
      credential: configApiKey,
      source: '~/.mmx/config.json',
    }
  }

  const oauthAccessToken = readMiniMaxOauthAccessToken(
    join(mmxHome, 'credentials.json'),
  )
  if (oauthAccessToken) {
    return {
      kind: 'oauth-access-token',
      credential: oauthAccessToken,
      source: '~/.mmx/credentials.json',
    }
  }

  return null
}

export function readMiniMaxRuntimeToken(
  processEnv: EnvLike = process.env,
): string | undefined {
  return readMiniMaxCredential(processEnv)?.credential
}

export function readMiniMaxApiKey(
  processEnv: EnvLike = process.env,
): string | undefined {
  const credential = readMiniMaxCredential(processEnv)
  return credential?.kind === 'api-key' ? credential.credential : undefined
}

export async function resolveMiniMaxCredentialWithRefresh(
  processEnv: EnvLike = process.env,
  deps: MiniMaxCredentialRefreshDeps = {
    execFileNoThrow,
    now: () => Date.now(),
  },
): Promise<MiniMaxCredential | null> {
  const currentCredential = readMiniMaxCredential(processEnv)
  if (!currentCredential || currentCredential.kind !== 'oauth-access-token') {
    return currentCredential
  }

  const now = deps.now()
  if (
    lastMiniMaxRefreshAttemptAt > 0 &&
    now - lastMiniMaxRefreshAttemptAt < MINI_MAX_REFRESH_COOLDOWN_MS
  ) {
    return currentCredential
  }

  const mmxBinary = resolveMiniMaxCliBinary(processEnv)
  if (!mmxBinary) {
    return currentCredential
  }

  lastMiniMaxRefreshAttemptAt = now

  const refreshResult = await deps.execFileNoThrow(
    mmxBinary,
    ['auth', 'refresh'],
    {
      env: processEnv as NodeJS.ProcessEnv,
      timeout: 60_000,
      useCwd: false,
      stdin: 'ignore',
    },
  )

  if (refreshResult.code !== 0) {
    return currentCredential
  }

  return (
    readMiniMaxCredential(processEnv) ?? {
      kind: 'oauth-access-token',
      credential: currentCredential.credential,
      source: `${getMiniMaxHomeDisplayPath(processEnv)}/credentials.json`,
    }
  )
}

export function resetMiniMaxCredentialRefreshStateForTesting(): void {
  lastMiniMaxRefreshAttemptAt = 0
}
