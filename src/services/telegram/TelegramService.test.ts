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
  test('restores the Telegram bot token from secure storage on fresh startup', async () => {
    delete process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN

    mock.module('../../utils/secureStorage/index.js', () => ({
      getSecureStorage: () => ({
        read: () => ({
          pluginSecrets: {
            telegram: {
              botToken: '123:stored-token',
              chatId: '42',
            },
          },
        }),
        update: () => undefined,
      }),
    }))

    let getMeCalls = 0
    const delivered: string[] = []
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/bot123:stored-token/getMe')) {
        getMeCalls += 1
        return telegramResponse({
          ok: true,
          result: { id: 1, is_bot: true, username: 'duckhive_test_bot' },
        })
      }
      if (url.includes('/bot123:stored-token/setMyCommands')) {
        return telegramResponse({ ok: true, result: true })
      }
      if (url.includes('/bot123:stored-token/getUpdates')) {
        return telegramResponse({
          ok: true,
          result: [
            {
              update_id: 50,
              message: {
                from: { id: 42, is_bot: false, first_name: 'Owner' },
                chat: { id: 42, type: 'private' },
                text: 'storage restored',
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
    await waitFor(() => delivered.includes('storage restored'))
    service.stopTelegramService()

    expect(getMeCalls).toBeGreaterThanOrEqual(1)
  })

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

  test('responds to /runs with AgentRun control-plane state', async () => {
    const sentMessages: string[] = []
    const { resetAgentRunStoreForTesting } = await import(
      '../../agent-runs/AgentRunStore.js'
    )
    const store = resetAgentRunStoreForTesting({ persist: false })
    store.createRun({
      id: 'run-telegram',
      title: 'Telegram visible run',
      status: 'running',
      selectedAgent: 'coder',
      channelSource: { type: 'telegram', id: '42' },
    })

    let deliveredCommand = false
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
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
      if (url.endsWith('/sendMessage')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { text?: string }
        sentMessages.push(body.text ?? '')
        return telegramResponse({ ok: true, result: true })
      }
      if (url.endsWith('/getUpdates')) {
        if (deliveredCommand) {
          return telegramResponse({ ok: true, result: [] })
        }
        deliveredCommand = true
        return telegramResponse({
          ok: true,
          result: [
            {
              update_id: 30,
              message: {
                from: { id: 42, is_bot: false, first_name: 'Owner' },
                chat: { id: 42, type: 'private' },
                text: '/runs',
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
    await service.startTelegramService()
    await waitFor(() => sentMessages.some(text => text.includes('run-telegram')))
    service.stopTelegramService()

    expect(sentMessages.join('\n')).toContain('Telegram visible run')
  })

  test('allows Telegram commands to pause, resume, and stop runs', async () => {
    const sentMessages: string[] = []
    const { resetAgentRunStoreForTesting } = await import(
      '../../agent-runs/AgentRunStore.js'
    )
    const store = resetAgentRunStoreForTesting({ persist: false })
    store.createRun({
      id: 'run-control',
      title: 'Controllable run',
      status: 'running',
    })

    const commands = ['/pause run-control', '/resume run-control', '/stop run-control']
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
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
      if (url.endsWith('/sendMessage')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { text?: string }
        sentMessages.push(body.text ?? '')
        return telegramResponse({ ok: true, result: true })
      }
      if (url.endsWith('/getUpdates')) {
        const text = commands.shift()
        return telegramResponse({
          ok: true,
          result: text
            ? [
                {
                  update_id: 40 + commands.length,
                  message: {
                    from: { id: 42, is_bot: false, first_name: 'Owner' },
                    chat: { id: 42, type: 'private' },
                    text,
                    date: 1,
                  },
                },
              ]
            : [],
        })
      }
      return telegramResponse({ ok: true, result: true })
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const service = await importFreshService()
    await service.startTelegramService()
    await waitFor(() => store.getRun('run-control')?.status === 'cancelled')
    service.stopTelegramService()

    expect(sentMessages.join('\n')).toContain('paused')
    expect(sentMessages.join('\n')).toContain('resumed')
    expect(sentMessages.join('\n')).toContain('cancelled')
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
