import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

type JsonObject = Record<string, unknown>

type DuckHiveConfig = {
  meta: {
    enabled: boolean
    complexityThreshold: number
    models: Record<string, string>
    features: Record<string, boolean>
    limits: {
      maxConcurrent: number
      maxRetries: number
      timeoutMs: number
    }
  }
  providers: {
    default: string
    fallback: string
  }
  ui: {
    defaultSurface: string
  }
  search: {
    provider: string
    searxngUrl: string
  }
  _comment?: string
}

const CONFIG_DIR = join(homedir(), '.duckhive')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

const DEFAULT_CONFIG: DuckHiveConfig = {
  meta: {
    enabled: true,
    complexityThreshold: 4,
    models: {
      orchestrator: 'auto',
      fast: 'auto',
      standard: 'auto',
      complex: 'auto',
      android: 'auto',
      vision: 'auto',
      coding: 'auto',
    },
    features: {
      councilEnabled: true,
      fallbackEnabled: true,
      selfHealing: true,
      learning: true,
    },
    limits: {
      maxConcurrent: 3,
      maxRetries: 3,
      timeoutMs: 60000,
    },
  },
  providers: {
    default: 'minimax',
    fallback: 'openrouter',
  },
  ui: {
    defaultSurface: 'legacy',
  },
  search: {
    provider: 'auto',
    searxngUrl: '',
  },
  _comment: 'DuckHive configuration - https://github.com/Franzferdinan51/DuckHive',
}

function usage(): string {
  return [
    'DuckHive config',
    '',
    'Usage:',
    '  duckhive config show   Show the effective DuckHive configuration',
    '  duckhive config init   Create ~/.duckhive/config.json with defaults',
    '  duckhive config path   Print the config file path',
    '',
    'Aliases:',
    '  duckhive settings show',
    '',
    'The config controls provider defaults, UI surface, search provider, and meta-agent settings.',
  ].join('\n')
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge<T extends JsonObject>(target: T, source: JsonObject): T {
  const targetObject: JsonObject = target
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(targetObject[key])) {
      deepMerge(targetObject[key], value)
    } else {
      targetObject[key] = value
    }
  }
  return target
}

function cloneDefaultConfig(): DuckHiveConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as DuckHiveConfig
}

function loadConfig(): DuckHiveConfig {
  const base = cloneDefaultConfig()

  if (!existsSync(CONFIG_FILE)) {
    return base
  }

  try {
    const userConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as JsonObject
    return deepMerge(base as unknown as JsonObject, userConfig) as DuckHiveConfig
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`duckhive: warning - failed to load config from ${CONFIG_FILE}: ${message}\n`)
    return base
  }
}

function getConfigSummary(config: DuckHiveConfig): string {
  return [
    'Meta-Agent Configuration',
    `  Enabled: ${config.meta.enabled ? 'ON' : 'OFF'}  Threshold: ${config.meta.complexityThreshold}/10`,
    `  Features: council=${config.meta.features.councilEnabled} fallback=${config.meta.features.fallbackEnabled} heal=${config.meta.features.selfHealing} learn=${config.meta.features.learning}`,
    `  Models: orch=${config.meta.models.orchestrator} fast=${config.meta.models.fast} std=${config.meta.models.standard}`,
    `          complex=${config.meta.models.complex} android=${config.meta.models.android} vision=${config.meta.models.vision} coding=${config.meta.models.coding}`,
    `  Limits: concurrent=${config.meta.limits.maxConcurrent} retries=${config.meta.limits.maxRetries} timeout=${config.meta.limits.timeoutMs}ms`,
    '',
    'Providers',
    `  Default: ${config.providers.default}  Fallback: ${config.providers.fallback}`,
    '',
    'UI',
    `  Default: ${config.ui.defaultSurface}`,
    '',
    'Search',
    `  Provider: ${config.search.provider}`,
    config.search.searxngUrl ? `  SearXNG: ${config.search.searxngUrl}` : undefined,
  ].filter(Boolean).join('\n')
}

function writeDefaultConfig(): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, `${JSON.stringify(cloneDefaultConfig(), null, 2)}\n`)
}

function hasHelpFlag(args: readonly string[]): boolean {
  return args.includes('--help') || args.includes('-h')
}

export async function configHandler(args: readonly string[]): Promise<void> {
  const command = args[0]?.toLowerCase()

  if (hasHelpFlag(args) || command === 'help') {
    process.stdout.write(`${usage()}\n`)
    return
  }

  if (!command || command === 'show') {
    process.stdout.write(`\n${getConfigSummary(loadConfig())}\n\n`)
    return
  }

  if (command === 'path') {
    process.stdout.write(`${CONFIG_FILE}\n`)
    return
  }

  if (command === 'init') {
    writeDefaultConfig()
    process.stdout.write(
      `Created ${CONFIG_FILE}\n\nEdit this file to configure meta-agent models, features, and limits.\n`,
    )
    return
  }

  process.stderr.write(`${usage()}\n\nUnknown config command: ${args[0]}\n`)
  process.exitCode = 1
}
