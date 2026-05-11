/**
 * Autonomous Skill Creation — Hermes-pattern self-improving agent.
 *
 * Detects repeated task patterns across sessions and auto-writes
 * skills/<slug>/SKILL.md files that the agent can use later.
 *
 * Detection: after each memory extraction, scan memory files for topics
 * that appeared 3+ times across recent sessions. When threshold is met,
 * invoke a forked agent to author a SKILL.md following the existing
 * skill format.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createAbortController } from '../utils/abortController.js'
import { logForDebugging } from '../utils/debug.js'
import {
  createCacheSafeParams,
  runForkedAgent,
} from '../utils/forkedAgent.js'
import type { REPLHookContext } from '../utils/hooks/postSamplingHooks.js'
import { createUserMessage } from '../utils/messages.js'
import { logEvent } from './analytics/index.js'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import { FILE_EDIT_TOOL_NAME } from '../tools/FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../tools/FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../tools/FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../tools/GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../tools/GrepTool/prompt.js'
import { REPL_TOOL_NAME } from '../tools/REPLTool/constants.js'
import type { Tool } from '../Tool.js'

// ─── Config ────────────────────────────────────────────────────────────────────

const SKILLS_DIR = join(process.env.HOME ?? '', '.duckhive', 'skills')
const MEMORY_DIR = join(process.env.HOME ?? '', '.claude', 'memory')
const PATTERN_THRESHOLD = 3 // sessions before skill is created
const SKILL_TURN_BUDGET = 6

// ─── Topic Extraction ─────────────────────────────────────────────────────────

/**
 * Slugify a topic name into a directory-safe lowercase kebab-case string.
 * e.g. "Fix search provider config" → "fix-search-provider-config"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extract a clean topic name from a memory filename.
 * Strips date prefix (2026-05-10-), .md suffix, and normalizes.
 * e.g. "2026-05-10-fix-search-provider-config.md" → "fix-search-provider-config"
 */
function extractTopicFromFilename(filename: string): string | null {
  const base = filename.replace(/\.md$/, '')
  // Strip ISO date prefix: 2026-05-10-
  const stripped = base.replace(/^\d{4}-\d{2}-\d{2}-/, '')
  if (!stripped || stripped === base) return null // no date prefix
  return stripped
}

/**
 * Scan memory files for topic frequencies.
 * Returns a map of topic → occurrence count.
 */
function scanMemoryTopics(): Map<string, number> {
  const topics = new Map<string, number>()
  if (!existsSync(MEMORY_DIR)) return topics

  try {
    const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const topic = extractTopicFromFilename(file)
      if (topic) {
        topics.set(topic, (topics.get(topic) ?? 0) + 1)
      }
    }
  } catch {
    // memory dir may not exist
  }

  return topics
}

// ─── Skill Authoring ──────────────────────────────────────────────────────────

/**
 * Returns true if a skill already exists for the given slug.
 */
function skillExists(slug: string): boolean {
  return existsSync(join(SKILLS_DIR, slug, 'SKILL.md'))
}

/**
 * Build the prompt that instructs the forked agent to write a SKILL.md.
 */
function buildSkillAuthorPrompt(topic: string, slug: string): string {
  return `You are the autonomous skill authoring subagent. Your job is to write a SKILL.md file for the topic: "${topic}".

Write the skill file at: ${SKILLS_DIR}/${slug}/SKILL.md

First, create the directory and write the file using ${FILE_WRITE_TOOL_NAME}.

## SKILL.md Format

Follow this exact structure (based on existing DuckHive skills):

\`\`\`markdown
# <slug> — <one-line description>

## Overview
<2-4 sentences describing what this skill does and when to use it>

## When to Use
<3-5 bullet points on specific situations where this skill applies>
- Include concrete examples of user requests that would trigger this skill

## Key Commands/Tools
<bullet list of the main commands, tools, or techniques this skill uses>

## How It Works
<3-6 bullet points explaining the technical approach>

## Common Patterns
<2-4 examples of typical usage>

## Caveats / Gotchas
<any important limitations, requirements, or edge cases>
\`\`\`

Rules:
- Write concrete, specific content — not generic boilerplate
- Include real tool names, file paths, and code examples where relevant
- Do NOT use placeholder text like "add description here" — write the actual content
- Keep it concise but informative (under 80 lines total)
- Only use ${FILE_WRITE_TOOL_NAME} — no other tools needed
`
}

// ─── Permissions ───────────────────────────────────────────────────────────────

function denySkillTool(tool: Tool, reason: string) {
  logForDebugging(`[skillCreation] denied ${tool.name}: ${reason}`)
  return {
    behavior: 'deny' as const,
    message: reason,
    decisionReason: { type: 'other' as const, reason },
  }
}

