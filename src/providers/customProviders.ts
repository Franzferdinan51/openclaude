/**
 * Custom Providers — DuckHive OpenAI-Compatible Endpoint Management
 *
 * Allows adding any OpenAI-compatible API endpoint as a provider with no code changes.
 * Config is stored in ~/.duckhive/custom-providers.json
 *
 * Config format:
 *   { baseUrl: string, apiKey: string, model: string, name: string }
 *
 * Auto-detects: if baseUrl contains 'openai-compatible' label, registers as generic.
 *
 * Health check: pings /models on startup to verify endpoint is reachable.
 */

import { existsSync } from 'fs'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { safeParseJSON } from '../utils/json.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomProviderConfig {
  /** Display name for the provider */
  name: string
  /** Base URL of the OpenAI-compatible API (e.g. https://api.example.com/v1) */
  baseUrl: string
  /** API key for authentication */
  apiKey: string
  /** Model name to use (e.g. mistral-7b, gpt-4) */
  model: string
  /** Whether this provider has been health-checked */
  healthy?: boolean
  /** Auto-detected: treat as generic OpenAI-compatible */
  isGeneric?: boolean
}

export interface CustomProvidersState {
  providers: CustomProviderConfig[]
  version: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CUSTOM_PROVIDERS_FILE = join(process.env.HOME ?? '~', '.duckhive', 'custom-providers.json')
const GENERIC_LABEL = 'openai-compatible'
const HEALTH_CHECK_TIMEOUT_MS = 8000

// ---------------------------------------------------------------------------
// Core I/O
// ---------------------------------------------------------------------------

function ensureDir(): void {
  const dir = join(process.env.HOME ?? '~', '.duckhive')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function loadState(): CustomProvidersState {
  try {
    if (!existsSync(CUSTOM_PROVIDERS_FILE)) {
      return { providers: [], version: 1 }
    }
    const raw = readFileSync(CUSTOM_PROVIDERS_FILE, 'utf-8')
    const parsed = safeParseJSON(raw) as CustomProvidersState | null
    if (!parsed || !Array.isArray(parsed.providers)) {
      return { providers: [], version: 1 }
    }
    return parsed as CustomProvidersState
  } catch {
    return { providers: [], version: 1 }
  }
}

function saveState(state: CustomProvidersState): void {
  ensureDir()
  writeFileSync(CUSTOM_PROVIDERS_FILE, JSON.stringify(state, null, 2), 'utf-8')
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Ping the /models endpoint to verify the provider is reachable.
 * Returns true if the endpoint responds with 200/401/403 (reachable, even if auth fails).
 * Returns false on network error, timeout, or non-reachable status.
 */
async function healthCheck(config: CustomProviderConfig): Promise<boolean> {
  const url = config.baseUrl.replace(/\/$/, '') + '/models'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    // Any response means the server is reachable (auth failures are still "healthy")
    return response.status < 500
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a new custom OpenAI-compatible provider.
 * Runs a health check on the endpoint before storing.
 * Auto-detects generic OpenAI-compatible endpoints via baseUrl label.
 *
 * Returns the provider config with health status, or throws on error.
 */
export async function addCustomProvider(config: Omit<CustomProviderConfig, 'healthy' | 'isGeneric'>): Promise<CustomProviderConfig> {
  // Detect generic label in baseUrl
  const isGeneric = config.baseUrl.toLowerCase().includes(GENERIC_LABEL)

  // Run health check concurrently
  const [healthy] = await Promise.all([healthCheck(config)])

  const provider: CustomProviderConfig = {
    ...config,
    healthy,
    isGeneric,
  }

  const state = loadState()

  // Prevent duplicate names
  if (state.providers.some(p => p.name === provider.name)) {
    throw new Error(`Custom provider "${provider.name}" already exists`)
  }

  state.providers.push(provider)
  saveState(state)

  return provider
}

/**
 * List all registered custom providers.
 */
export function listCustomProviders(): CustomProviderConfig[] {
  return loadState().providers
}

/**
 * Remove a custom provider by name.
 * Returns true if removed, false if not found.
 */
export function removeCustomProvider(name: string): boolean {
  const state = loadState()
  const idx = state.providers.findIndex(p => p.name === name)
  if (idx === -1) return false
  state.providers.splice(idx, 1)
  saveState(state)
  return true
}

/**
 * Get a single custom provider by name.
 */
export function getCustomProvider(name: string): CustomProviderConfig | undefined {
  return loadState().providers.find(p => p.name === name)
}

/**
 * Re-run health checks for all providers.
 * Updates the stored state with fresh health status.
 * Returns the updated list.
 */
export async function refreshHealthChecks(): Promise<CustomProviderConfig[]> {
  const state = loadState()
  const results = await Promise.all(
    state.providers.map(async (p) => ({
      ...p,
      healthy: await healthCheck(p),
    })),
  )
  state.providers = results
  saveState(state)
  return results
}

/**
 * Convert a custom provider config into a ModelInfo entry for the multi-model router.
 * This is the integration point — call this to extend MODEL_CATALOG.
 */
export function customProviderToModelInfo(config: CustomProviderConfig) {
  return {
    provider: config.name.toLowerCase().replace(/\s+/g, '-'),
    model: config.model,
    contextWindow: 128000, // assume standard 128K context for custom endpoints
    costPer1MInput: 0,      // unknown — mark as free/local
    costPer1MOutput: 0,
    speed: 'medium' as const,
    strengths: config.isGeneric ? ['generic', 'openai-compatible'] : ['custom'],
    vision: false,         // custom endpoints may or may not support vision
    functionCalling: false, // custom endpoints may or may not support function calling
  }
}

/**
 * Load all custom providers as ModelInfo entries for router integration.
 */
export function getCustomProviderModels() {
  return listCustomProviders()
    .filter(p => p.healthy !== false) // exclude known-unhealthy
    .map(customProviderToModelInfo)
}

// ---------------------------------------------------------------------------
// Startup Loader
// ---------------------------------------------------------------------------

let loaded = false

/**
 * Load custom providers at startup and log health status.
 * Safe to call multiple times — only runs once.
 */
export async function loadCustomProviders(): Promise<CustomProviderConfig[]> {
  if (loaded) return listCustomProviders()
  loaded = true

  const providers = await refreshHealthChecks()
  const healthy = providers.filter(p => p.healthy)
  const unhealthy = providers.filter(p => !p.healthy)

  if (healthy.length > 0) {
    console.log(`[customProviders] Loaded ${healthy.length} custom provider(s): ${healthy.map(p => p.name).join(', ')}`)
  }
  if (unhealthy.length > 0) {
    console.warn(`[customProviders] ${unhealthy.length} custom provider(s) unhealthy (will be skipped): ${unhealthy.map(p => p.name).join(', ')}`)
  }

  return providers
}
