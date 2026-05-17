import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { call, setChannelTestDeps } from './channel-impl.js'

let connectCall: ReturnType<typeof mock>
let sendTelegramMessage: ReturnType<typeof mock>
let sendWebhookMessage: ReturnType<typeof mock>
let sendEmailMessage: ReturnType<typeof mock>
let sendConsoleMessage: ReturnType<typeof mock>
let startTelegramService: ReturnType<typeof mock>
let connectWebhookRuntime: ReturnType<typeof mock>
let disconnectWebhookRuntime: ReturnType<typeof mock>
let isWebhookRuntimeConnected: ReturnType<typeof mock>
let connectEmailRuntime: ReturnType<typeof mock>
let disconnectEmailRuntime: ReturnType<typeof mock>
let isEmailRuntimeConnected: ReturnType<typeof mock>
const envBaseline = { ...process.env }

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

describe('/channel command', () => {
  beforeEach(() => {
    connectCall = mock(async (args: string) => ({
      type: 'text' as const,
      value: `connect:${args}`,
    }))
    sendTelegramMessage = mock(async (_message: string) => true)
    sendWebhookMessage = mock(async () => {})
    sendEmailMessage = mock(async () => {})
    sendConsoleMessage = mock(async () => {})
    startTelegramService = mock(async () => {})
    connectWebhookRuntime = mock(async () => {})
    disconnectWebhookRuntime = mock(async () => true)
    isWebhookRuntimeConnected = mock(() => false)
    connectEmailRuntime = mock(async () => {})
    disconnectEmailRuntime = mock(async () => true)
    isEmailRuntimeConnected = mock(() => false)

    setChannelTestDeps({
      connectCall,
      sendTelegramMessage,
      sendWebhookMessage,
      sendEmailMessage,
      sendConsoleMessage,
      connectWebhookRuntime,
      disconnectWebhookRuntime,
      isWebhookRuntimeConnected,
      connectEmailRuntime,
      disconnectEmailRuntime,
      isEmailRuntimeConnected,
      startTelegramService,
      getSecureStorage: () => ({
        read: () => ({
          pluginSecrets: {
            telegram: {
              botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
              chatId: '42',
            },
          },
        }),
      }),
      env: {
        ...envBaseline,
        EMAIL_IMAP_HOST: 'imap.example.com',
        EMAIL_IMAP_USER: 'duck@example.com',
        EMAIL_SMTP_HOST: 'smtp.example.com',
        EMAIL_TO: 'duck@example.com',
        WEBHOOK_PORT: '3848',
        WEBHOOK_OUTBOUND_URL: 'https://example.com/webhook',
      },
    })
  })

  afterEach(() => {
    setChannelTestDeps(null)
  })

  test('shows channel help when called without arguments', async () => {
    const result = expectTextResult(await call('', {} as never))

    expect(result.value).toContain('Channel Adapters')
    expect(result.value).toContain('telegram - configured')
    expect(result.value).toContain('chat:  42')
    expect(result.value).toContain('webhook - config present')
    expect(result.value).toContain('inbound: ready | outbound: ready')
    expect(result.value).toContain('runtime: not connected')
    expect(result.value).toContain('email - config present')
    expect(result.value).toContain('inbound: ready | outbound: ready')
    expect(result.value).toContain('runtime: not connected')
    expect(result.value).toContain('console - built in')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('delegates telegram status to /connect and rewrites the heading', async () => {
    connectCall.mockImplementationOnce(async () => ({
      type: 'text' as const,
      value: 'Telegram Connection Status\nStatus: Connected',
    }))

    const result = expectTextResult(await call('status telegram', {} as never))

    expect(connectCall).toHaveBeenCalledWith('status', expect.anything())
    expect(result.value).toContain('Channel Adapter Status')
    expect(result.value).toContain('Status: Connected')
  })

  test('status rejects trailing positional arguments instead of silently ignoring them', async () => {
    const result = expectTextResult(await call('status telegram extra', {} as never))

    expect(result.value).toContain('Usage: /channel status [channel-type]')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('does not show a stored Telegram chat id when the active env token is different', async () => {
    setChannelTestDeps({
      connectCall,
      sendTelegramMessage,
      sendWebhookMessage,
      sendEmailMessage,
      sendConsoleMessage,
      startTelegramService,
      getSecureStorage: () => ({
        read: () => ({
          pluginSecrets: {
            telegram: {
              botToken: '999999999:ZZZZZZZZZZZZZZZZZZZZZZZZ',
              chatId: 'old-chat',
            },
          },
        }),
      }),
      env: {
        ...envBaseline,
        DUCKHIVE_TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
        EMAIL_IMAP_HOST: 'imap.example.com',
        EMAIL_IMAP_USER: 'duck@example.com',
        EMAIL_SMTP_HOST: 'smtp.example.com',
        EMAIL_TO: 'duck@example.com',
        WEBHOOK_PORT: '3848',
        WEBHOOK_OUTBOUND_URL: 'https://example.com/webhook',
      },
    })

    const result = expectTextResult(await call('status', {} as never))

    expect(result.value).toContain('telegram - configured')
    expect(result.value).toContain('chat:  not registered yet')
    expect(result.value).not.toContain('chat:  old-chat')
  })

  test('shows the aggregate adapter snapshot when status is called without a channel type', async () => {
    const result = expectTextResult(await call('status', {} as never))

    expect(result.value).toContain('Channel Adapters')
    expect(result.value).toContain('telegram - configured')
    expect(result.value).toContain('webhook - config present')
    expect(result.value).toContain('email - config present')
    expect(result.value).toContain('console - built in')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('shows webhook adapter status from the shared snapshot surface', async () => {
    const result = expectTextResult(await call('status webhook', {} as never))

    expect(result.value).toContain('Channel Adapter Status')
    expect(result.value).toContain('Webhook')
    expect(result.value).toContain('webhook - config present')
    expect(result.value).toContain('inbound: ready | outbound: ready')
    expect(result.value).toContain('runtime: not connected')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('shows email adapter status from the shared snapshot surface', async () => {
    const result = expectTextResult(await call('status email', {} as never))

    expect(result.value).toContain('Channel Adapter Status')
    expect(result.value).toContain('Email')
    expect(result.value).toContain('email - config present')
    expect(result.value).toContain('inbound: ready | outbound: ready')
    expect(result.value).toContain('runtime: not connected')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('shows console adapter status from the shared snapshot surface', async () => {
    const result = expectTextResult(await call('status console', {} as never))

    expect(result.value).toContain('Channel Adapter Status')
    expect(result.value).toContain('Console')
    expect(result.value).toContain('console - built in')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('shows live webhook runtime state in status output', async () => {
    isWebhookRuntimeConnected.mockReturnValue(true)

    const result = expectTextResult(await call('status webhook', {} as never))

    expect(result.value).toContain('runtime: connected')
  })

  test('shows live email runtime state in status output', async () => {
    isEmailRuntimeConnected.mockReturnValue(true)

    const result = expectTextResult(await call('status email', {} as never))

    expect(result.value).toContain('runtime: connected')
  })

  test('delegates telegram connect to /connect with the provided token', async () => {
    const result = expectTextResult(
      await call('connect telegram 123456789:ABCDEFGHIJKLMNOPQRSTUVWX', {} as never),
    )

    expect(connectCall).toHaveBeenCalledWith(
      '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
      expect.anything(),
    )
    expect(result.value).toBe('connect:123456789:ABCDEFGHIJKLMNOPQRSTUVWX')
  })

  test('delegates documented --token syntax without forwarding the flag', async () => {
    const result = expectTextResult(
      await call('connect telegram --token 123456789:ABCDEFGHIJKLMNOPQRSTUVWX', {} as never),
    )

    expect(connectCall).toHaveBeenCalledWith(
      '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
      expect.anything(),
    )
    expect(result.value).toBe('connect:123456789:ABCDEFGHIJKLMNOPQRSTUVWX')
  })

  test('delegates documented --token=value syntax without forwarding the flag', async () => {
    const result = expectTextResult(
      await call('connect telegram --token=123456789:ABCDEFGHIJKLMNOPQRSTUVWX', {} as never),
    )

    expect(connectCall).toHaveBeenCalledWith(
      '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
      expect.anything(),
    )
    expect(result.value).toBe('connect:123456789:ABCDEFGHIJKLMNOPQRSTUVWX')
  })

  test('connect without a token returns channel-specific usage instead of delegating to /connect', async () => {
    const result = expectTextResult(await call('connect telegram', {} as never))

    expect(result.value).toBe('Usage: /channel connect telegram --token <TOKEN>')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('connect with a bare --token flag returns usage instead of treating the flag as the token', async () => {
    const result = expectTextResult(await call('connect telegram --token', {} as never))

    expect(result.value).toBe('Usage: /channel connect telegram --token <TOKEN>')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('connects the webhook adapter runtime through the channel surface', async () => {
    const result = expectTextResult(await call('connect webhook', {} as never))

    expect(connectWebhookRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        WEBHOOK_PORT: '3848',
        WEBHOOK_OUTBOUND_URL: 'https://example.com/webhook',
      }),
    )
    expect(result.value).toBe('Webhook adapter connected.')
  })

  test('connects the email adapter runtime through the channel surface', async () => {
    const result = expectTextResult(await call('connect email', {} as never))

    expect(connectEmailRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        EMAIL_IMAP_HOST: 'imap.example.com',
        EMAIL_IMAP_USER: 'duck@example.com',
      }),
    )
    expect(result.value).toBe('Email adapter connected.')
  })

  test('connect rejects extra arguments after --token instead of silently ignoring them', async () => {
    const result = expectTextResult(
      await call(
        'connect telegram --token 123456789:ABCDEFGHIJKLMNOPQRSTUVWX extra',
        {} as never,
      ),
    )

    expect(result.value).toBe('Usage: /channel connect telegram --token <TOKEN>')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('connect rejects extra arguments after --token=value instead of silently ignoring them', async () => {
    const result = expectTextResult(
      await call(
        'connect telegram --token=123456789:ABCDEFGHIJKLMNOPQRSTUVWX extra',
        {} as never,
      ),
    )

    expect(result.value).toBe('Usage: /channel connect telegram --token <TOKEN>')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('connect without a channel type returns the exact supported usage', async () => {
    const result = expectTextResult(await call('connect', {} as never))

    expect(result.value).toContain('Usage: /channel connect <channel-type> [options]')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('delegates telegram disconnect to /connect', async () => {
    const result = expectTextResult(await call('disconnect telegram', {} as never))

    expect(connectCall).toHaveBeenCalledWith('disconnect', expect.anything())
    expect(result.value).toBe('connect:disconnect')
  })

  test('disconnect without a channel type returns channel-specific usage instead of disconnecting Telegram implicitly', async () => {
    const result = expectTextResult(await call('disconnect', {} as never))

    expect(result.value).toContain('Usage: /channel disconnect <channel-type>')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('disconnects the webhook adapter runtime through the channel surface', async () => {
    const result = expectTextResult(await call('disconnect webhook', {} as never))

    expect(disconnectWebhookRuntime).toHaveBeenCalledTimes(1)
    expect(result.value).toBe('Webhook adapter disconnected.')
  })

  test('disconnects the email adapter runtime through the channel surface', async () => {
    const result = expectTextResult(await call('disconnect email', {} as never))

    expect(disconnectEmailRuntime).toHaveBeenCalledTimes(1)
    expect(result.value).toBe('Email adapter disconnected.')
  })

  test('disconnect rejects trailing positional arguments instead of silently ignoring them', async () => {
    const result = expectTextResult(await call('disconnect telegram extra', {} as never))

    expect(result.value).toBe('Usage: /channel disconnect telegram')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('rejects unsupported channel types', async () => {
    const result = expectTextResult(await call('connect slack token', {} as never))

    expect(result.value).toContain('Usage: /channel connect <channel-type> [options]')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('rejects unknown status channel types with the expanded adapter list', async () => {
    const result = expectTextResult(await call('status slack', {} as never))

    expect(result.value).toContain('Available: telegram, webhook, email, console')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('sends a Telegram message through the Telegram service', async () => {
    const result = expectTextResult(
      await call('send telegram Hello from DuckHive', {} as never),
    )

    expect(startTelegramService).toHaveBeenCalledTimes(1)
    expect(sendTelegramMessage).toHaveBeenCalledWith('Hello from DuckHive')
    expect(result.value).toBe('Telegram message sent.')
  })

  test('strips quotes when sending a Telegram message with the documented syntax', async () => {
    const result = expectTextResult(
      await call('send telegram "Hello from DuckHive"', {} as never),
    )

    expect(sendTelegramMessage).toHaveBeenCalledWith('Hello from DuckHive')
    expect(result.value).toBe('Telegram message sent.')
  })

  test('sends a webhook message through the Webhook adapter path', async () => {
    const result = expectTextResult(
      await call('send webhook Hello from DuckHive', {} as never),
    )

    expect(sendWebhookMessage).toHaveBeenCalledWith(
      'Hello from DuckHive',
      expect.objectContaining({
        WEBHOOK_OUTBOUND_URL: 'https://example.com/webhook',
      }),
    )
    expect(startTelegramService).not.toHaveBeenCalled()
    expect(result.value).toBe('Webhook message sent.')
  })

  test('sends an email message through the Email adapter path', async () => {
    const result = expectTextResult(
      await call('send email Hello from DuckHive', {} as never),
    )

    expect(sendEmailMessage).toHaveBeenCalledWith(
      'Hello from DuckHive',
      expect.objectContaining({
        EMAIL_IMAP_HOST: 'imap.example.com',
        EMAIL_IMAP_USER: 'duck@example.com',
      }),
    )
    expect(startTelegramService).not.toHaveBeenCalled()
    expect(result.value).toBe('Email message sent.')
  })

  test('sends a console message through the Console adapter path', async () => {
    const result = expectTextResult(
      await call('send console Hello from DuckHive', {} as never),
    )

    expect(sendConsoleMessage).toHaveBeenCalledWith('Hello from DuckHive')
    expect(startTelegramService).not.toHaveBeenCalled()
    expect(result.value).toBe('Console message emitted.')
  })

  test('allows outbound-only email send config by falling back to SMTP env values', async () => {
    setChannelTestDeps({
      connectCall,
      sendTelegramMessage,
      sendWebhookMessage,
      sendEmailMessage,
      sendConsoleMessage,
      startTelegramService,
      getSecureStorage: () => ({
        read: () => ({
          pluginSecrets: {
            telegram: {
              botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
              chatId: '42',
            },
          },
        }),
      }),
      env: {
        ...envBaseline,
        EMAIL_SMTP_HOST: 'smtp-only.example.com',
        EMAIL_SMTP_USER: 'mailer@example.com',
        EMAIL_SMTP_PASSWORD: 'secret',
        EMAIL_FROM: 'mailer@example.com',
        EMAIL_TO: 'ops@example.com',
        WEBHOOK_PORT: '3848',
        WEBHOOK_OUTBOUND_URL: 'https://example.com/webhook',
      },
    })

    const result = expectTextResult(
      await call('send email Hello from DuckHive', {} as never),
    )

    expect(sendEmailMessage).toHaveBeenCalledWith(
      'Hello from DuckHive',
      expect.objectContaining({
        EMAIL_SMTP_HOST: 'smtp-only.example.com',
        EMAIL_SMTP_USER: 'mailer@example.com',
        EMAIL_TO: 'ops@example.com',
      }),
    )
    expect(result.value).toBe('Email message sent.')
  })

  test('shows smtp-only email config as outbound-ready in status output', async () => {
    setChannelTestDeps({
      connectCall,
      sendTelegramMessage,
      sendWebhookMessage,
      sendEmailMessage,
      sendConsoleMessage,
      startTelegramService,
      getSecureStorage: () => ({
        read: () => ({
          pluginSecrets: {
            telegram: {
              botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
              chatId: '42',
            },
          },
        }),
      }),
      env: {
        ...envBaseline,
        EMAIL_SMTP_HOST: 'smtp-only.example.com',
        EMAIL_SMTP_USER: 'mailer@example.com',
        EMAIL_SMTP_PASSWORD: 'secret',
        EMAIL_FROM: 'mailer@example.com',
        EMAIL_TO: 'ops@example.com',
        WEBHOOK_PORT: '3848',
        WEBHOOK_OUTBOUND_URL: 'https://example.com/webhook',
      },
    })

    const result = expectTextResult(await call('status email', {} as never))

    expect(result.value).toContain('email - config present')
    expect(result.value).toContain('smtp-only.example.com')
    expect(result.value).toContain('ops@example.com')
    expect(result.value).toContain('inbound: not ready | outbound: ready')
    expect(result.value).toContain('runtime: not connected')
  })

  test('shows inbound-only webhook config as not ready for outbound send', async () => {
    setChannelTestDeps({
      connectCall,
      sendTelegramMessage,
      sendWebhookMessage,
      sendEmailMessage,
      sendConsoleMessage,
      startTelegramService,
      getSecureStorage: () => ({
        read: () => ({
          pluginSecrets: {
            telegram: {
              botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
              chatId: '42',
            },
          },
        }),
      }),
      env: {
        ...envBaseline,
        WEBHOOK_PORT: '3848',
      },
    })

    const result = expectTextResult(await call('status webhook', {} as never))

    expect(result.value).toContain('webhook - config present')
    expect(result.value).toContain('missing WEBHOOK_OUTBOUND_URL')
    expect(result.value).toContain('inbound: ready | outbound: not ready')
    expect(result.value).toContain('runtime: not connected')
  })

  test('returns a useful error when webhook connect fails', async () => {
    connectWebhookRuntime.mockImplementationOnce(async () => {
      throw new Error('[WebhookAdapter] Port 3848 is already in use.')
    })

    const result = expectTextResult(await call('connect webhook', {} as never))

    expect(result.value).toContain('Webhook connect failed')
    expect(result.value).toContain('already in use')
  })

  test('returns a useful error when email connect fails', async () => {
    connectEmailRuntime.mockImplementationOnce(async () => {
      throw new Error('[EmailAdapter] IMAP host and user are required.')
    })

    const result = expectTextResult(await call('connect email', {} as never))

    expect(result.value).toContain('Email connect failed')
    expect(result.value).toContain('IMAP host and user are required')
  })

  test('returns a useful error when webhook send fails', async () => {
    sendWebhookMessage.mockImplementationOnce(async () => {
      throw new Error('[WebhookAdapter] sendMessage requires outboundUrl to be configured.')
    })

    const result = expectTextResult(
      await call('send webhook Hello from DuckHive', {} as never),
    )

    expect(result.value).toContain('Webhook send failed')
    expect(result.value).toContain('outboundUrl')
  })

  test('returns a useful error when email send fails', async () => {
    sendEmailMessage.mockImplementationOnce(async () => {
      throw new Error('[EmailAdapter] sendMessage requires a recipient.')
    })

    const result = expectTextResult(
      await call('send email Hello from DuckHive', {} as never),
    )

    expect(result.value).toContain('Email send failed')
    expect(result.value).toContain('recipient')
  })

  test('returns a useful error when console send fails', async () => {
    sendConsoleMessage.mockImplementationOnce(async () => {
      throw new Error('stdout unavailable')
    })

    const result = expectTextResult(
      await call('send console Hello from DuckHive', {} as never),
    )

    expect(result.value).toContain('Console send failed')
    expect(result.value).toContain('stdout unavailable')
  })

  test('returns a useful error when Telegram send cannot deliver', async () => {
    sendTelegramMessage.mockImplementationOnce(async () => false)

    const result = expectTextResult(
      await call('send telegram Hello from DuckHive', {} as never),
    )

    expect(result.value).toContain('Telegram send failed')
  })

  test('send rejects unknown adapter names with the full supported list', async () => {
    const result = expectTextResult(await call('send smoke-test hello', {} as never))

    expect(result.value).toContain('Available: telegram, webhook, email, console')
  })
})
