import { expect, test } from 'bun:test'
import {
  isVersionRequest,
  shouldSkipProviderStartup,
} from './providerStartupGate.js'

test('detects version requests even when combined with startup-only flags', () => {
  expect(isVersionRequest(['--version'])).toBe(true)
  expect(isVersionRequest(['--yolo', '--version'])).toBe(true)
  expect(isVersionRequest(['--dangerously-skip-permissions', '-v'])).toBe(true)
  expect(isVersionRequest(['--help'])).toBe(false)
})

test('skips provider startup for help output', () => {
  expect(shouldSkipProviderStartup(['--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['tui', '--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['-h'])).toBe(true)
})

test('skips provider startup for version output', () => {
  expect(shouldSkipProviderStartup(['--version'])).toBe(true)
  expect(shouldSkipProviderStartup(['--yolo', '--version'])).toBe(true)
  expect(shouldSkipProviderStartup(['--dangerously-skip-permissions', '-v'])).toBe(true)
})

test('skips provider startup for utility commands', () => {
  expect(shouldSkipProviderStartup(['tui'])).toBe(true)
  expect(shouldSkipProviderStartup(['doctor'])).toBe(true)
  expect(shouldSkipProviderStartup(['runtime-doctor'])).toBe(true)
  expect(shouldSkipProviderStartup(['doctor-runtime'])).toBe(true)
  expect(shouldSkipProviderStartup(['mcp', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['plugin', 'list'])).toBe(true)
})

test('keeps provider startup for interactive and print prompts', () => {
  expect(shouldSkipProviderStartup([])).toBe(false)
  expect(shouldSkipProviderStartup(['--print', 'hello'])).toBe(false)
  expect(shouldSkipProviderStartup(['--print', 'doctor'])).toBe(false)
  expect(shouldSkipProviderStartup(['--add-dir', '.', 'tui'])).toBe(false)
  expect(shouldSkipProviderStartup(['Implement a feature'])).toBe(false)
})
