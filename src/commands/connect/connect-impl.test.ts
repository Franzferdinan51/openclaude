import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

type SecureStorageData = {
  pluginSecrets?: Record<string, Record<string, string>>
}

let storageState: SecureStorageData
let updateSpy: ReturnType<typeof mock>
let startTelegramService: ReturnType<typeof mock>
let stopTelegramService: ReturnType<typeof mock>

async function importFreshConnectModule() {
  return await import(
    `./connect-impl.ts?connect-test=${Date.now()}-${Math.random()}`
  )
}

describe('/connect command', () => {
  beforeEach(() => {
    storageState = {}
    updateSpy = mock((data: SecureStorageData) => {
      storageState = data
    })
    startTelegramService = mock(async () => {})
    stopTelegramService = mock(async () => {})

    mock.module('../../utils/secureStorage/index.js', () => ({
      getSecureStorage: () => ({
        read: () => storageState,
        readAsync: async () => storageState,
        update: updateSpy,
        delete: () => true,
      }),
    }))

    mock.module('../../services/telegram/index.js', () => ({
      startTelegramService,
      stopTelegramService,
    }))
  })

  afterEach(() => {
    mock.restore()
    delete process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN
  })

  test('shows setup instructions when called without arguments', async () => {
    const { call } = await importFreshConnectModule()
    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('Connect Telegram to DuckHive')
    expect(result.value).toContain('/connect <your-bot-token>')
  })

  test('shows status from secure storage', async () => {
    storageState = {
      pluginSecrets: {
        telegram: {
          botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
          connectedAt: '1700000000000',
        },
      },
    }

    const { call } = await importFreshConnectModule()
    const result = await call('status', {} as never)

    expect(result.value).toContain('Telegram Connection Status')
    expect(result.value).toContain('Connected')
    expect(result.value).toContain('12345678...')
  })

  test('rejects invalid Telegram bot token format', async () => {
    const { call } = await importFreshConnectModule()
    const result = await call('not-a-real-token', {} as never)

    expect(result.value).toContain('Invalid bot token format')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  test('stores a valid token and updates runtime env', async () => {
    const token = '123456789:ABCDEFGHIJKLMNOPQRSTUVWX'
    const { call } = await importFreshConnectModule()
    const result = await call(token, {} as never)

    expect(result.value).toContain('Telegram connected successfully!')
    expect(storageState.pluginSecrets?.telegram?.botToken).toBe(token)
    expect(process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN).toBe(token)
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })
})
