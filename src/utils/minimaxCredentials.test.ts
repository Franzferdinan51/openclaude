import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, mock, test } from 'bun:test'

import { buildMiniMaxProfileEnv } from './providerProfile.js'
import {
  readMiniMaxCredential,
  readMiniMaxRuntimeToken,
  resetMiniMaxCredentialRefreshStateForTesting,
  resolveMiniMaxCredentialWithRefresh,
} from './minimaxCredentials.js'

const tempDirs: string[] = []

afterEach(() => {
  resetMiniMaxCredentialRefreshStateForTesting()
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function makeMmxHome(): string {
  const dir = mkdtempSync(join(tmpdir(), 'duckhive-mmx-'))
  tempDirs.push(dir)
  return dir
}

test('reads MMX_API_KEY env as MiniMax API-key auth', () => {
  expect(readMiniMaxCredential({ MMX_API_KEY: 'sk-mmx-env' })).toEqual({
    kind: 'api-key',
    credential: 'sk-mmx-env',
    source: 'MMX_API_KEY',
  })
})

test('reads ~/.mmx/config.json API key fallback', () => {
  const mmxHome = makeMmxHome()
  writeFileSync(
    join(mmxHome, 'config.json'),
    JSON.stringify({
      auth: {
        apiKey: 'sk-mmx-config',
      },
      region: 'global',
    }),
    'utf8',
  )

  expect(readMiniMaxCredential({ MMX_HOME: mmxHome })).toEqual({
    kind: 'api-key',
    credential: 'sk-mmx-config',
    source: '~/.mmx/config.json',
  })
})

test('reads ~/.mmx/credentials.json OAuth access-token fallback', () => {
  const mmxHome = makeMmxHome()
  writeFileSync(
    join(mmxHome, 'credentials.json'),
    JSON.stringify({
      tokens: {
        accessToken: 'oauth-access-token-123456',
      },
    }),
    'utf8',
  )

  expect(readMiniMaxCredential({ MMX_HOME: mmxHome })).toEqual({
    kind: 'oauth-access-token',
    credential: 'oauth-access-token-123456',
    source: '~/.mmx/credentials.json',
  })
})

test('readMiniMaxRuntimeToken accepts OAuth token fallback', () => {
  const mmxHome = makeMmxHome()
  writeFileSync(
    join(mmxHome, 'credentials.json'),
    JSON.stringify({
      tokens: {
        accessToken: 'oauth-access-token-abcdef',
      },
    }),
    'utf8',
  )

  expect(readMiniMaxRuntimeToken({ MMX_HOME: mmxHome })).toBe(
    'oauth-access-token-abcdef',
  )
})

test('resolveMiniMaxCredentialWithRefresh skips refresh for API key sources', async () => {
  const exec = mock(async () => ({
    stdout: '',
    stderr: '',
    code: 0,
  }))

  const credential = await resolveMiniMaxCredentialWithRefresh(
    { MINIMAX_API_KEY: 'sk-minimax-env' },
    {
      execFileNoThrow: exec as never,
      now: () => 1_000,
    },
  )

  expect(credential).toEqual({
    kind: 'api-key',
    credential: 'sk-minimax-env',
    source: 'MINIMAX_API_KEY',
  })
  expect(exec).not.toHaveBeenCalled()
})

test('resolveMiniMaxCredentialWithRefresh refreshes oauth credentials and rereads token', async () => {
  const mmxHome = makeMmxHome()
  writeFileSync(
    join(mmxHome, 'credentials.json'),
    JSON.stringify({
      tokens: {
        accessToken: 'oauth-access-token-before',
      },
    }),
    'utf8',
  )

  const exec = mock(async () => {
    writeFileSync(
      join(mmxHome, 'credentials.json'),
      JSON.stringify({
        tokens: {
          accessToken: 'oauth-access-token-after',
        },
      }),
      'utf8',
    )
    return {
      stdout: '',
      stderr: '',
      code: 0,
    }
  })

  const credential = await resolveMiniMaxCredentialWithRefresh(
    {
      MMX_HOME: mmxHome,
      MMX_BIN: process.execPath,
    },
    {
      execFileNoThrow: exec as never,
      now: () => 2_000,
    },
  )

  expect(exec).toHaveBeenCalledTimes(1)
  expect(credential).toEqual({
    kind: 'oauth-access-token',
    credential: 'oauth-access-token-after',
    source: '~/.mmx/credentials.json',
  })
})

test('resolveMiniMaxCredentialWithRefresh respects refresh cooldown', async () => {
  const mmxHome = makeMmxHome()
  writeFileSync(
    join(mmxHome, 'credentials.json'),
    JSON.stringify({
      tokens: {
        accessToken: 'oauth-access-token-stable',
      },
    }),
    'utf8',
  )

  const exec = mock(async () => ({
    stdout: '',
    stderr: '',
    code: 0,
  }))

  await resolveMiniMaxCredentialWithRefresh(
    {
      MMX_HOME: mmxHome,
      MMX_BIN: process.execPath,
    },
    {
      execFileNoThrow: exec as never,
      now: () => 10_000,
    },
  )
  await resolveMiniMaxCredentialWithRefresh(
    {
      MMX_HOME: mmxHome,
      MMX_BIN: process.execPath,
    },
    {
      execFileNoThrow: exec as never,
      now: () => 10_001,
    },
  )

  expect(exec).toHaveBeenCalledTimes(1)
})

test('resolveMiniMaxCredentialWithRefresh falls back to current oauth token when refresh fails', async () => {
  const mmxHome = makeMmxHome()
  writeFileSync(
    join(mmxHome, 'credentials.json'),
    JSON.stringify({
      tokens: {
        accessToken: 'oauth-access-token-before',
      },
    }),
    'utf8',
  )

  const exec = mock(async () => ({
    stdout: '',
    stderr: 'expired',
    code: 1,
    error: '1',
  }))

  const credential = await resolveMiniMaxCredentialWithRefresh(
    {
      MMX_HOME: mmxHome,
      MMX_BIN: process.execPath,
    },
    {
      execFileNoThrow: exec as never,
      now: () => 20_000,
    },
  )

  expect(credential).toEqual({
    kind: 'oauth-access-token',
    credential: 'oauth-access-token-before',
    source: '~/.mmx/credentials.json',
  })
})

test('buildMiniMaxProfileEnv accepts MMX_API_KEY env alias', () => {
  const env = buildMiniMaxProfileEnv({
    processEnv: {
      MMX_API_KEY: 'sk-mmx-env',
    } as NodeJS.ProcessEnv,
  })

  expect(env?.OPENAI_API_KEY).toBe('sk-mmx-env')
  expect(env?.MINIMAX_API_KEY).toBe('sk-mmx-env')
  expect(env?.MMX_API_KEY).toBe('sk-mmx-env')
})

test('buildMiniMaxProfileEnv reuses ~/.mmx/config.json API key fallback', () => {
  const mmxHome = makeMmxHome()
  mkdirSync(mmxHome, { recursive: true })
  writeFileSync(
    join(mmxHome, 'config.json'),
    JSON.stringify({ apiKey: 'sk-mmx-config' }),
    'utf8',
  )

  const env = buildMiniMaxProfileEnv({
    processEnv: {
      MMX_HOME: mmxHome,
    } as NodeJS.ProcessEnv,
  })

  expect(env?.OPENAI_API_KEY).toBe('sk-mmx-config')
  expect(env?.MINIMAX_API_KEY).toBe('sk-mmx-config')
})
