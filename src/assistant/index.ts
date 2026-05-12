/**
 * Stub re-exports for assistant module types.
 * The actual module is generated at build time by OpenClaude's build system.
 * These stubs satisfy TypeScript type-checking only.
 * KAIROS feature is disabled in DuckHive builds, so these are never called,
 * but TypeScript needs the types to match what main.tsx references.
 */

// KAIROS is disabled in DuckHive (feature flag = false in scripts/build.ts),
// so these functions are never called at runtime. They exist only to satisfy
// TypeScript type-checking for code that imports from this module.

export function isAssistantMode(): boolean { return false }

export function isAssistantForced(): boolean { return false }

export function markAssistantForced(): void {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initializeAssistantTeam(): Promise<any> { return undefined }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAssistantSystemPromptAddendum(): any { return '' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAssistantActivationPath(): any { return undefined }