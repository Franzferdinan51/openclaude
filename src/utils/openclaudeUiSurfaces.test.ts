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
import passesCommand from '../commands/passes/index.ts'

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
    expect(source).toContain('runtime-doctor')
    expect(source).toContain('doctor-runtime')
    expect(source).toContain('doctor:runtime')
    expect(source).toContain('runtime checks without starting the REPL')
    expect(source).toContain('terminal input is not usable')
    expect(source).toContain('terminal-safe checks without starting the chat UI')
    expect(source).not.toContain('Check the health of your ${PRODUCT_DISPLAY_NAME} auto-updater')
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
    expect(loginCommandFactory().description).toContain('DuckHive-compatible hosted')
    expect(logoutCommand.description).toBe('Sign out from your hosted auth account')
  })
})

describe('DuckHive remote auth surfaces', () => {
  test('remote and teleport prompts point users to DuckHive account wording', () => {
    const bridgeMain = readFileSync(join(repoRoot, 'src', 'bridge', 'bridgeMain.ts'), 'utf8')
    const bridgeApi = readFileSync(join(repoRoot, 'src', 'bridge', 'bridgeApi.ts'), 'utf8')
    const statusNotices = readFileSync(
      join(repoRoot, 'src', 'utils', 'statusNoticeDefinitions.tsx'),
      'utf8',
    )
    const resumeTask = readFileSync(join(repoRoot, 'src', 'components', 'ResumeTask.tsx'), 'utf8')
    const teleportError = readFileSync(join(repoRoot, 'src', 'components', 'TeleportError.tsx'), 'utf8')
    const githubOAuth = readFileSync(
      join(repoRoot, 'src', 'commands', 'install-github-app', 'OAuthFlowStep.tsx'),
      'utf8',
    )

    const combined = [
      bridgeMain,
      bridgeApi,
      statusNotices,
      resumeTask,
      teleportError,
      githubOAuth,
    ].join('\n')

    expect(combined).toContain('duckhive remote-control')
    expect(combined).toContain('hosted account auth')
    expect(combined).toContain('configured API billing key')
    expect(combined).toContain('Login with hosted account')
    expect(combined).toContain('Opening browser to sign in with your hosted account...')
    expect(combined).not.toContain('Run `claude remote-control')
    expect(combined).not.toContain("Run 'claude remote-control")
    expect(combined).not.toContain('Claude account with')
    expect(combined).not.toContain('Login with Claude account')
    expect(combined).not.toContain('Anthropic Console key')
  })
})

describe('DuckHive completion guidance surfaces', () => {
  test('shell completion recovery text uses the DuckHive command', () => {
    const source = readFileSync(join(repoRoot, 'src', 'utils', 'completionCache.ts'), 'utf8')

    expect(source).toContain('duckhive completion')
    expect(source).toContain('DuckHive shell completions')
    expect(source).not.toContain('Run manually: claude completion')
    expect(source).not.toContain('Claude Code shell completions')
  })
})

describe('DuckHive provider and GitHub setup surfaces', () => {
  test('provider recommendation and GitHub API key setup avoid upstream account wording', () => {
    const providerRecommend = readFileSync(join(repoRoot, 'scripts', 'provider-recommend.ts'), 'utf8')
    const apiKeyStep = readFileSync(
      join(repoRoot, 'src', 'commands', 'install-github-app', 'ApiKeyStep.tsx'),
      'utf8',
    )

    expect(providerRecommend).toContain('.duckhive-profile.json')
    expect(providerRecommend).not.toContain('Saved .openclaude-profile.json')
    expect(apiKeyStep).toContain('Use your existing DuckHive-compatible API key')
    expect(apiKeyStep).toContain('Create a long-lived token with your hosted account')
    expect(apiKeyStep).not.toContain('Use your existing Claude Code API key')
    expect(apiKeyStep).not.toContain('Create a long-lived token with your Claude subscription')
  })
})

describe('DuckHive active terminal UI copy', () => {
  test('visible startup and prompt-adjacent surfaces use DuckHive wording', () => {
    const passes = readFileSync(join(repoRoot, 'src', 'components', 'Passes', 'Passes.tsx'), 'utf8')
    const ideOnboarding = readFileSync(
      join(repoRoot, 'src', 'components', 'IdeOnboardingDialog.tsx'),
      'utf8',
    )
    const repl = readFileSync(join(repoRoot, 'src', 'screens', 'REPL.tsx'), 'utf8')
    const transcriptShare = readFileSync(
      join(repoRoot, 'src', 'components', 'FeedbackSurvey', 'TranscriptSharePrompt.tsx'),
      'utf8',
    )
    const thinkback = readFileSync(
      join(repoRoot, 'src', 'commands', 'thinkback', 'thinkback.tsx'),
      'utf8',
    )
    const externalIncludesDialog = readFileSync(
      join(repoRoot, 'src', 'components', 'ClaudeMdExternalIncludesDialog.tsx'),
      'utf8',
    )
    const combined = [
      passes,
      ideOnboarding,
      repl,
      transcriptShare,
      thinkback,
      externalIncludesDialog,
    ].join('\n')

    expect(passes).toContain(' ) DH ')
    expect(combined).toContain('Share a free week of DuckHive')
    expect(combined).toContain("Review DuckHive's changes")
    expect(combined).toContain('DuckHive is waiting for your input')
    expect(combined).toContain('help us improve DuckHive')
    expect(combined).toContain('Only use DuckHive with files you trust')
    expect(combined).toContain('Think Back on 2025 with DuckHive')
    expect(combined).toContain('DuckHive year in review animation')
    expect(combined).not.toContain('Share a free week of Claude Code')
    expect(combined).not.toContain("Review Claude Code's changes")
    expect(combined).not.toContain('Claude is waiting for your input')
    expect(combined).not.toContain('help us improve Claude Code')
    expect(combined).not.toContain('Only use Claude Code with files you trust')
    expect(combined).not.toContain('Think Back on 2025 with Claude Code')
    expect(combined).not.toContain('Claude Code year in review animation')
  })

  test('/passes command metadata uses DuckHive wording', () => {
    expect(passesCommand.description).toContain('Share a free week of DuckHive')
    expect(passesCommand.description).not.toContain('Claude Code')
  })
})
