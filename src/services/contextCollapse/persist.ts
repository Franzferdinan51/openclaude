/**
 * Context-collapse persistence hook.
 *
 * The active collapse implementation rewrites the in-flight API message view
 * and tracks stats in memory. There is not a durable collapse commit log yet,
 * so resume intentionally treats these transcript entries as advisory.
 */

// Required by sessionRestore.ts and ResumeConversation.tsx
export function restoreFromEntries(
  _commits: unknown[],
  _snapshot: unknown,
): void {
  // No durable commit log exists yet. Session storage still owns full-message
  // persistence, so resume can proceed safely without rebuilding collapse state.
}
