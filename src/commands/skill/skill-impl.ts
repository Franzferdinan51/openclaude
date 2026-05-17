import type { LocalCommandCall } from '../../types/command.js'
import { SkillWorkshopTool } from '../../tools/SkillWorkshopTool/SkillWorkshopTool.js'
import {
  inspectClawHubSkill,
  installClawHubSkill,
  searchClawHubSkills,
} from '../../services/clawhub/skillHub.js'

type SkillWorkshopResult = Awaited<
  ReturnType<typeof SkillWorkshopTool.call>
>['data']

type SkillDeps = {
  runSkillWorkshop: typeof SkillWorkshopTool.call
  searchClawHubSkills: typeof searchClawHubSkills
  inspectClawHubSkill: typeof inspectClawHubSkill
  installClawHubSkill: typeof installClawHubSkill
}

let skillTestDeps: Partial<SkillDeps> | null = null

function getSkillDeps(): SkillDeps {
  return {
    runSkillWorkshop: SkillWorkshopTool.call,
    searchClawHubSkills,
    inspectClawHubSkill,
    installClawHubSkill,
    ...skillTestDeps,
  }
}

export function setSkillTestDeps(overrides: Partial<SkillDeps> | null): void {
  skillTestDeps = overrides
}

function splitCommandArgs(args: string): string[] {
  return (
    args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg =>
      arg.replace(/^["']|["']$/g, ''),
    ) ?? []
  )
}

function usage(error?: string): string {
  const lines = [
    'Skill Workshop',
    '',
    'Usage:',
    '  /skill <name>',
    '  /skill create <name>',
    '  /skill search <query>',
    '  /skill inspect <slug>',
    '  /skill install <slug>',
    '  /skill list',
    '  /skill read <name>',
    '  /skill delete <name>',
    '',
    'Examples:',
    '  /skill "release readiness"',
    '  /skill create api-rollout-checklist',
    '  /skill search "calendar"',
    '  /skill inspect calendar',
    '  /skill install calendar',
    '  /skill read release-readiness',
    '  /skill delete old-skill',
    '',
    'Note: auto-capture mode is not wired as a standalone slash-command toggle yet.',
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
  return (await getSkillDeps().runSkillWorkshop(input, {} as never)).data
}

function renderSkillList(skills: string[]): string {
  if (skills.length === 0) {
    return 'Skill Workshop\n\nNo saved skills yet. Create one with `/skill <name>`.'
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
  if (detail.changelog) {
    lines.push('Changelog:')
    lines.push(detail.changelog)
  }
  return lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const tokens = splitCommandArgs(args)
  const subcommand = tokens[0]?.toLowerCase()

  if (!subcommand) {
    return { type: 'text', value: usage() }
  }

  if (subcommand === '--capture' || subcommand === 'capture') {
    return {
      type: 'text',
      value: usage(
        'Auto-capture is not exposed as a standalone `/skill --capture` toggle yet.',
      ),
    }
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
