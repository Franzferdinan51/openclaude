// @ts-nocheck
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import {
  createCacheSafeParams,
  runForkedAgent,
} from '../utils/forkedAgent.js'
import type { REPLHookContext } from '../utils/hooks/postSamplingHooks.js'
import { createUserMessage } from '../utils/messages.js'
import { logForDebugging } from '../utils/debug.js'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import type { Tool } from '../Tool.js'
import { FILE_WRITE_TOOL_NAME } from '../tools/FileWriteTool/prompt.js'
import { logEvent } from './analytics/index.js'

const REVIEW_COOLDOWN_MS = 5 * 60 * 1000
const MIN_USER_MESSAGES = 3

let lastReviewTime = 0

export function getSelfImprovementDir(
  configHomeDir = getClaudeConfigHomeDir(),
): string {
  return join(configHomeDir, 'self-improvement')
}

export function getSelfImprovementReviewsDir(
  configHomeDir = getClaudeConfigHomeDir(),
): string {
  return join(getSelfImprovementDir(configHomeDir), 'reviews')
}

export function shouldRunSelfImprovementReview(options: {
  userMessageCount: number
  now?: number
  lastReviewTime?: number
  cooldownMs?: number
}): boolean {
  const now = options.now ?? Date.now()
  const last = options.lastReviewTime ?? lastReviewTime
  const cooldownMs = options.cooldownMs ?? REVIEW_COOLDOWN_MS

  return (
    options.userMessageCount >= MIN_USER_MESSAGES &&
    now - last >= cooldownMs
  )
}

function countUserMessages(context: REPLHookContext): number {
  return context.messages.filter(message => message.type === 'user').length
}

function formatRecentMessages(
  context: REPLHookContext,
  limit = 12,
): string {
  return context.messages
    .filter(
      message => message.type === 'user' || message.type === 'assistant',
    )
    .slice(-limit)
    .map(message => {
      const role = message.type === 'user' ? 'User' : 'Assistant'
      const content = message.message.content
      if (typeof content === 'string') {
        return `${role}: ${content.slice(0, 1200)}`
      }
      const text = content
        .filter(
          block => block.type === 'text',
        )
        .map(block => block.text)
        .join('\n')
      return `${role}: ${text.slice(0, 1200)}`
    })
    .join('\n\n')
}

export function buildSelfImprovementReviewPrompt(
  context: REPLHookContext,
  reviewsDir = getSelfImprovementReviewsDir(),
): string {
  const fileName = `${new Date().toISOString().replace(/[:.]/g, '-')}-review.md`
  const filePath = join(reviewsDir, fileName)

  return `You are DuckHive's self-improvement review subagent.

Review the recent conversation and decide whether there are reusable improvements DuckHive should remember.

Write a markdown review ONLY if there is actionable value. If there is nothing durable or reusable, do not write any file.

Write the review to:
${filePath}

Allowed tool:
- ${FILE_WRITE_TOOL_NAME} only

Your review should focus on:
1. Memory usefulness: facts, preferences, workflows, or environment details that should become durable memory but may not be captured yet.
2. Skill usefulness: repeated workflow gaps, missing command guidance, or reusable procedures that should become a new skill or change an existing one.
3. Harness friction: unfinished behavior, integration mismatches, or repeated user pain that should become future engineering work.

Output format for the markdown file:

# Self-Improvement Review

## Session Signals
- concise bullets from the recent conversation

## Memory Opportunities
- "None" if nothing durable is missing

## Skill Opportunities
- "None" if no reusable skill/process improvement is needed

## Harness Gaps
- "None" if no concrete product/runtime gap appeared

## Recommended Next Action
- one concrete next step

Recent conversation:
${formatRecentMessages(context)}
`
}

function denyReviewTool(tool: Tool, reason: string) {
  logForDebugging(`[selfImprovement] denied ${tool.name}: ${reason}`)
  return {
    behavior: 'deny' as const,
    message: reason,
    decisionReason: { type: 'other' as const, reason },
  }
}

function createSelfImprovementCanUseTool(
  reviewsDir = getSelfImprovementReviewsDir(),
): CanUseToolFn {
  return async (tool: Tool, input: Record<string, unknown>) => {
    if (tool.name !== FILE_WRITE_TOOL_NAME) {
      return denyReviewTool(
        tool,
        `only ${FILE_WRITE_TOOL_NAME} within ${reviewsDir} is allowed`,
      )
    }

    const filePath = input.file_path
    if (typeof filePath === 'string' && filePath.startsWith(reviewsDir)) {
      return { behavior: 'allow' as const, updatedInput: input }
    }

    return denyReviewTool(
      tool,
      `${FILE_WRITE_TOOL_NAME} is restricted to ${reviewsDir}`,
    )
  }
}

export async function checkAndReviewSelfImprovement(
  context: REPLHookContext,
  deps?: {
    now?: () => number
    runForkedAgentFn?: typeof runForkedAgent
    reviewsDir?: string
  },
): Promise<void> {
  const now = deps?.now?.() ?? Date.now()
  const userMessageCount = countUserMessages(context)
  if (
    !shouldRunSelfImprovementReview({
      userMessageCount,
      now,
    })
  ) {
    return
  }

  lastReviewTime = now

  const reviewsDir = deps?.reviewsDir ?? getSelfImprovementReviewsDir()
  if (!existsSync(reviewsDir)) {
    mkdirSync(reviewsDir, { recursive: true })
  }

  const runForkedAgentFn = deps?.runForkedAgentFn ?? runForkedAgent
  const cacheSafeParams = createCacheSafeParams(context)
  const prompt = buildSelfImprovementReviewPrompt(context, reviewsDir)

  logEvent('tengu_self_improvement_review_started', {
    userMessageCount,
  })

  await runForkedAgentFn({
    promptMessages: [createUserMessage({ content: prompt })],
    cacheSafeParams,
    canUseTool: createSelfImprovementCanUseTool(reviewsDir),
    querySource: 'autonomous_skill_creation',
    forkLabel: 'self_improvement_review',
    skipTranscript: true,
    maxTurns: 4,
  })

  logEvent('tengu_self_improvement_review_finished', {
    userMessageCount,
  })
}

export function resetSelfImprovementReviewStateForTesting(): void {
  lastReviewTime = 0
}
