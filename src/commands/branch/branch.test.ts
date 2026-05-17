import { describe, expect, test } from 'bun:test'
import { formatOriginalResumeHint } from './branch.js'

describe('/branch command output', () => {
  test('uses DuckHive resume command in original-session hint', () => {
    const hint = formatOriginalResumeHint('session-123')

    expect(hint).toBe('\nTo resume the original: duckhive -r session-123')
    expect(hint).not.toContain('claude -r')
  })
})
