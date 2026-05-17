import type { LocalCommandCall } from '../../types/command.js'
import { SkillWorkshopTool } from '../../tools/SkillWorkshopTool/SkillWorkshopTool.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'
import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js'
import {
  checkAndCreateSkills,
  type SkillCaptureSummary,
  triggerSkillCheck,
} from '../../services/autonomousSkillCreation.js'
import {
  inspectClawHubSkill,
  installClawHubSkill,
  searchClawHubSkills,
} from '../../services/clawhub/skillHub.js'

type SkillWorkshopResult = {
  success: boolean
  action: string
  skill?: string
  skills?: string[]
  path?: string
  content?: string
  error?: string
}

type SkillDeps = {
  runSkillWorkshop: typeof SkillWorkshopTool.call
  searchClawHubSkills: typeof searchClawHubSkills
  inspectClawHubSkill: typeof inspectClawHubSkill
  installClawHubSkill: typeof installClawHubSkill
  runAutoCapture: (
    context: Parameters<LocalCommandCall>[1],
  ) => Promise<SkillCaptureSummary>
}

let skillTestDeps: Partial<SkillDeps> | null = null

function getSkillDeps(): SkillDeps {
  return {
    runSkillWorkshop: SkillWorkshopTool.call,
    searchClawHubSkills,
    inspectClawHubSkill,
    installClawHubSkill,
    runAutoCapture,
    ...skillTestDeps,
  }
}

export function setSkillTestDeps(overrides: Partial<SkillDeps> | null): void {
  skillTestDeps = overrides
}

function splitCommandArgs(args: string): { args: string[]; error?: string } {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let tokenStarted = false

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!

    if (quote) {
      if (ch === quote) {
        quote = null
        continue
      }
      if (ch === '\\' && i + 1 < args.length) {
        const next = args[i + 1]!
        if (next === quote || next === '\\') {
          current += next
          i += 1
          continue
        }
      }
      current += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      tokenStarted = true
      continue
    }

    if (/\s/.test(ch)) {
      if (tokenStarted) {
        tokens.push(current)
        current = ''
        tokenStarted = false
      }
      continue
    }

    current += ch
    tokenStarted = true
  }

  if (quote) {
    return { args: tokens, error: 'Unterminated quoted string in /skill arguments.' }
  }

  if (tokenStarted) tokens.push(current)
  return { args: tokens }
}

