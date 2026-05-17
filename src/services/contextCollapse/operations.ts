/**
 * Context-collapse projection helpers.
 *
 * The current collapse implementation rewrites the API message list directly in
 * `applyCollapsesIfNeeded`, so there is no separate commit log to replay yet.
 * Keep this module as a real identity projection because `/context` and SDK
 * context-usage paths call it whenever the compile-time CONTEXT_COLLAPSE gate is
 * enabled.
 */

export function projectView<T>(messages: T[]): T[] {
  return messages
}
