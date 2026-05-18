import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  TelegramAdapter,
  resolveTelegramAdapterLongPollSeconds,
} from './TelegramAdapter.js'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

function telegramResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  process.env = { ...originalEnv }
})

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env = { ...originalEnv }
  mock.restore()
})

describe('TelegramAdapter', () => {
  test('uses DuckHive Telegram token env fallback', () => {
    process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN = '123:duckhive-token'

    const adapter = new TelegramAdapter({ allowedChatId: 42 })

    expect(adapter.getChannelName()).toBe('telegram:123...')
  })

  test('reports DuckHive env names in setup errors', async () => {
    expect(() => new TelegramAdapter()).toThrow('DUCKHIVE_TELEGRAM_BOT_TOKEN')

    const adapter = new TelegramAdapter({ botToken: '123:test-token' })
    await expect(adapter.sendMessage('hello')).rejects.toThrow(
      'DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID',
    )
  })

  test('does not drop filtered or buffered updates before returning the next allowed message', async () => {
    const fetchMock = mock(async () =>
      telegramResponse({
        ok: true,
        result: [
          {
            update_id: 10,
            message: {
              message_id: 1,
              chat: { id: 99, type: 'private', username: 'blocked' },
              from: { id: 99, is_bot: false, first_name: 'Blocked' },
              text: 'ignore me',
              date: 1,
            },
          },
          {
            update_id: 11,
            message: {
              message_id: 2,
              chat: { id: 42, type: 'private', username: 'owner' },
              from: { id: 42, is_bot: false, first_name: 'Owner' },
              text: 'first allowed',
              date: 1,
            },
          },
          {
            update_id: 12,
            message: {
              message_id: 3,
              chat: { id: 42, type: 'private', username: 'owner' },
              from: { id: 42, is_bot: false, first_name: 'Owner' },
              text: 'second allowed',
              date: 1,
            },
          },
        ],
      }),
    ) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const adapter = new TelegramAdapter({
      botToken: '123:test-token',
      allowedChatId: 42,
      longPollTimeout: 1000,
    })

    const first = await adapter.receiveMessage()
    const second = await adapter.receiveMessage()

    expect(first?.content).toBe('first allowed')
    expect(second?.content).toBe('second allowed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('bounds getUpdates long-poll seconds below the adapter HTTP abort timeout', async () => {
    expect(resolveTelegramAdapterLongPollSeconds(30_000)).toBe(30)
    expect(resolveTelegramAdapterLongPollSeconds(55_000)).toBe(40)
    expect(resolveTelegramAdapterLongPollSeconds(0)).toBe(1)
  })

  test('sends bounded getUpdates timeout in the adapter request body', async () => {
    let requestBody: Record<string, unknown> | undefined
    const fetchMock = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      return telegramResponse({ ok: true, result: [] })
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const adapter = new TelegramAdapter({
      botToken: '123:test-token',
      allowedChatId: 42,
      longPollTimeout: 55_000,
    })

    await adapter.receiveMessage()

    expect(requestBody?.timeout).toBe(40)
  })

  test('filters inbound messages with comma-separated DuckHive allowlist env', async () => {
    process.env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID = '42, 77'
    globalThis.fetch = mock(async () =>
      telegramResponse({
        ok: true,
        result: [
          {
            update_id: 1,
            message: {
              message_id: 1,
              chat: { id: 13, type: 'private', username: 'blocked' },
              from: { id: 13, is_bot: false, first_name: 'Blocked' },
              text: 'blocked',
              date: 1,
            },
          },
          {
            update_id: 2,
            message: {
              message_id: 2,
              chat: { id: 77, type: 'private', username: 'owner' },
              from: { id: 77, is_bot: false, first_name: 'Owner' },
              text: 'allowed from env',
              date: 1,
            },
          },
        ],
      }),
    ) as unknown as typeof fetch

    const adapter = new TelegramAdapter({
      botToken: '123:test-token',
      longPollTimeout: 1000,
    })

    const message = await adapter.receiveMessage()

    expect(message?.content).toBe('allowed from env')
  })

  test('malformed DuckHive allowlist env fails closed instead of accepting every chat', async () => {
    process.env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID = 'not-a-chat-id'
    globalThis.fetch = mock(async () =>
      telegramResponse({
        ok: true,
        result: [
          {
            update_id: 1,
            message: {
              message_id: 1,
              chat: { id: 42, type: 'private', username: 'owner' },
              from: { id: 42, is_bot: false, first_name: 'Owner' },
              text: 'should be blocked',
              date: 1,
            },
          },
        ],
      }),
    ) as unknown as typeof fetch

    const adapter = new TelegramAdapter({
      botToken: '123:test-token',
      longPollTimeout: 1000,
    })

    await expect(adapter.sendMessage('hello')).rejects.toThrow(
      'DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID',
    )
    expect(await adapter.receiveMessage()).toBeNull()
  })

  test('uses DuckHive allowlist env as the outbound chat target', async () => {
    process.env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID = '42, 77'
    const fetchMock = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      expect(body.chat_id).toBe(42)
      expect(body.text).toBe('hello from env')
      return telegramResponse({ ok: true, result: { message_id: 1 } })
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const adapter = new TelegramAdapter({
      botToken: '123:test-token',
      longPollTimeout: 1000,
    })

    await adapter.sendMessage('hello from env')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('filters inbound messages with configured allowed chat id array', async () => {
    globalThis.fetch = mock(async () =>
      telegramResponse({
        ok: true,
        result: [
          {
            update_id: 1,
            message: {
              message_id: 1,
              chat: { id: 99, type: 'private', username: 'blocked' },
              from: { id: 99, is_bot: false, first_name: 'Blocked' },
              text: 'blocked',
              date: 1,
            },
          },
          {
            update_id: 2,
            message: {
              message_id: 2,
              chat: { id: 43, type: 'private', username: 'owner' },
              from: { id: 43, is_bot: false, first_name: 'Owner' },
              text: 'allowed from config',
              date: 1,
            },
          },
        ],
      }),
    ) as unknown as typeof fetch

    const adapter = new TelegramAdapter({
      botToken: '123:test-token',
      allowedChatIds: [42, '43'],
      longPollTimeout: 1000,
    })

    const message = await adapter.receiveMessage()

    expect(message?.content).toBe('allowed from config')
  })

  test('uses configured allowed chat id array as the outbound chat target', async () => {
    const fetchMock = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      expect(body.chat_id).toBe(42)
      expect(body.text).toBe('hello from config')
      return telegramResponse({ ok: true, result: { message_id: 1 } })
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const adapter = new TelegramAdapter({
      botToken: '123:test-token',
      allowedChatIds: [42, '43'],
      longPollTimeout: 1000,
    })

    await adapter.sendMessage('hello from config')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
