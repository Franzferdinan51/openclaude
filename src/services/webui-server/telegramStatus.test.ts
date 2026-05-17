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
      source: 'environment',
      chatIdConfigured: false,
    })

    expect(
      getTelegramWebUiStatus({
        TELEGRAM_BOT_TOKEN: '123:telegram-token',
      }),
    ).toEqual({
      configured: true,
      allowlistConfigured: false,
      source: 'environment',
      chatIdConfigured: false,
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
      source: undefined,
      chatIdConfigured: true,
    })
  })

  test('detects Telegram config from secure storage when env vars are absent', () => {
    expect(
      getTelegramWebUiStatus(
        {},
        {
          storageData: {
            pluginSecrets: {
              telegram: {
                botToken: '123:stored-token',
                chatId: '424242',
                connectedAt: '1700000000000',
              },
            },
          },
        },
      ),
    ).toEqual({
      configured: true,
      allowlistConfigured: false,
      source: 'storage',
      chatIdConfigured: true,
      connectedAt: '1700000000000',
    })
  })

  test('does not inherit stored chat metadata when an env token overrides storage', () => {
    expect(
      getTelegramWebUiStatus(
        {
          DUCKHIVE_TELEGRAM_BOT_TOKEN: '123:env-token',
        },
        {
          storageData: {
            pluginSecrets: {
              telegram: {
                botToken: '123:stored-token',
                chatId: 'old-chat',
                connectedAt: '1700000000000',
              },
            },
          },
        },
      ),
    ).toEqual({
      configured: true,
      allowlistConfigured: false,
      source: 'environment',
      chatIdConfigured: false,
      connectedAt: undefined,
    })
  })
})
