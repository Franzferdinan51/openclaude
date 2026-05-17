import { describe, expect, test } from 'bun:test'
import {
  hasDangerousSkipPermissionFlag,
  removeDangerousSkipPermissionFlags,
} from './dangerousModeArgs.js'

describe('dangerous mode CLI args', () => {
  test('treats --yolo and --dangerously-skip-permissions as the same consent flag', () => {
    expect(hasDangerousSkipPermissionFlag(['--yolo'])).toBe(true)
    expect(hasDangerousSkipPermissionFlag(['--dangerously-skip-permissions'])).toBe(true)
  })

  test('ignores unrelated args', () => {
    expect(hasDangerousSkipPermissionFlag(['--permission-mode', 'auto'])).toBe(false)
  })

  test('removes every dangerous-mode alias in place', () => {
    const args = [
      'ssh',
      '--yolo',
      '--permission-mode',
      'default',
      '--dangerously-skip-permissions',
      'host',
    ]

    expect(removeDangerousSkipPermissionFlags(args)).toBe(true)
    expect(args).toEqual(['ssh', '--permission-mode', 'default', 'host'])
  })

  test('reports no removal when neither alias is present', () => {
    const args = ['cc://example', '--print']

    expect(removeDangerousSkipPermissionFlags(args)).toBe(false)
    expect(args).toEqual(['cc://example', '--print'])
  })
})
