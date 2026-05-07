/**
 * Stub types for missing modules.
 * Uses `any` to match upstream snapshot behavior where Message is not strongly typed.
 * See issue #473 for the typecheck-foundation effort.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Message = any
export type AssistantMessage = any
export type UserMessage = any
export type SystemMessage = any
export type SystemAPIErrorMessage = any
export type AttachmentMessage = any
export type ProgressMessage = any
export type HookResultMessage = any
export type NormalizedUserMessage = any
export type MessageSource = any

// Assistant mode detection
export const isAssistantMode = false
export const AssistantSession = {}
