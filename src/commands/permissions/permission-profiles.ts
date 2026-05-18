import type { AppState } from '../../state/AppState.js'
import type { ExternalPermissionMode } from '../../types/permissions.js'
import { transitionPermissionMode } from '../../utils/permissions/permissionSetup.js'
import type { EditableSettingSource } from '../../utils/settings/constants.js'
import type { SettingsJson } from '../../utils/settings/types.js'

export type PermissionProfileName =
  | 'safe'
  | 'balanced'
  | 'edit'
  | 'yolo'
  | 'off'

type PermissionProfile = {
  name: PermissionProfileName
  title: string
  summary: string
  mode: ExternalPermissionMode
  sandbox: NonNullable<SettingsJson['sandbox']>
  allowBypass?: boolean
  yoloMode?: boolean
}

export const PERMISSION_PROFILES: Record<
  PermissionProfileName,
  PermissionProfile
> = {
  safe: {
    name: 'safe',
    title: 'Safe planning',
    summary:
      'Plan-first approvals, sandbox enabled, no auto-allow bash, no unsandboxed fallback.',
    mode: 'plan',
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: false,
      allowUnsandboxedCommands: false,
    },
  },
  balanced: {
    name: 'balanced',
    title: 'Balanced harness',
    summary:
      'Normal prompts, sandbox enabled, sandboxed bash can auto-allow when supported.',
    mode: 'default',
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: true,
    },
  },
  edit: {
    name: 'edit',
    title: 'Edit-friendly',
    summary:
      'Auto-accept edits, sandbox enabled, bash still asks unless rules allow it.',
    mode: 'acceptEdits',
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: false,
      allowUnsandboxedCommands: true,
    },
  },
  yolo: {
    name: 'yolo',
    title: 'Yolo bypass',
    summary:
      'Bypass permissions for trusted sandboxes; disables OS sandbox settings.',
    mode: 'bypassPermissions',
    allowBypass: true,
    yoloMode: true,
    sandbox: {
      enabled: false,
      autoAllowBashIfSandboxed: false,
      allowUnsandboxedCommands: true,
    },
  },
  off: {
    name: 'off',
    title: 'Classic prompts',
    summary: 'Normal permission prompts with sandbox disabled.',
    mode: 'default',
    yoloMode: false,
    sandbox: {
      enabled: false,
      autoAllowBashIfSandboxed: false,
      allowUnsandboxedCommands: true,
    },
  },
}

export type ParsedPermissionProfileCommand =
  | { action: 'help' | 'list' | 'status' }
  | {
      action: 'apply'
      profile: PermissionProfileName
      source: EditableSettingSource
    }
  | { action: 'error'; message: string }

export function parsePermissionProfileCommand(
  args: string | undefined,
): ParsedPermissionProfileCommand | null {
  const tokens = (args ?? '').trim().split(/\s+/).filter(Boolean)
  if (tokens[0] !== 'profile' && tokens[0] !== 'profiles') {
    return null
  }

  const rest = tokens.slice(1)
  const subcommand = rest[0]
  if (!subcommand || subcommand === 'help' || subcommand === '--help') {
    return { action: 'help' }
  }
  if (subcommand === 'list' || subcommand === 'ls') {
    return { action: 'list' }
  }
  if (subcommand === 'status') {
    return { action: 'status' }
  }

  const profile = normalizePermissionProfileName(subcommand)
  if (!profile) {
    return {
      action: 'error',
      message: `Unknown permission profile: ${subcommand}. Use /permissions profile list.`,
    }
  }

  let source: EditableSettingSource = 'localSettings'
  for (const token of rest.slice(1)) {
    switch (token) {
      case '--local':
        source = 'localSettings'
        break
      case '--project':
        source = 'projectSettings'
        break
      case '--user':
        source = 'userSettings'
        break
      default:
        return {
          action: 'error',
          message: `Unknown permission profile option: ${token}. Use --local, --project, or --user.`,
        }
    }
  }

  return { action: 'apply', profile, source }
}

