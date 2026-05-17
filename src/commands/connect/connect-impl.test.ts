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
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID
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
    expect(result.value).toContain('Source:   storage')
  })

  test('shows connected status from environment when secure storage is empty', async () => {
    process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWX'
    process.env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID = '424242'

    const { call } = await importFreshConnectModule()
    const result = await call('status', {} as never)

    expect(result.value).toContain('Connected')
    expect(result.value).toContain('12345678...')
    expect(result.value).toContain('Chat:     424242')
    expect(result.value).toContain('Source:   environment')
  })

  test('does not inherit a stored chat id when the active env token is different', async () => {
    storageState = {
      pluginSecrets: {
        telegram: {
          botToken: '999999999:ZZZZZZZZZZZZZZZZZZZZZZZZ',
          chatId: 'old-chat',
        },
      },
    }
    process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWX'

    const { call } = await importFreshConnectModule()
    const result = await call('status', {} as never)

    expect(result.value).toContain('Connected')
    expect(result.value).toContain('Source:   environment')
    expect(result.value).not.toContain('Chat:     old-chat')
  })

  test('does not inherit stored connectedAt metadata when the active env token is different', async () => {
    storageState = {
      pluginSecrets: {
        telegram: {
          botToken: '999999999:ZZZZZZZZZZZZZZZZZZZZZZZZ',
          connectedAt: '1700000000000',
        },
      },
    }
    process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWX'

    const { call } = await importFreshConnectModule()
    const result = await call('status', {} as never)

    expect(result.value).toContain('Connected')
    expect(result.value).toContain('Source:   environment')
    expect(result.value).not.toContain('Since:')
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
    expect(result.value).toContain('/connect status')
    expect(result.value).toContain('/connect disconnect')
    expect(result.value).not.toContain('/connect --status')
    expect(storageState.pluginSecrets?.telegram?.botToken).toBe(token)
    expect(process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN).toBe(token)
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  test('disconnect clears secure storage, clears runtime env, and stops the Telegram service', async () => {
    process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWX'
    process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWX'
    storageState = {
      pluginSecrets: {
        telegram: {
          botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
        },
      },
    }

    const { call } = await importFreshConnectModule()
    const result = await call('disconnect', {} as never)

    expect(result.value).toContain('Telegram disconnected')
    expect(storageState.pluginSecrets?.telegram).toBeUndefined()
    expect(process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN).toBeUndefined()
    expect(process.env.TELEGRAM_BOT_TOKEN).toBeUndefined()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(stopTelegramService).toHaveBeenCalledTimes(1)
  })
})
