import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  buildSelfImprovementReviewPrompt,
  checkAndReviewSelfImprovement,
  getSelfImprovementDir,
  getSelfImprovementReviewsDir,
  resetSelfImprovementReviewStateForTesting,
  shouldRunSelfImprovementReview,
} from './selfImprovementReview.js'

const tempDirs: string[] = []

afterEach(() => {
  resetSelfImprovementReviewStateForTesting()
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'duckhive-self-review-'))
  tempDirs.push(dir)
  return dir
}

function makeContext(userMessages = 3) {
  const messages = []
  for (let i = 0; i < userMessages; i++) {
    messages.push({
      type: 'user',
      message: { content: `user message ${i + 1}` },
    })
    messages.push({
      type: 'assistant',
      message: { content: `assistant response ${i + 1}` },
    })
  }

  return {
    messages,
    systemPrompt: [] as never,
    userContext: {},
    systemContext: {},
    toolUseContext: {} as never,
    querySource: 'repl_main_thread',
  } as never
}

describe('self improvement review helpers', () => {
  test('uses DuckHive config home for default review roots', () => {
    expect(getSelfImprovementDir('C:/DuckHive')).toBe(
      join('C:/DuckHive', 'self-improvement'),
    )
    expect(getSelfImprovementReviewsDir('C:/DuckHive')).toBe(
      join('C:/DuckHive', 'self-improvement', 'reviews'),
    )
  })

  test('requires enough user messages and respects cooldown', () => {
    expect(
      shouldRunSelfImprovementReview({
        userMessageCount: 2,
        now: 1_000,
        lastReviewTime: 0,
      }),
    ).toBe(false)

    expect(
      shouldRunSelfImprovementReview({
        userMessageCount: 3,
        now: 1_000,
        lastReviewTime: 0,
      }),
    ).toBe(false)

    expect(
      shouldRunSelfImprovementReview({
        userMessageCount: 3,
        now: 301_000,
        lastReviewTime: 0,
      }),
    ).toBe(true)
  })

  test('builds a concrete review prompt with the output path and conversation slice', () => {
    const reviewsDir = makeTempDir()
    const prompt = buildSelfImprovementReviewPrompt(makeContext(3), reviewsDir)

    expect(prompt).toContain(reviewsDir)
    expect(prompt).toContain('# Self-Improvement Review')
    expect(prompt).toContain('user message 1')
    expect(prompt).toContain('assistant response 3')
  })
})

describe('checkAndReviewSelfImprovement', () => {
  test('does not launch a fork before thresholds are met', async () => {
    let called = false

    await checkAndReviewSelfImprovement(makeContext(2), {
      now: () => 301_000,
      runForkedAgentFn: (async () => {
        called = true
        return { messages: [], totalUsage: {} } as never
      }) as never,
      reviewsDir: makeTempDir(),
    })

    expect(called).toBe(false)
  })

  test('launches a background review fork once thresholds are met', async () => {
    let capturedPrompt = ''
    let capturedForkLabel = ''

    await checkAndReviewSelfImprovement(makeContext(3), {
      now: () => 301_000,
      runForkedAgentFn: (async params => {
        capturedPrompt = String(params.promptMessages[0]?.message?.content ?? '')
        capturedForkLabel = params.forkLabel
        return { messages: [], totalUsage: {} } as never
      }) as never,
      reviewsDir: makeTempDir(),
    })

    expect(capturedForkLabel).toBe('self_improvement_review')
    expect(capturedPrompt).toContain('Self-Improvement Review')
    expect(capturedPrompt).toContain('Recommended Next Action')
  })
})
