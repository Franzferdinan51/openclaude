import { afterEach, describe, expect, test } from 'bun:test'
import { setOriginalCwd } from '../bootstrap/state.js'
import type { LogOption } from '../types/logs.js'
import { checkCrossProjectResume } from './crossProjectResume.js'

const originalCwd = process.cwd()

function makeLog(projectPath: string): LogOption {
  return {
    date: '2026-05-17',
    messages: [],
    value: 0,
    created: new Date('2026-05-17T00:00:00Z'),
    modified: new Date('2026-05-17T00:00:00Z'),
    firstPrompt: 'hello',
    messageCount: 1,
    isSidechain: false,
    isLite: true,
    sessionId: '00000000-0000-4000-8000-000000000001',
    projectPath,
  }
}

afterEach(() => {
  setOriginalCwd(originalCwd)
  delete process.env.USER_TYPE
})

describe('checkCrossProjectResume', () => {
  test('uses duckhive in cross-project resume commands', () => {
    setOriginalCwd('C:\\repo\\current')

    const result = checkCrossProjectResume(
      makeLog('C:\\repo\\other'),
      true,
      [],
    )

    expect(result.isCrossProject).toBe(true)
    expect(result.isSameRepoWorktree).toBe(false)
    if (result.isCrossProject && !result.isSameRepoWorktree) {
      expect(result.command).toContain('duckhive --resume 00000000-0000-4000-8000-000000000001')
      expect(result.command).not.toContain('claude --resume')
    }
  })

  test('keeps same-repo worktrees resumable without a shell command', () => {
    process.env.USER_TYPE = 'ant'
    setOriginalCwd('C:\\repo\\current')

    const result = checkCrossProjectResume(
      makeLog('C:\\repo\\worktree\\feature'),
      true,
      ['C:\\repo\\worktree'],
    )

    expect(result).toEqual({
      isCrossProject: true,
      isSameRepoWorktree: true,
      projectPath: 'C:\\repo\\worktree\\feature',
    })
  })
})