function usage(error?: string): string {
  const lines = [
    'Skill Workshop',
    '',
    'Terminal usage:',
    '  duckhive skill <name>',
    '  duckhive skill create <name>',
    '  duckhive skill search <query>',
    '  duckhive skill inspect <slug>',
    '  duckhive skill install <slug>',
    '  duckhive skill capture',
    '  duckhive skills',
    '  duckhive skill read <name>',
    '  duckhive skill delete <name>',
    '',
    'REPL usage:',
    '  /skill <name>',
    '  /skill create <name>',
    '  /skill search <query>',
    '  /skill inspect <slug>',
    '  /skill install <slug>',
    '  /skill capture',
    '  /skill list',
    '  /skill read <name>',
    '  /skill delete <name>',
    '',
    'Terminal examples:',
    '  duckhive skill "release readiness"',
    '  duckhive skill search "calendar"',
    '  duckhive skill inspect calendar',
    '  duckhive skill install calendar',
    '',
    'REPL examples:',
    '  /skill "release readiness"',
    '  /skill create api-rollout-checklist',
    '  /skill search "calendar"',
    '  /skill inspect calendar',
    '  /skill install calendar',
    '  /skill capture',
    '  /skill read release-readiness',
    '  /skill delete old-skill',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

function createSkillTemplate(name: string): string {
  return `## Description

Explain what this skill does and when to use it.

## Steps

1. Capture the repeatable workflow this skill should enforce.
2. Add the exact commands, files, or checks that make the workflow reliable.
3. Update the examples once the workflow is proven in real use.

## Examples

- Replace this line with a real example invocation for ${name}.
`
}

async function runWorkshop(
  input: Parameters<typeof SkillWorkshopTool.call>[0],
): Promise<SkillWorkshopResult> {
  const result = await getSkillDeps().runSkillWorkshop(
    input,
    {} as never,
    undefined as never,
    undefined as never,
  )
  return result.data as unknown as SkillWorkshopResult
}

function toHookContext(
  context: Parameters<LocalCommandCall>[1],
): REPLHookContext {
  return {
    messages: context.messages ?? [],
    systemPrompt: context.renderedSystemPrompt ?? asSystemPrompt([]),
    userContext: {},
    systemContext: {},
    toolUseContext: context,
    querySource: context.options.querySource,
  }
}

async function runAutoCapture(
  context: Parameters<LocalCommandCall>[1],
): Promise<SkillCaptureSummary> {
  triggerSkillCheck()
  return checkAndCreateSkills(toHookContext(context), { force: true })
}

function renderAutoCaptureSummary(summary: SkillCaptureSummary): string {
  const lines = [
    'Skill auto-capture scan complete',
    '-'.repeat(40),
    `Topics scanned: ${summary.topicsScanned}`,
    `Eligible repeated topics: ${summary.eligibleTopics.length}`,
    `Created: ${summary.created.length}`,
    `Already installed: ${summary.skippedExisting.length}`,
    `Errors: ${summary.errors.length}`,
  ]

  if (summary.throttled) {
    lines.push('', 'Scan was skipped by the cooldown gate.')
  }
  if (summary.created.length > 0) {
    lines.push('', 'Created skills:')
    lines.push(
      ...summary.created.map(item => `- ${item.slug} (${item.count} memories)`),
    )
  }
  if (summary.skippedExisting.length > 0) {
    lines.push('', 'Existing skills:')
    lines.push(...summary.skippedExisting.map(item => `- ${item.slug}`))
  }
  if (summary.errors.length > 0) {
    lines.push('', 'Errors:')
    lines.push(...summary.errors.map(item => `- ${item.slug}: ${item.error}`))
  }
  if (
    !summary.throttled &&
    summary.eligibleTopics.length === 0
  ) {
    lines.push('', 'No memory topic has reached the 3-session capture threshold yet.')
  }

  return lines.join('\n')
}

function renderSkillList(skills: string[]): string {
  if (skills.length === 0) {
    return 'Skill Workshop\n\nNo saved skills yet. Create one with `duckhive skill <name>` or `/skill <name>`.'
  }

  return `Skill Workshop\n\nSaved skills:\n${skills.map(skill => `- ${skill}`).join('\n')}`
}

function renderClawHubSearchResults(
  query: string,
  results: Awaited<ReturnType<typeof searchClawHubSkills>>,
): string {
  if (results.length === 0) {
    return `ClawHub\n\nNo skills found for: ${query}`
  }

  return [
    `ClawHub search: ${query}`,
    '',
    ...results.map(result =>
      [
        `- ${result.slug} (${result.displayName})`,
        result.ownerHandle ? `  owner: ${result.ownerHandle}` : undefined,
        result.summary ? `  ${result.summary}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n')
}

function renderClawHubSkillDetail(
  detail: Awaited<ReturnType<typeof inspectClawHubSkill>>,
): string {
  const lines = [
    `ClawHub skill: ${detail.slug}`,
    '-'.repeat(40),
    `Name: ${detail.displayName}`,
  ]
  if (detail.ownerHandle) {
    lines.push(
      `Owner: ${detail.ownerHandle}${detail.ownerDisplayName ? ` (${detail.ownerDisplayName})` : ''}`,
    )
  }
  if (detail.latestVersion) lines.push(`Latest version: ${detail.latestVersion}`)
  if (detail.summary) lines.push(`Summary: ${detail.summary}`)
  if (detail.moderation) {
    const moderation = detail.moderation
    const status =
      moderation.verdict ??
      (moderation.isMalwareBlocked
        ? 'blocked'
        : moderation.isSuspicious
          ? 'suspicious'
          : 'unknown')
    lines.push(`Moderation: ${status}`)
    if (moderation.isMalwareBlocked) lines.push('Blocked: yes')
    if (moderation.summary) {
      lines.push(`Moderation summary: ${moderation.summary}`)
    }
    if (moderation.reasonCodes?.length) {
      lines.push(`Reason codes: ${moderation.reasonCodes.join(', ')}`)
    }
  }
  if (detail.changelog) {
    lines.push('Changelog:')
    lines.push(detail.changelog)
  }
  return lines.join('\n')
}

export const call: LocalCommandCall = async (args: string, context) => {
  const parsed = splitCommandArgs(args)
  if (parsed.error) {
    return { type: 'text', value: usage(parsed.error) }
  }
  const tokens = parsed.args
  const subcommand = tokens[0]?.toLowerCase()

  if (!subcommand) {
    return { type: 'text', value: usage() }
  }

  if (subcommand === '--capture' || subcommand === 'capture') {
    const summary = await getSkillDeps().runAutoCapture(context)
    return { type: 'text', value: renderAutoCaptureSummary(summary) }
  }

  if (subcommand === 'search') {
    const query = tokens.slice(1).join(' ').trim()
    if (!query) {
      return { type: 'text', value: usage('search requires a query.') }
    }
    const results = await getSkillDeps().searchClawHubSkills(query)
    return { type: 'text', value: renderClawHubSearchResults(query, results) }
  }

  if (subcommand === 'inspect') {
    const slug = tokens[1]?.trim()
    if (!slug || tokens.length > 2) {
      return { type: 'text', value: usage('inspect requires exactly one skill slug.') }
    }
    try {
      const detail = await getSkillDeps().inspectClawHubSkill(slug)
      return { type: 'text', value: renderClawHubSkillDetail(detail) }
    } catch (error) {
      return {
        type: 'text',
        value: `Failed to inspect ClawHub skill: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  if (subcommand === 'install') {
    const slug = tokens[1]?.trim()
    if (!slug || tokens.length > 2) {
      return { type: 'text', value: usage('install requires exactly one skill slug.') }
    }
    try {
      const result = await getSkillDeps().installClawHubSkill(slug)
      return {
        type: 'text',
        value: [
          'ClawHub install complete',
          '-'.repeat(40),
          `Skill: ${slug}`,
          `Version: ${result.version ?? 'latest'}`,
          `Path: ${result.skillPath}`,
        ].join('\n'),
      }
    } catch (error) {
      return {
        type: 'text',
        value: `Failed to install ClawHub skill: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  if (subcommand === 'list') {
    if (tokens.length > 1) {
      return { type: 'text', value: usage('list does not accept extra arguments.') }
    }
    const result = await runWorkshop({ action: 'list' })
    if (!result.success) {
      return { type: 'text', value: `Failed to list skills: ${result.error ?? 'unknown error'}` }
    }
    return { type: 'text', value: renderSkillList(result.skills ?? []) }
  }

  if (subcommand === 'read') {
    const name = tokens.slice(1).join(' ').trim()
    if (!name) {
      return { type: 'text', value: usage('read requires a skill name.') }
    }
    const result = await runWorkshop({ action: 'read', skillName: name })
    if (!result.success) {
      return { type: 'text', value: `Failed to read skill: ${result.error ?? name}` }
    }
    return {
      type: 'text',
      value: `Skill: ${name}\n${'-'.repeat(40)}\n${result.content ?? ''}`.trim(),
    }
  }

  if (subcommand === 'delete') {
    const name = tokens.slice(1).join(' ').trim()
    if (!name) {
      return { type: 'text', value: usage('delete requires a skill name.') }
    }
    const result = await runWorkshop({ action: 'delete', skillName: name })
    if (!result.success) {
      return { type: 'text', value: `Failed to delete skill: ${result.error ?? name}` }
    }
    return { type: 'text', value: `Skill deleted: ${name}` }
  }

  const isExplicitCreate = subcommand === 'create'
  const name = (isExplicitCreate ? tokens.slice(1) : tokens).join(' ').trim()
  if (!name) {
    return { type: 'text', value: usage('create requires a skill name.') }
  }

  const result = await runWorkshop({
    action: 'create',
    skillName: name,
    title: name,
    reason: 'Created from the /skill command',
    body: createSkillTemplate(name),
  })

  if (!result.success) {
    return { type: 'text', value: `Failed to create skill: ${result.error ?? name}` }
  }

  return {
    type: 'text',
    value: `Skill created\n${'-'.repeat(40)}\nName: ${name}\nPath: ${result.path ?? 'unknown'}`,
  }
}
