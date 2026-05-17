import { expect, test } from 'bun:test'
import { applyEarlyCliFlags, hasEarlyYoloFlag } from './earlyCliFlags.js'

test('detects yolo and dangerously-skip-permissions as the same early mode', () => {
  expect(hasEarlyYoloFlag(['--yolo'])).toBe(true)
  expect(hasEarlyYoloFlag(['--dangerously-skip-permissions'])).toBe(true)
  expect(hasEarlyYoloFlag(['--help'])).toBe(false)
})

test('applies early startup env for bare and bypass-permissions flags', () => {
  const env: NodeJS.ProcessEnv = {}

  applyEarlyCliFlags(['--bare', '--dangerously-skip-permissions'], env)

  expect(env.CLAUDE_CODE_SIMPLE).toBe('1')
  expect(env.CLAUDE_CODE_YOLO).toBe('1')
})

test('applies early startup env for yolo alias', () => {
  const env: NodeJS.ProcessEnv = {}

  applyEarlyCliFlags(['--yolo'], env)

  expect(env.CLAUDE_CODE_YOLO).toBe('1')
})
