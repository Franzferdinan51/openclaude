import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

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
  test('extracts supported local deliverables from outbound text', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'duckhive-telegram-deliverables-'))
    try {
      const reportPath = join(tempDir, 'report.pdf')
      const imagePath = join(tempDir, 'chart.png')
      const ignoredPath = join(tempDir, 'scratch.bin')
      writeFileSync(reportPath, 'pdf')
      writeFileSync(imagePath, 'png')
      writeFileSync(ignoredPath, 'bin')

      const service = await importFreshService()
      const deliverables = service.extractTelegramDeliverablePaths(
        `Artifacts ready: "${reportPath}" and ${imagePath} plus ${ignoredPath}`,
      )

      expect(deliverables).toEqual([
        { path: reportPath, kind: 'document' },
        { path: imagePath, kind: 'photo' },
      ])
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('redacts Telegram chat and bot identifiers in debug logs', async () => {
    const debugLogs: string[] = []
    mock.module('../../utils/debug.js', () => ({
      logForDebugging: (message: string) => {
        debugLogs.push(message)
      },
    }))

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/getMe')) {
        return telegramResponse({
          ok: true,
          result: { id: 1, is_bot: true, username: 'private_duckhive_bot' },
        })
      }
      if (url.endsWith('/setMyCommands')) {
        return telegramResponse({ ok: true, result: true })
      }
      if (url.endsWith('/getUpdates')) {
        return telegramResponse({
          ok: true,
          result: [
            {
              update_id: 60,
              message: {
                from: { id: 424242, is_bot: false, first_name: 'Private' },
                chat: { id: 424242, type: 'private' },
                text: 'hello',
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
    await waitFor(() => debugLogs.some(log => log.includes('registered chat')))
    service.stopTelegramService()

    const combined = debugLogs.join('\n')
    expect(combined).toContain('bot username: @[redacted]')
    expect(combined).toContain('registered chat [redacted]')
    expect(combined).not.toContain('private_duckhive_bot')
    expect(combined).not.toContain('424242')
  })

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

  test('forwards Telegram photo captions with image placeholders', async () => {
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
        return telegramResponse({
          ok: true,
          result: [
            {
              update_id: 51,
              message: {
                from: { id: 42, is_bot: false, first_name: 'Owner' },
                chat: { id: 42, type: 'private' },
                caption: 'please inspect this',
                photo: [
                  { file_id: 'small', width: 160, height: 120, file_size: 1000 },
                  { file_id: 'large', width: 1024, height: 768, file_size: 12000 },
                ],
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
    await waitFor(() =>
      delivered.includes('please inspect this\n[telegram image: 1024x768, 12000 bytes]'),
    )
    service.stopTelegramService()
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

  test('ignores Telegram group commands addressed to another bot', async () => {
    const sentMessages: string[] = []
    const deliveredMessages: string[] = []
    let getUpdatesCalls = 0
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
        getUpdatesCalls += 1
        if (getUpdatesCalls > 1) {
          return telegramResponse({ ok: true, result: [] })
        }
        return telegramResponse({
          ok: true,
          result: [
            {
              update_id: 36,
              message: {
                from: { id: 42, is_bot: false, first_name: 'Owner' },
                chat: { id: 42, type: 'group' },
                text: '/runs@other_bot',
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
      if (text) deliveredMessages.push(text)
    })
    await service.startTelegramService()
    await waitFor(() => getUpdatesCalls > 1)
    service.stopTelegramService()

    expect(sentMessages).toEqual([])
    expect(deliveredMessages).toEqual([])
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

  test('uploads local deliverables mentioned in outbound Telegram messages', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'duckhive-telegram-send-'))
    try {
      const reportPath = join(tempDir, 'worker-report.pdf')
      const imagePath = join(tempDir, 'worker-chart.png')
      writeFileSync(reportPath, 'pdf')
      writeFileSync(imagePath, 'png')

      const uploadMethods: string[] = []
      let deliveredInitialChat = false
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
        if (url.endsWith('/sendPhoto')) {
          uploadMethods.push('sendPhoto')
          return telegramResponse({ ok: true, result: true })
        }
        if (url.endsWith('/sendDocument')) {
          uploadMethods.push('sendDocument')
          return telegramResponse({ ok: true, result: true })
        }
        if (url.endsWith('/getUpdates')) {
          if (deliveredInitialChat) {
            return telegramResponse({ ok: true, result: [] })
          }
          deliveredInitialChat = true
          return telegramResponse({
            ok: true,
            result: [
              {
                update_id: 80,
                message: {
                  from: { id: 42, is_bot: false, first_name: 'Owner' },
                  chat: { id: 42, type: 'private' },
                  text: 'register chat',
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
      await waitFor(() => deliveredInitialChat && service.getRegisteredChatId() === 42)

      const sent = await service.sendTelegramMessage(
        `Deliverables ready: ${reportPath}\n${imagePath}`,
      )
      service.stopTelegramService()

      expect(sent).toBe(true)
      expect(uploadMethods).toEqual(['sendDocument', 'sendPhoto'])
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('uploads run artifacts after Telegram /run detail responses', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'duckhive-telegram-run-artifacts-'))
    try {
      const reportPath = join(tempDir, 'run-report.pdf')
      writeFileSync(reportPath, 'pdf')

      const sentMessages: string[] = []
      const uploadMethods: string[] = []
      const { resetAgentRunStoreForTesting } = await import(
        '../../agent-runs/AgentRunStore.js'
      )
      const store = resetAgentRunStoreForTesting({ persist: false })
      store.createRun({
        id: 'run-artifact',
        title: 'Artifact run',
        status: 'completed',
        artifacts: [{ kind: 'file', path: reportPath, label: 'report.pdf' }],
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
        if (url.endsWith('/sendDocument')) {
          uploadMethods.push('sendDocument')
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
                update_id: 81,
                message: {
                  from: { id: 42, is_bot: false, first_name: 'Owner' },
                  chat: { id: 42, type: 'private' },
                  text: '/run run-artifact',
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
      await waitFor(() => uploadMethods.includes('sendDocument'))
      service.stopTelegramService()

      expect(sentMessages.join('\n')).toContain('Artifacts: report.pdf')
      expect(uploadMethods).toEqual(['sendDocument'])
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
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
