import { expect, test } from 'bun:test'
import {
  getCliCommandPosition,
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
  expect(shouldSkipProviderStartup(['doctor:runtime'])).toBe(true)
  expect(shouldSkipProviderStartup(['runtime-doctor'])).toBe(true)
  expect(shouldSkipProviderStartup(['doctor-runtime'])).toBe(true)
  expect(shouldSkipProviderStartup(['input-test'])).toBe(true)
  expect(shouldSkipProviderStartup(['mcp', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['plugin', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['skill', '--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['skill-workshop', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['skills'])).toBe(true)
  expect(shouldSkipProviderStartup(['goal', 'status'])).toBe(true)
  expect(shouldSkipProviderStartup(['g', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['computer-use', 'status'])).toBe(true)
  expect(shouldSkipProviderStartup(['cu', 'status'])).toBe(true)
  expect(shouldSkipProviderStartup(['config', '--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['settings', 'path'])).toBe(true)
  expect(shouldSkipProviderStartup(['mmx', '--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['minimax', '--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['provider', 'status'])).toBe(true)
  expect(shouldSkipProviderStartup(['permissions', 'profile', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['allowed-tools', 'profile', 'status'])).toBe(true)
  expect(shouldSkipProviderStartup(['checkpoint', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['checkpoints', 'save', 'before-refactor'])).toBe(true)
  expect(shouldSkipProviderStartup(['run', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['runs', 'running'])).toBe(true)
  expect(shouldSkipProviderStartup(['agent-run', 'tail', 'run_123'])).toBe(true)
  expect(shouldSkipProviderStartup(['channel', 'status'])).toBe(true)
  expect(shouldSkipProviderStartup(['connect', 'status'])).toBe(true)
  expect(shouldSkipProviderStartup(['telegram', 'status'])).toBe(true)
  expect(shouldSkipProviderStartup(['team', 'templates'])).toBe(true)
  expect(shouldSkipProviderStartup(['council', '--modes'])).toBe(true)
  expect(shouldSkipProviderStartup(['senate', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['decree', 'list'])).toBe(true)
  expect(shouldSkipProviderStartup(['swarm', '--list'])).toBe(true)
  expect(shouldSkipProviderStartup(['orchestrate', '--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['spawn', '--help'])).toBe(true)
  expect(shouldSkipProviderStartup(['subagent', 'audit', 'routing'])).toBe(true)
  expect(shouldSkipProviderStartup(['deep-dive', 'inspect', 'memory'])).toBe(true)
  expect(shouldSkipProviderStartup(['ps'])).toBe(true)
  expect(shouldSkipProviderStartup(['logs', 'run_123'])).toBe(true)
  expect(shouldSkipProviderStartup(['attach', 'run_123'])).toBe(true)
  expect(shouldSkipProviderStartup(['pause', 'run_123'])).toBe(true)
  expect(shouldSkipProviderStartup(['resume', 'run_123'])).toBe(true)
  expect(shouldSkipProviderStartup(['approve', 'run_123', 'approval-1'])).toBe(true)
  expect(shouldSkipProviderStartup(['recover', 'run_123'])).toBe(true)
  expect(shouldSkipProviderStartup(['kill', 'run_123'])).toBe(true)
  expect(shouldSkipProviderStartup(['--bg', 'Long running task'])).toBe(true)
})

test('detects utility commands after global options with values', () => {
  expect(
    getCliCommandPosition(['--stdin-mode', 'data', 'runtime-doctor']),
  ).toEqual({ command: 'runtime-doctor', index: 2 })
  expect(
    getCliCommandPosition(['--stdin-mode=data', 'goal', 'status']),
  ).toEqual({ command: 'goal', index: 1 })
  expect(
    shouldSkipProviderStartup(['--stdin-mode', 'data', 'runtime-doctor']),
  ).toBe(true)
  expect(
    shouldSkipProviderStartup(['--provider', 'minimax', 'goal', 'status']),
  ).toBe(true)
  expect(
    shouldSkipProviderStartup(['--model=MiniMax-M2.7', 'channel', 'status']),
  ).toBe(true)
  expect(
    shouldSkipProviderStartup(['--stdin-mode', 'data', 'skill', '--help']),
  ).toBe(true)
})

test('keeps provider startup for interactive and print prompts', () => {
  expect(shouldSkipProviderStartup([])).toBe(false)
  expect(shouldSkipProviderStartup(['--print', 'hello'])).toBe(false)
  expect(shouldSkipProviderStartup(['--print', 'doctor'])).toBe(false)
  expect(shouldSkipProviderStartup(['--print', '/unknown-local'])).toBe(false)
  expect(shouldSkipProviderStartup(['--add-dir', '.', 'tui'])).toBe(false)
  expect(shouldSkipProviderStartup(['Implement a feature'])).toBe(false)
})

test('skips provider startup for provider-free print slash commands', () => {
  expect(shouldSkipProviderStartup(['--bare', '-p', '/loop help'])).toBe(true)
  expect(shouldSkipProviderStartup(['--print', '/android'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/vision analyze "describe"'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/shadow list'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/router list'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/budget'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/cache stats'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/export --help'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/goal status'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/permissions profile list'])).toBe(true)
  expect(shouldSkipProviderStartup(['-p', '/allowed-tools profile status'])).toBe(true)
})
