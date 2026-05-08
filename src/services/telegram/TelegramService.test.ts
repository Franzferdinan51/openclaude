import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

function telegramResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function importFreshService() {
  return import(`./TelegramService.ts?ts=${Date.now()}-${Math.random()}`)
}

beforeEach(() => {
  process.env = { ...originalEnv }
  process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN = '123:test-token'
  mock.module('../../utils/secureStorage/index.js', () => ({
    getSecureStorage: () => ({
      read: () => ({}),
      update: () => undefined,
    }),
  }))
})

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env = { ...originalEnv }
  mock.restore()
})

describe('TelegramService polling', () => {
  test('keeps polling after an empty getUpdates batch', async () => {
    let getUpdatesCalls = 0
    const delivered: string[] = []
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/getMe')) {
        return telegramResponse({
          ok: true,
          result: { id: 1, is_bot: true, username: 'duckhive_test_bot' },
        })
      }
      if (url.endsWith('/setMyCommands')) {
        return telegramResponse({ ok: true, result: true })
      }
      if (url.endsWith('/getUpdates')) {
        getUpdatesCalls += 1
        if (getUpdatesCalls === 1) {
          return telegramResponse({ ok: true, result: [] })
        }
        return telegramResponse({
          ok: true,
          result: [
            {
              update_id: 21,
              message: {
                from: { id: 42, is_bot: false, first_name: 'Owner' },
                chat: { id: 42, type: 'private' },
                text: 'pipeline still alive',
                date: 1,
              },
            },
          ],
        })
      }
      return telegramResponse({ ok: true, result: true })
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const service = await importFreshService()
    service.onTelegramMessage((_chatId, text) => {
      if (text) delivered.push(text)
    })

    await service.startTelegramService()
    await waitFor(() => delivered.includes('pipeline still alive'))
    service.stopTelegramService()

    expect(getUpdatesCalls).toBeGreaterThanOrEqual(2)
  })
})

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for condition')
}
