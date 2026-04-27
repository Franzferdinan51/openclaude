/**
 * Stub types for missing modules.
 * These bridge the gap between what TypeScript expects and what OpenClaude provides.
 * Generated/imported at build time; stubs satisfy type-checking only.
 */

// Re-export Message from its actual location
export type { Message, MessageSource } from '../utils/mailbox.js'

// Assistant mode detection
export const isAssistantMode = false
export const AssistantSession = {}
