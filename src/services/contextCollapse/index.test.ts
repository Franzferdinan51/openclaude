import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  applyCollapsesIfNeeded,
  getContextCollapseState,
  getStats,
  initContextCollapse,
  isContextCollapseEnabled,
  isWithheldPromptTooLong,
  recoverFromOverflow,
  resetContextCollapse,
  subscribe,
} from './index.js'

function message(role: 'user' | 'assistant', index: number): {
  role: 'user' | 'assistant'
  content: string
} {
  return {
    role,
    content: `${role} message ${index}`,
  }
}

function longConversation(count = 24): unknown[] {
  return Array.from({ length: count }, (_, index) =>
    message(index % 2 === 0 ? 'user' : 'assistant', index),
  )
}

beforeEach(() => {
  delete process.env.DUCKHIVE_CONTEXT_COLLAPSE
  resetContextCollapse()
  initContextCollapse()
})

afterEach(() => {
  delete process.env.DUCKHIVE_CONTEXT_COLLAPSE
  resetContextCollapse()
  initContextCollapse()
})

describe('contextCollapse service', () => {
  test('exports safe inactive behavior when not enabled', () => {
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
  })

  test('subscribers are notified when enablement and stats change', () => {
    let notifications = 0
    const unsubscribe = subscribe(() => {
      notifications += 1
    })

    process.env.DUCKHIVE_CONTEXT_COLLAPSE = '1'
    initContextCollapse()
    expect(notifications).toBe(1)

    applyCollapsesIfNeeded(longConversation(), undefined, 'test')
    expect(notifications).toBe(2)

    resetContextCollapse()
    expect(notifications).toBe(3)

    unsubscribe()
    resetContextCollapse()
    expect(notifications).toBe(3)
  })

  test('collapses the middle of long conversations and snapshots stats immutably', () => {
    process.env.DUCKHIVE_CONTEXT_COLLAPSE = '1'
    initContextCollapse()

    const result = applyCollapsesIfNeeded(longConversation(), undefined, 'test')
    expect(result.messages).toHaveLength(13)
    expect(JSON.stringify(result.messages[6])).toContain(
      'Previous conversation summary (12 messages collapsed)',
    )

    const stats = getStats()
    expect(stats.collapsedSpans).toBe(1)
    expect(stats.collapsedMessages).toBe(12)
    stats.health.totalErrors = 99
    expect(getStats().health.totalErrors).toBe(0)
  })

  test('recoverFromOverflow matches the query recovery contract', () => {
    process.env.DUCKHIVE_CONTEXT_COLLAPSE = '1'
    initContextCollapse()

    const recovered = recoverFromOverflow(longConversation(), 'primary')
    expect(recovered.committed).toBe(11)
    expect(recovered.messages).toHaveLength(13)

    const noOp = recoverFromOverflow([message('user', 1)], 'primary')
    expect(noOp.committed).toBe(0)
    expect(noOp.messages).toHaveLength(1)
  })
})
