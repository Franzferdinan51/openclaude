import { expect, test } from 'bun:test'
import { shouldSkipProviderStartup } from './providerStartupGate.js'

test('skips provider startup for help output', () => {
  expect(shouldSkipProviderStartup(['--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['tui', '--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['-h'])).toBe(true)
})

test('skips provider startup for utility commands', () => {
  expect(shouldSkipProviderStartup(['tui'])).toBe(true)
  expect(shouldSkipProviderStartup(['doctor'])).toBe(true)
  expect(shouldSkipProviderStartup(['mcp', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['plugin', 'list'])).toBe(true)
})

test('keeps provider startup for interactive and print prompts', () => {
  expect(shouldSkipProviderStartup([])).toBe(false)
  expect(shouldSkipProviderStartup(['--print', 'hello'])).toBe(false)
  expect(shouldSkipProviderStartup(['Implement a feature'])).toBe(false)
})
