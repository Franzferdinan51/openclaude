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

  test('bounds getUpdates long-poll seconds below the HTTP abort timeout', async () => {
    const service = await importFreshService()

    expect(service.resolveTelegramLongPollTimeoutSeconds(30)).toBe(30)
    expect(service.resolveTelegramLongPollTimeoutSeconds(999)).toBe(40)
    expect(service.resolveTelegramLongPollTimeoutSeconds(0)).toBe(1)
  })

  test('sends bounded getUpdates timeout in the polling request body', async () => {
    let getUpdatesBody: { timeout?: unknown } | undefined
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
      if (url.endsWith('/getUpdates')) {
        getUpdatesBody = JSON.parse(String(init?.body ?? '{}')) as {
          timeout?: unknown
        }
        return telegramResponse({ ok: true, result: [] })
      }
      return telegramResponse({ ok: true, result: true })
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const service = await importFreshService()
    await service.startTelegramService()
    await waitFor(() => getUpdatesBody !== undefined)
    service.stopTelegramService()

    expect(getUpdatesBody?.timeout).toBe(30)
  })

  test('starts from TELEGRAM_BOT_TOKEN fallback when DuckHive token env is absent', async () => {
    delete process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN
    process.env.TELEGRAM_BOT_TOKEN = '123:legacy-token'

    let getMeCalls = 0
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/bot123:legacy-token/getMe')) {
        getMeCalls += 1
        return telegramResponse({
          ok: true,
          result: { id: 1, is_bot: true, username: 'duckhive_test_bot' },
        })
      }
      if (url.includes('/bot123:legacy-token/setMyCommands')) {
        return telegramResponse({ ok: true, result: true })
      }
      if (url.includes('/bot123:legacy-token/getUpdates')) {
        return telegramResponse({ ok: true, result: [] })
      }
      return telegramResponse({ ok: true, result: true })
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const service = await importFreshService()
    await service.startTelegramService()
    await waitFor(() => getMeCalls > 0)
    service.stopTelegramService()

    expect(getMeCalls).toBeGreaterThanOrEqual(1)
  })

  test('retries Telegram 421 misdirected request responses once during startup', async () => {
    let getMeCalls = 0
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/getMe')) {
        getMeCalls += 1
        if (getMeCalls === 1) {
          return new Response('Misdirected Request', {
            status: 421,
            statusText: 'Misdirected Request',
          })
        }
        return telegramResponse({
          ok: true,
          result: { id: 1, is_bot: true, username: 'duckhive_test_bot' },
        })
      }
      if (url.endsWith('/setMyCommands')) {
        return telegramResponse({ ok: true, result: true })
      }
      if (url.endsWith('/getUpdates')) {
        return telegramResponse({ ok: true, result: [] })
      }
      return telegramResponse({ ok: true, result: true })
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    const service = await importFreshService()
    await service.startTelegramService()
    await waitFor(() => getMeCalls >= 2)
    service.stopTelegramService()

    expect(getMeCalls).toBe(2)
  })

  test('uses ASCII-safe built-in command responses', async () => {
    const sentMessages: string[] = []
    const commands = ['/start', '/help', '/status']
    let updateId = 200
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
                  update_id: updateId++,
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
    await waitFor(() => sentMessages.some(text => text.includes('*DuckHive Status*')))
    service.stopTelegramService()

    const allText = sentMessages.join('\n')
    expect(allText).toContain('[ok] *DuckHive connected!*')
    expect(allText).toContain('- /start - Register with DuckHive')
    expect(allText).toContain('Session: [connected]')
    expect(allText).not.toContain('✅')
    expect(allText).not.toContain('🟢')
    expect(allText).not.toContain('🔴')
    expect(allText).not.toContain('•')
    expect(allText).not.toContain('·')
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

    const allText = sentMessages.join('\n')
    expect(allText).toContain('Telegram visible run')
    expect(allText).toContain('- run-telegram [running] Telegram visible run - coder')
    expect(allText).not.toContain('•')
    expect(allText).not.toContain('·')
  })

  test('accepts Telegram group command suffixes like /runs@botname', async () => {
    const sentMessages: string[] = []
    const { resetAgentRunStoreForTesting } = await import(
      '../../agent-runs/AgentRunStore.js'
    )
    const store = resetAgentRunStoreForTesting({ persist: false })
    store.createRun({
      id: 'run-group-command',
      title: 'Group command visible run',
      status: 'running',
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
              update_id: 35,
              message: {
                from: { id: 42, is_bot: false, first_name: 'Owner' },
                chat: { id: 42, type: 'group' },
                text: '/runs@duckhive_test_bot',
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
    await waitFor(() => sentMessages.some(text => text.includes('run-group-command')))
    service.stopTelegramService()

    expect(sentMessages.join('\n')).toContain('Group command visible run')
    expect(sentMessages.join('\n')).not.toContain('Unknown command')
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

  test('shows run detail and tails run events over Telegram', async () => {
    const sentMessages: string[] = []
    const { resetAgentRunStoreForTesting } = await import(
      '../../agent-runs/AgentRunStore.js'
    )
    const store = resetAgentRunStoreForTesting({ persist: false })
    store.createRun({
      id: 'run-detail',
      title: 'Detailed Telegram run',
      status: 'running',
      selectedAgent: 'reviewer',
      runtimeHarness: 'duckhive-built-in',
    })
    store.emitEvent('message_delta', {
      runId: 'run-detail',
      role: 'assistant',
      delta: 'hello',
    })

    const commands = ['/run run-detail', '/tail run-detail']
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
                  update_id: 60 + commands.length,
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
    await waitFor(() => sentMessages.some(text => text.includes('message_delta')))
    service.stopTelegramService()

    const allText = sentMessages.join('\n')
    expect(allText).toContain('Detailed Telegram run')
    expect(allText).toContain('Agent: reviewer')
    expect(allText).toContain('- message_delta at')
    expect(allText).not.toContain('•')
  })

  test('approves a specific pending run approval over Telegram', async () => {
    const sentMessages: string[] = []
    const { resetAgentRunStoreForTesting } = await import(
      '../../agent-runs/AgentRunStore.js'
    )
    const store = resetAgentRunStoreForTesting({ persist: false })
    store.createRun({
      id: 'run-approval',
      title: 'Approval run',
      status: 'paused',
      permissionState: {
        pendingApprovalIds: ['approval-a', 'approval-b'],
      },
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
              update_id: 70,
              message: {
                from: { id: 42, is_bot: false, first_name: 'Owner' },
                chat: { id: 42, type: 'private' },
                text: '/approve run-approval approval-a',
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
    await waitFor(() => store.getRun('run-approval')?.status === 'running')
    service.stopTelegramService()

    expect(store.getRun('run-approval')?.permissionState).toEqual({
      pendingApprovalIds: ['approval-b'],
      lastDecision: 'allow',
    })
    expect(sentMessages.join('\n')).toContain(
      'Run run-approval approval acknowledged (approval-a).',
    )
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
