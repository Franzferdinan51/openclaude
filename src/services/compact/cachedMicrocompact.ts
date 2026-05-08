// Stub — cachedMicrocompact not included in source snapshot (feature-gated)
export type CachedMCState = unknown
export type CacheEditsBlock = unknown
export type PinnedCacheEdits = unknown

export function isCachedMicrocompactEnabled(): boolean {
  return false
}

export function isModelSupportedForCacheEditing(_model: string): boolean {
  return false
}

export function getCachedMCConfig() {
  return null
}
