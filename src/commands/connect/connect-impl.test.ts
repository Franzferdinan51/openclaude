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
    expect(result.value).toContain('DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID')
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

  test('points webhook and email connector setup to /channel instead of token validation', async () => {
    const { call } = await importFreshConnectModule()

    const webhook = await call('webhook', {} as never)
    const email = await call('email', {} as never)

    expect(webhook.value).toContain('/channel connect webhook')
    expect(webhook.value).not.toContain('Invalid bot token format')
    expect(email.value).toContain('/channel connect email')
    expect(email.value).not.toContain('Invalid bot token format')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  test('explains that console is already built in', async () => {
    const { call } = await importFreshConnectModule()
    const result = await call('console', {} as never)

    expect(result.value).toContain('console channel is built into the local REPL')
    expect(result.value).toContain('/channel status console')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  test('rejects trailing arguments for status and disconnect', async () => {
    const { call } = await importFreshConnectModule()

    const status = await call('status telegram', {} as never)
    const disconnect = await call('disconnect telegram', {} as never)

    expect(status.value).toContain('Usage: /connect status')
    expect(status.value).toContain('/channel status')
    expect(disconnect.value).toContain('Usage: /connect disconnect')
    expect(disconnect.value).toContain('/channel disconnect <webhook|email>')
    expect(stopTelegramService).not.toHaveBeenCalled()
  })

  test('stores a valid token and updates runtime env', async () => {
    const token = '123456789:ABCDEFGHIJKLMNOPQRSTUVWX'
    const { call } = await importFreshConnectModule()
    const result = await call(token, {} as never)

    expect(result.value).toContain('Telegram connected successfully!')
    expect(result.value).toContain('/connect status')
    expect(result.value).toContain('/connect disconnect')
    expect(result.value).toContain('DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID=<chat-id>')
    expect(result.value).not.toContain('/connect --status')
    expect(storageState.pluginSecrets?.telegram?.botToken).toBe(token)
    expect(process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN).toBe(token)
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  test('renders Telegram setup, status, errors, and success as ASCII-safe terminal text', async () => {
    const token = '123456789:ABCDEFGHIJKLMNOPQRSTUVWX'
    const { call } = await importFreshConnectModule()

    const outputs = [
      await call('', {} as never),
      await call('status', {} as never),
      await call('not-a-real-token', {} as never),
      await call(token, {} as never),
    ]
      .map(result => result.value)
      .join('\n')

    expect(/[^\x00-\x7F]/.test(outputs)).toBe(false)
    expect(outputs).toContain('Telegram Connection Status')
    expect(outputs).toContain('Telegram connected successfully!')
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
