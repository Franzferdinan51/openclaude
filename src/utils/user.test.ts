import { afterEach, describe, expect, mock, test } from 'bun:test'
import * as actualAuth from './auth.js'
import * as actualConfig from './config.js'
import * as actualCwd from './cwd.js'
import * as actualEnv from './env.js'
import * as actualEnvUtils from './envUtils.js'
import * as actualExeca from 'execa'

const originalEnv = { ...process.env }

async function importFreshUserModule() {
  return import(`./user.ts?ts=${Date.now()}-${Math.random()}`)
}

function installCommonMocks(options?: {
  oauthEmail?: string
  gitEmail?: string
}) {
  mock.module('./auth.js', () => ({
    ...actualAuth,
    getOauthAccountInfo: () =>
      options?.oauthEmail
        ? {
            emailAddress: options.oauthEmail,
            organizationUuid: 'org-test',
            accountUuid: 'acct-test',
          }
        : undefined,
    getRateLimitTier: () => null,
    getSubscriptionType: () => null,
  }))

  mock.module('./config.js', () => ({
    ...actualConfig,
    getGlobalConfig: () => ({}),
    getOrCreateUserID: () => 'device-test',
  }))

  mock.module('./cwd.js', () => ({
    ...actualCwd,
    getCwd: () => 'C:\\repo',
  }))

  mock.module('./env.js', () => ({
    ...actualEnv,
    env: { platform: 'windows' },
    getHostPlatformForAnalytics: () => 'windows',
  }))

  mock.module('./envUtils.js', () => ({
    ...actualEnvUtils,
    isEnvTruthy: (value: string | undefined) =>
      !!value && value !== '0' && value.toLowerCase() !== 'false',
  }))

  mock.module('execa', () => ({
    ...actualExeca,
    execa: async () => ({
      exitCode: options?.gitEmail ? 0 : 1,
      stdout: options?.gitEmail ?? '',
    }),
  }))
}

afterEach(() => {
  mock.restore()
  mock.module('./auth.js', () => actualAuth)
  mock.module('./config.js', () => actualConfig)
  mock.module('./cwd.js', () => actualCwd)
  mock.module('./env.js', () => actualEnv)
  mock.module('./envUtils.js', () => actualEnvUtils)
  mock.module('execa', () => actualExeca)
  process.env = { ...originalEnv }
  delete (globalThis as Record<string, unknown>).MACRO
})

describe('user email fallbacks', () => {
  test('getCoreUserData does not synthesize Anthropic email from COO_CREATOR', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.COO_CREATOR = 'alice'
    ;(globalThis as Record<string, unknown>).MACRO = { VERSION: '0.0.0' }

    installCommonMocks()

    const { getCoreUserData } = await importFreshUserModule()
    const result = getCoreUserData()

    expect(result.email).toBeUndefined()
  })

  test('initUser falls back to git email when oauth email is missing', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.COO_CREATOR = 'alice'
    ;(globalThis as Record<string, unknown>).MACRO = { VERSION: '0.0.0' }

    installCommonMocks({ gitEmail: 'git@example.com' })

    const { initUser, getCoreUserData } = await importFreshUserModule()
    await initUser()

    const result = getCoreUserData()
    expect(result.email).toBe('git@example.com')
  })
})
