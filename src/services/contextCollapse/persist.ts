/**
 * Stub for context-collapse persistence when feature is not fully implemented.
 * Provides no-op implementations so resume can proceed without errors.
 */

// Required by sessionRestore.ts and ResumeConversation.tsx
export function restoreFromEntries(
  _commits: unknown[],
  _snapshot: unknown,
): void {
  // No-op: contextCollapse feature is stubbed out in index.ts
  // When fully implemented, this rebuilds the commit log from transcript entries
}