export function buildPermissionProfileSettings(
  profileName: PermissionProfileName,
): SettingsJson {
  const profile = PERMISSION_PROFILES[profileName]
  return {
    permissions: {
      defaultMode: profile.mode,
      allowBypassPermissionsMode: profile.allowBypass,
      yoloMode: profile.yoloMode,
    },
    sandbox: profile.sandbox,
  }
}

export function applyPermissionProfileToAppState(
  prev: AppState,
  profileName: PermissionProfileName,
): AppState {
  const profile = PERMISSION_PROFILES[profileName]
  const transitionedContext = transitionPermissionMode(
    prev.toolPermissionContext.mode,
    profile.mode,
    prev.toolPermissionContext,
  )

  return {
    ...prev,
    yoloMode: profile.yoloMode ?? false,
    toolPermissionContext: {
      ...transitionedContext,
      mode: profile.mode,
      isBypassPermissionsModeAvailable:
        profile.allowBypass === true ||
        prev.toolPermissionContext.isBypassPermissionsModeAvailable,
    },
  }
}

export function renderPermissionProfileHelp(): string {
  return [
    'Permission profiles',
    '',
    'Usage:',
    '  /permissions profile list',
    '  /permissions profile status',
    '  /permissions profile <safe|balanced|edit|yolo|off> [--local|--project|--user]',
    '',
    'Default destination is --local, so profiles stay project-local unless you choose --user.',
    'Profiles set permissions.defaultMode plus matching sandbox settings.',
  ].join('\n')
}

export function renderPermissionProfileList(): string {
  const lines = ['Permission profiles', '']
  for (const profile of Object.values(PERMISSION_PROFILES)) {
    lines.push(
      `- ${profile.name}: ${profile.title} - ${profile.summary}`,
      `  mode=${profile.mode}; sandbox=${formatSandboxSummary(profile.sandbox)}`,
    )
  }
  return lines.join('\n')
}

export function renderPermissionProfileStatus(settings: SettingsJson): string {
  const permissions = settings.permissions ?? {}
  return [
    'Permission profile status',
    `- defaultMode: ${permissions.defaultMode ?? 'default'}`,
    `- yoloMode: ${permissions.yoloMode === true ? 'on' : 'off'}`,
    `- allowBypassPermissionsMode: ${permissions.allowBypassPermissionsMode === true ? 'on' : 'off'}`,
    `- sandbox: ${formatSandboxSummary(settings.sandbox ?? {})}`,
  ].join('\n')
}

export function renderPermissionProfileApplied(
  profileName: PermissionProfileName,
  source: EditableSettingSource,
): string {
  const profile = PERMISSION_PROFILES[profileName]
  return [
    `Applied permission profile "${profile.name}" to ${formatSettingSource(source)}.`,
    `Mode: ${profile.mode}`,
    `Sandbox: ${formatSandboxSummary(profile.sandbox)}`,
    'Note: sandbox enforcement still depends on platform support and installed sandbox dependencies.',
  ].join('\n')
}

function normalizePermissionProfileName(
  value: string,
): PermissionProfileName | null {
  if (value === 'strict') return 'safe'
  if (value === 'default') return 'balanced'
  if (value === 'classic') return 'off'
  return value in PERMISSION_PROFILES
    ? (value as PermissionProfileName)
    : null
}

function formatSandboxSummary(sandbox: NonNullable<SettingsJson['sandbox']>) {
  const enabled = sandbox.enabled === true ? 'enabled' : 'disabled'
  const autoAllow =
    sandbox.autoAllowBashIfSandboxed === true ? 'auto-allow bash on' : 'auto-allow bash off'
  const fallback =
    sandbox.allowUnsandboxedCommands === false
      ? 'unsandboxed fallback off'
      : 'unsandboxed fallback on'
  return `${enabled}, ${autoAllow}, ${fallback}`
}

function formatSettingSource(source: EditableSettingSource): string {
  switch (source) {
    case 'localSettings':
      return 'local settings'
    case 'projectSettings':
      return 'project settings'
    case 'userSettings':
      return 'user settings'
  }
}
