import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  buildSessionSearchTerms,
  SessionSearchTool,
  escapeSessionSearchRegex,
  getSessionSearchRootDir,
  searchSessions,
  setSessionSearchToolTestDeps,
} from './SessionSearchTool.ts'

let configHomeDir: string

describe('SessionSearchTool', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-session-search-'))
    setSessionSearchToolTestDeps({ getClaudeConfigHomeDir: () => configHomeDir })
  })

  afterEach(() => {
    setSessionSearchToolTestDeps(null)
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('uses DuckHive config home for session search root', () => {
    expect(getSessionSearchRootDir()).toBe(join(configHomeDir, 'sessions'))
  })

  test('search escapes regex metacharacters and still finds literal matches', async () => {
    expect(escapeSessionSearchRegex('deploy(v2)+?')).toBe('deploy\\(v2\\)\\+\\?')
    expect(buildSessionSearchTerms('UI')).toEqual(['ui'])
    expect(buildSessionSearchTerms('deploy(v2)+? fix')).toEqual([
      'deploy(v2)+? fix',
      'deploy(v2)+?',
      'fix',
    ])

    const sessionDir = join(configHomeDir, 'sessions', 'session-a')
    mkdirSync(sessionDir, { recursive: true })
    writeFileSync(
      join(sessionDir, 'messages.jsonl'),
      [
        JSON.stringify({ role: 'user', content: 'Need deploy(v2)+? fallback plan' }),
        JSON.stringify({ role: 'assistant', content: 'Investigating deploy(v2)+? issue now.' }),
      ].join('\n'),
      'utf8',
    )

    const results = searchSessions('deploy(v2)+?', 5)
    expect(results).toHaveLength(1)
    expect(results[0]?.sessionId).toBe('session-a')
    expect(results[0]?.snippet).toContain('deploy(v2)+?')

    const toolResult = await SessionSearchTool.call(
      { query: 'deploy(v2)+?', limit: 5 },
      {} as never,
      undefined as never,
      undefined as never,
    )
    expect(toolResult.data.total).toBe(1)
    expect(toolResult.data.sessions[0]?.sessionId).toBe('session-a')
  })

  test('search supports short literal queries instead of dropping them', () => {
    const sessionDir = join(configHomeDir, 'sessions', 'session-ui')
    mkdirSync(sessionDir, { recursive: true })
    writeFileSync(
      join(sessionDir, 'messages.jsonl'),
      JSON.stringify({ role: 'user', content: 'UI polish still missing in settings dialog' }),
      'utf8',
    )

    const results = searchSessions('UI', 5)
    expect(results).toHaveLength(1)
    expect(results[0]?.snippet).toContain('UI polish')
  })
})