function createSkillAuthorCanUseTool(): CanUseToolFn {
  return async (tool: Tool, input: Record<string, unknown>) => {
    if (tool.name === REPL_TOOL_NAME) {
      return { behavior: 'allow' as const, updatedInput: input }
    }
    if (
      tool.name === FILE_READ_TOOL_NAME ||
      tool.name === GREP_TOOL_NAME ||
      tool.name === GLOB_TOOL_NAME
    ) {
      return { behavior: 'allow' as const, updatedInput: input }
    }
    if (tool.name === BASH_TOOL_NAME) {
      const parsed = tool.inputSchema.safeParse(input)
      if (parsed.success && tool.isReadOnly(parsed.data)) {
        return { behavior: 'allow' as const, updatedInput: input }
      }
      return denySkillTool(tool, 'Only read-only shell commands permitted')
    }
    if (
      (tool.name === FILE_EDIT_TOOL_NAME ||
        tool.name === FILE_WRITE_TOOL_NAME) &&
      'file_path' in input
    ) {
      const filePath = input.file_path
      if (typeof filePath === 'string' && filePath.startsWith(SKILLS_DIR)) {
        return { behavior: 'allow' as const, updatedInput: input }
      }
    }
    return denySkillTool(
      tool,
      `only ${FILE_READ_TOOL_NAME}, ${GREP_TOOL_NAME}, ${GLOB_TOOL_NAME}, read-only ${BASH_TOOL_NAME}, and ${FILE_WRITE_TOOL_NAME} within ${SKILLS_DIR} are allowed`,
    )
  }
}

// ─── Core Loop ────────────────────────────────────────────────────────────────

let lastCheckTime = 0
const CHECK_COOLDOWN_MS = 30_000 // don't check more than once per 30s

/**
 * Called after each memory extraction pass.
 * Checks for repeated topics and creates skills as needed.
 */
export async function checkAndCreateSkills(
  context: REPLHookContext,
): Promise<void> {
  // Throttle: don't check more than once per 30 seconds
  const now = Date.now()
  if (now - lastCheckTime < CHECK_COOLDOWN_MS) return
  lastCheckTime = now

  const topics = scanMemoryTopics()

  for (const [topic, count] of topics) {
    if (count < PATTERN_THRESHOLD) continue

    const slug = slugify(topic)
    if (skillExists(slug)) {
      logForDebugging(`[skillCreation] skill already exists for "${topic}", skipping`)
      continue
    }

    logForDebugging(
      `[skillCreation] pattern detected: "${topic}" (${count} occurrences) — creating skill`,
    )
    logEvent('tengu_skill_creation_triggered', {
      count,
      slug: slug as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    try {
      await authorSkill(topic, slug, context)
      logEvent('tengu_skill_creation_success', {
        slug: slug as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
    } catch (err) {
      logForDebugging(`[skillCreation] failed to author skill: ${err}`)
      logEvent('tengu_skill_creation_error', {
        error: String(err).slice(0, 100) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
    }
  }
}

async function authorSkill(
  topic: string,
  slug: string,
  context: REPLHookContext,
): Promise<void> {
  // Ensure skills directory exists
  const skillDir = join(SKILLS_DIR, slug)
  mkdirSync(skillDir, { recursive: true })

  const canUseTool = createSkillAuthorCanUseTool()
  const cacheSafeParams = createCacheSafeParams(context)
  const prompt = buildSkillAuthorPrompt(topic, slug)

  const result = await runForkedAgent({
    promptMessages: [createUserMessage({ content: prompt })],
    cacheSafeParams,
    canUseTool,
    querySource: 'autonomous_skill_creation',
    forkLabel: 'skill_author',
    skipTranscript: true,
    maxTurns: SKILL_TURN_BUDGET,
  })

  const writtenPaths = result.messages
    .filter(m => m.type === 'assistant')
    .flatMap(m => {
      if (!('message' in m)) return []
      const content = (m as { message: { content: unknown } }).message.content
      if (!Array.isArray(content)) return []
      return content
        .filter((b: unknown) =>
          b && typeof b === 'object' && 'type' in b && b.type === 'tool_use' &&
          ('name' in b && (b.name === FILE_WRITE_TOOL_NAME || b.name === FILE_EDIT_TOOL_NAME)) &&
          'input' in b && b.input && typeof b.input === 'object' && 'file_path' in (b.input as Record<string, unknown>)
        )
        .map((b: unknown) => ((b as { input: { file_path: string } }).input.file_path))
    })

  const skillFilePath = join(skillDir, 'SKILL.md')
  const wroteSkill = writtenPaths.some(p => p.endsWith('SKILL.md'))

  if (wroteSkill && existsSync(skillFilePath)) {
    logForDebugging(`[skillCreation] authored skill at ${skillFilePath}`)
  } else {
    // Fallback: write a basic skill file if the agent didn't
    const fallback = `# ${slug} — ${topic.replace(/-/g, ' ')}

## Overview
Auto-created skill for topic: ${topic}. This skill was created after detecting a repeated pattern in session memory.

## When to Use
- When the user asks about ${topic.replace(/-/g, ' ')}
- Related tasks that involve ${topic.replace(/-/g, ' ')}

## Key Commands/Tools
- General purpose tools apply
- Check relevant source files for current implementation details

## How It Works
1. Investigate the codebase for relevant context
2. Apply the appropriate tools to complete the task
3. Verify the result

## Common Patterns
- User asks to work on ${topic.replace(/-/g, ' ')}
- Task involves ${topic.replace(/-/g, ' ')} patterns
`
    writeFileSync(skillFilePath, fallback, 'utf8')
    logForDebugging(`[skillCreation] wrote fallback skill at ${skillFilePath}`)
  }
}

// ─── Manual Trigger ───────────────────────────────────────────────────────────

/**
 * Manually trigger skill check (useful for testing or on-demand).
 */
export function triggerSkillCheck(): void {
  lastCheckTime = 0
}