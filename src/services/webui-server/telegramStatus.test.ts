import { describe, expect, test } from 'bun:test'
import { getTelegramWebUiStatus } from './telegramStatus.js'

describe('getTelegramWebUiStatus', () => {
  test('detects Telegram config from either supported bot token env var', () => {
    expect(
      getTelegramWebUiStatus({
        DUCKHIVE_TELEGRAM_BOT_TOKEN: '123:duckhive-token',
      }),
    ).toEqual({
      configured: true,
      allowlistConfigured: false,
    })

    expect(
      getTelegramWebUiStatus({
        TELEGRAM_BOT_TOKEN: '123:telegram-token',
      }),
    ).toEqual({
      configured: true,
      allowlistConfigured: false,
    })
  })

  test('detects allowlist configuration from DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID', () => {
    expect(
      getTelegramWebUiStatus({
        DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID: '12345,67890',
      }),
    ).toEqual({
      configured: false,
      allowlistConfigured: true,
    })
  })
})
