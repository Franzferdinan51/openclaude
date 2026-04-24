import { describe, expect, test } from 'bun:test'
import {
  getContextCollapseState,
  getStats,
  initContextCollapse,
  isContextCollapseEnabled,
  isWithheldPromptTooLong,
  resetContextCollapse,
  subscribe,
} from './index.js'

describe('contextCollapse stub', () => {
  test('exports safe no-op behavior when the feature implementation is absent', () => {
    expect(isContextCollapseEnabled()).toBe(false)
    expect(getContextCollapseState()).toBeNull()
    expect(getStats()).toEqual({
      collapsedSpans: 0,
      collapsedMessages: 0,
      stagedSpans: 0,
      health: {
        totalSpawns: 0,
        totalErrors: 0,
        lastError: null,
        totalEmptySpawns: 0,
        emptySpawnWarningEmitted: false,
      },
    })
    expect(isWithheldPromptTooLong()).toBe(false)

    const unsubscribe = subscribe(() => {})

    expect(() => {
      initContextCollapse()
      resetContextCollapse()
      unsubscribe()
    }).not.toThrow()
  })
})
