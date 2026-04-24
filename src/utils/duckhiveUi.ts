import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { isEnvTruthy } from './envUtils.js'

export type DuckHiveUISurface = 'tui' | 'legacy'

export type DuckHiveConfig = Record<string, unknown> & {
  ui?: {
    defaultSurface?: string
  }
}

export const DEFAULT_DUCKHIVE_UI_SURFACE: DuckHiveUISurface = 'legacy'

export const DUCKHIVE_UI_SURFACE_LABELS: Record<DuckHiveUISurface, string> = {
  tui: 'Go TUI',
  legacy: 'Classic REPL',
}

const UI_SURFACE_ALIASES: Record<string, DuckHiveUISurface> = {
  tui: 'tui',
  go: 'tui',
  bubbletea: 'tui',
  legacy: 'legacy',
  repl: 'legacy',
  classic: 'legacy',
  ink: 'legacy',
}

export function normalizeDuckHiveUISurface(
  value?: string | null,
): DuckHiveUISurface | undefined {
  if (!value) return undefined
  return UI_SURFACE_ALIASES[value.trim().toLowerCase()]
}

export function getDuckHiveConfigDir(homeDir = homedir()): string {
  return join(homeDir, '.duckhive')
}

export function getDuckHiveConfigPath(homeDir = homedir()): string {
  return join(getDuckHiveConfigDir(homeDir), 'config.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function readDuckHiveConfigSync(
  configPath = getDuckHiveConfigPath(),
): DuckHiveConfig {
  try {
    const raw = readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? (parsed as DuckHiveConfig) : {}
  } catch {
    return {}
  }
}

export function getConfiguredDuckHiveUISurface(
  config: DuckHiveConfig | null | undefined,
): DuckHiveUISurface {
  return (
    normalizeDuckHiveUISurface(config?.ui?.defaultSurface) ??
    DEFAULT_DUCKHIVE_UI_SURFACE
  )
}

export function getPreferredDuckHiveUISurface(
  env: NodeJS.ProcessEnv = process.env,
  config: DuckHiveConfig = readDuckHiveConfigSync(),
): DuckHiveUISurface {
  const envSurface = normalizeDuckHiveUISurface(env.DUCKHIVE_DEFAULT_UI_SURFACE)
  if (envSurface) {
    return envSurface
  }

  if (isEnvTruthy(env.DUCKHIVE_NO_AUTO_TUI)) {
    return 'legacy'
  }

  return getConfiguredDuckHiveUISurface(config)
}

export function setDuckHiveUISurfacePreferenceSync(
  surface: DuckHiveUISurface,
  configPath = getDuckHiveConfigPath(),
): DuckHiveConfig {
  const current = readDuckHiveConfigSync(configPath)
  const nextUI = isRecord(current.ui) ? current.ui : {}
  const nextConfig: DuckHiveConfig = {
    ...current,
    ui: {
      ...nextUI,
      defaultSurface: surface,
    },
  }

  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
  return nextConfig
}
