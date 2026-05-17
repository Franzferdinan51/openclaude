import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

import { isInGlobalClaudeFolder } from '../components/permissions/FilePermissionDialog/permissionOptions.tsx'
import { optionForPermissionSaveDestination } from '../components/permissions/rules/AddPermissionRules.tsx'
import {
  getClaudeSkillScope,
  isClaudeSettingsPath,
} from './permissions/filesystem.ts'
import { getValidationTip } from './settings/validationTips.ts'
import loginCommandFactory from '../commands/login/index.ts'
import logoutCommand from '../commands/logout/index.ts'

const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
const repoRoot = join(import.meta.dir, '..', '..')

beforeEach(async () => {
  await acquireSharedMutationLock('DuckHiveUiSurfaces.test.ts')
})

afterEach(() => {
  try {
    if (originalConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalConfigDir
    }
  } finally {
    releaseSharedMutationLock()
  }
})

describe('DuckHive settings path surfaces', () => {
  test('isClaudeSettingsPath recognizes project .duckhive settings files', () => {
    expect(
      isClaudeSettingsPath(
        join(process.cwd(), '.duckhive', 'settings.json'),
      ),
    ).toBe(true)

    expect(
      isClaudeSettingsPath(
        join(process.cwd(), '.duckhive', 'settings.local.json'),
      ),
    ).toBe(true)
  })

  test('permission save destinations point user settings to ~/.duckhive', () => {
    expect(optionForPermissionSaveDestination('userSettings')).toEqual({
      label: 'User settings',
      description: 'Saved in ~/.duckhive/settings.json',
      value: 'userSettings',
    })
  })

  test('permission save destinations point project settings to .duckhive', () => {
    expect(optionForPermissionSaveDestination('projectSettings')).toEqual({
      label: 'Project settings',
      description: 'Checked in at .duckhive/settings.json',
      value: 'projectSettings',
    })

    expect(optionForPermissionSaveDestination('localSettings')).toEqual({
      label: 'Project settings (local)',
      description: 'Saved in .duckhive/settings.local.json',
      value: 'localSettings',
    })
  })

  test('permission dialog treats ~/.duckhive as the global Claude folder', () => {
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.duckhive')

    expect(
      isInGlobalClaudeFolder(
        join(homedir(), '.duckhive', 'settings.json'),
      ),
    ).toBe(true)
    expect(
      isInGlobalClaudeFolder(join(homedir(), '.claude', 'settings.json')),
    ).toBe(true)
  })

  test('permission dialog does not treat arbitrary CLAUDE_CONFIG_DIR as the global Claude folder', () => {
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), 'custom-DuckHive')

    expect(
      isInGlobalClaudeFolder(
        join(homedir(), 'custom-DuckHive', 'settings.json'),
      ),
    ).toBe(false)
  })

  test('global skill scope recognizes ~/.duckhive and legacy ~/.claude skills', () => {
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.duckhive')

    expect(
      getClaudeSkillScope(
        join(homedir(), '.duckhive', 'skills', 'demo', 'SKILL.md'),
      ),
    ).toEqual({
      skillName: 'demo',
      pattern: '~/.duckhive/skills/demo/**',
    })

    expect(
      getClaudeSkillScope(
        join(homedir(), '.claude', 'skills', 'legacy', 'SKILL.md'),
      ),
    ).toEqual({
      skillName: 'legacy',
      pattern: '~/.claude/skills/legacy/**',
    })
  })

  test('global skill scope does not emit fixed rules for arbitrary CLAUDE_CONFIG_DIR skills', () => {
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), 'custom-DuckHive')

    expect(
      getClaudeSkillScope(
        join(homedir(), 'custom-DuckHive', 'skills', 'demo', 'SKILL.md'),
      ),
    ).toBe(null)
  })
})

describe('DuckHive validation tips', () => {
  test('permissions.defaultMode invalid value keeps suggestion but no Claude docs link', () => {
    const tip = getValidationTip({
      path: 'permissions.defaultMode',
      code: 'invalid_value',
      enumValues: [
        'acceptEdits',
        'bypassPermissions',
        'default',
        'dontAsk',
        'plan',
      ],
    })

    expect(tip).toEqual({
      suggestion:
        'Valid modes: "acceptEdits" (ask before file changes), "plan" (analysis only), "bypassPermissions" (auto-accept all), or "default" (standard behavior)',
    })
  })
})

describe('DuckHive CLI help surfaces', () => {
  test('top-level help strings advertise MiniMax and DuckHive-compatible auth', () => {
    const source = readFileSync(join(repoRoot, 'src', 'main.tsx'), 'utf8')

    expect(source).toContain(
      'AI provider to use (minimax, openai, anthropic, gemini, github, bedrock, vertex, ollama)',
    )
    expect(source).toContain("e.g. 'MiniMax-M2.7' or 'gpt-5.2'")
    expect(source).toContain(
      'Set up a long-lived subscription authentication token for compatible hosted accounts',
    )
    expect(source).toContain('Sign in to a DuckHive-compatible hosted account')
    expect(source).toContain('Log out from your hosted auth account')
    expect(source).toContain(
      'use provider environment variables or apiKeyHelper via --settings',
    )
    expect(source).not.toContain('requires Claude subscription')
    expect(source).not.toContain('Anthropic auth is strictly')
    expect(source).not.toContain('Sign in to your Anthropic account')
    expect(source).not.toContain('Log out from your Anthropic account')
  })
})

describe('DuckHive slash auth surfaces', () => {
  test('/login and /logout descriptions avoid Anthropic-only wording', () => {
    expect(loginCommandFactory().description).toBe(
      'Sign in with a DuckHive-compatible hosted account',
    )
    expect(logoutCommand.description).toBe('Sign out from your hosted auth account')
  })
})
