import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { TelegramAdapter } from './TelegramAdapter.js'

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

    expect(adapter.getChannelName()).toBe('telegram:123…')
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
})
