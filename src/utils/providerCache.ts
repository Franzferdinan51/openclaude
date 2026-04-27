/**
 * providerCache.ts — Keepalive response cache for DuckHive LLM provider router
 *
 * Caches LLM responses keyed by model + message-hash (SHA-256).
 * Designed for the fallback/agent loop: call cacheGet() before every API request.
 * On hit → return cached response, skip the API call entirely.
 * On miss → call API, store result via cacheSet(), then return.
 *
 * Features:
 *   - LRU eviction at 1000 entries (configurable via PROVIDER_CACHE_MAX_ENTRIES)
 *   - TTL of 30 s per entry (configurable via PROVIDER_CACHE_TTL, in seconds)
 *   - In-memory only — never persists, cleared on process exit
 *   - Exposes CacheStats for observability
 *
 * Integration:
 *   import { cacheGet, cacheSet } from './utils/providerCache'
 *   const hit = cacheGet({ model, baseUrl, messages })
 *   if (hit) return hit
 *   const response = await callProvider(...)
 *   cacheSet({ model, baseUrl, messages }, response)
 */

import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_TTL_SECONDS = 30
const DEFAULT_MAX_ENTRIES = 1000

function getEnvInt(name: string, fallback: number): number {
  const val = process.env[name]
  if (!val) return fallback
  const parsed = Number.parseInt(val, 10)
  return Number.isNaN(parsed) ? fallback : Math.max(1, parsed)
}

/** Cache TTL in milliseconds */
export const CACHE_TTL_MS = getEnvInt('PROVIDER_CACHE_TTL', DEFAULT_TTL_SECONDS) * 1000

/** Maximum number of entries before LRU eviction */
export const CACHE_MAX_ENTRIES = getEnvInt('PROVIDER_CACHE_MAX_ENTRIES', DEFAULT_MAX_ENTRIES)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single chat message, matching the structure passed to LLM providers */
export interface CacheMessage {
  role: string
  content: string
}

/** Input required to build a cache key or store a response */
export interface CacheEntryInput {
  model: string
  baseUrl: string
  messages: CacheMessage[]
}

/** Cached API response — serialisable part of the provider result */
export interface CacheEntry {
  response: unknown
  expiresAt: number // Date.now() + TTL
}

// ---------------------------------------------------------------------------
// LRU Map
// ---------------------------------------------------------------------------

/**
 * A Map that maintains insertion/access order for LRU eviction.
 * - `touch(key)` moves a key to the end (most-recently-used)
 * - `evictIfFull()` removes the oldest entry when over capacity
 */
class LRUMap<K, V> {
  private readonly map = new Map<K, V>()

  get size(): number {
    return this.map.size
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.touch(key)
    return value
  }

  set(key: K, value: V): void {
    // If key already exists, delete it first so it moves to end
    if (this.map.has(key)) {
      this.map.delete(key)
    }
    this.map.set(key, value)
    this.evictIfFull()
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  /**
   * Move key to end of iteration order (most-recently-used).
   * Implemented by re-inserting so Map maintains insertion order.
   */
  touch(key: K): void {
    if (!this.map.has(key)) return
    const value = this.map.get(key)!
    this.map.delete(key)
    this.map.set(key, value)
  }

  /**
   * Remove the oldest (first) entry when over CACHE_MAX_ENTRIES.
   * Calls recordEviction() for each removed entry so the counter stays accurate.
   */
  evictIfFull(): void {
    while (this.map.size > CACHE_MAX_ENTRIES) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) {
        this.map.delete(oldest)
        recordEviction()
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cache state
// ---------------------------------------------------------------------------

/** Backing store — single instance per process */
const cache = new LRUMap<string, CacheEntry>()

/** Statistics counters — reset on cacheClear() */
let hits = 0
let misses = 0
let evictions = 0

/** Called by LRUMap.evictIfFull() whenever an entry is evicted */
function recordEviction(): void {
  evictions++
}

// ---------------------------------------------------------------------------
// Key construction
// ---------------------------------------------------------------------------

/**
 * Build a deterministic SHA-256 hash of the messages array.
 * The hash covers the full semantic content of the request so that
 * two identical request payloads produce the same cache key.
 */
function hashMessages(messages: CacheMessage[]): string {
  // Canonical JSON — sort keys to ensure stable ordering across serialisations
  const canonical = JSON.stringify(messages)
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

/**
 * Build a cache key from model, baseUrl, and a deterministic hash of messages.
 * Format: `model::baseUrl::messageHash`
 */
export function buildCacheKey(input: CacheEntryInput): string {
  const msgHash = hashMessages(input.messages)
  return `${input.model}::${input.baseUrl}::${msgHash}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a cached response for the given request.
 *
 * Returns the cached response if:
 *   - key exists in cache AND
 *   - entry has not expired (now < expiresAt)
 *
 * Returns undefined on cache miss or TTL expiry.
 *
 * Usage:
 *   const cached = cacheGet({ model, baseUrl, messages })
 *   if (cached) return cached
 */
export function cacheGet(input: CacheEntryInput): unknown | undefined {
  const key = buildCacheKey(input)
  const entry = cache.get(key)

  if (entry === undefined) {
    misses++
    return undefined
  }

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key)
    misses++
    return undefined
  }

  hits++
  return entry.response
}

/**
 * Store a response in the cache, keyed by the request input.
 * Any existing entry for the same key is replaced.
 *
 * Usage:
 *   const response = await callProvider(...)
 *   cacheSet({ model, baseUrl, messages }, response)
 */
export function cacheSet(input: CacheEntryInput, response: unknown): void {
  const key = buildCacheKey(input)
  const entry: CacheEntry = {
    response,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  cache.set(key, entry)
}

/**
 * Completely clear all cache entries and reset statistics.
 * Primarily useful for tests; also available as a runtime escape-hatch.
 */
export function cacheClear(): void {
  cache.clear()
  hits = 0
  misses = 0
  evictions = 0
}

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

export interface CacheStats {
  /** Current number of entries in the cache */
  size: number
  /** Maximum entries before LRU eviction */
  maxSize: number
  /** Number of cache hits since last clear */
  hits: number
  /** Number of cache misses since last clear */
  misses: number
  /** Total LRU evictions performed since last clear */
  evictions: number
  /**
   * Hit rate as a decimal (0–1), NaN when hits + misses === 0.
   * Multiply by 100 to get percentage.
   */
  hitRate: number
  /** TTL per entry in milliseconds */
  ttlMs: number
  /** TTL per entry in seconds (matches PROVIDER_CACHE_TTL env var) */
  ttlSeconds: number
}

/**
 * Return current cache statistics.
 * Useful for dashboards, health checks, and debugging.
 */
export function getCacheStats(): CacheStats {
  const total = hits + misses
  const hitRate = total > 0 ? hits / total : NaN
  const ttlSeconds = Math.round(CACHE_TTL_MS / 1000)
  return {
    size: cache.size,
    maxSize: CACHE_MAX_ENTRIES,
    hits,
    misses,
    evictions,
    hitRate,
    ttlMs: CACHE_TTL_MS,
    ttlSeconds,
  }
}
