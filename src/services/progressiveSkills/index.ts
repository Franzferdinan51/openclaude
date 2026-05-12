/**
 * Progressive Skills Service
 *
 * Provides lazy loading of skill content for Duck CLI.
 * Skills are loaded incrementally: metadata at startup, full content on activation.
 *
 * Based on DeerFlow's progressive skill loading pattern.
 *
 * Usage:
 *   import { registerSkillFromCommand, loadSkillFull } from './index.js'
 *
 *   // At startup (from loadSkillsDir via registerSkillFromCommand):
 *   registerSkillFromCommand(command)
 *
 *   // On skill activation (in SkillTool or SkillManageTool):
 *   const skill = await loadSkillFull(skillName)
 *
 *   // On session end:
 *   unloadAllSkills()
 */

// Re-export core registry and types from SkillRegistry
export {
  SkillRegistry,
  registerSkillFromCommand,
} from './SkillRegistry.js'
export type { LoadedSkill, SkillMetadata } from './SkillRegistry.js'

import { onSessionLifecycleEvent } from '../session-lifecycle/session-lifecycle.js'
import { SkillRegistry, registerSkillFromCommand } from './SkillRegistry.js'
import type { Command } from '../../types/command.js'

/**
 * Subscribes to session lifecycle events to automatically unload skills
 * when a session ends. This ensures memory is released and state is clean
 * between sessions.
 */
let sessionLifecycleUnsubscribe: (() => void) | null = null

/**
 * Initializes the progressive skills system. Call once at application startup.
 */
export function initProgressiveSkills(): void {
  if (sessionLifecycleUnsubscribe) return // Already initialized

  sessionLifecycleUnsubscribe = onSessionLifecycleEvent(
    (event) => {
      // Unload skills when session is destroyed
      if (event.reason === 'destroyed') {
        SkillRegistry.unloadAllSkills()
      }
    },
  )
}

/**
 * Cleans up the progressive skills system. Call on application shutdown.
 */
export function shutdownProgressiveSkills(): void {
  if (sessionLifecycleUnsubscribe) {
    sessionLifecycleUnsubscribe()
    sessionLifecycleUnsubscribe = null
  }
  SkillRegistry.unloadAllSkills()
}

/**
 * Loads the full content for a skill, activating it in the registry.
 * Subsequent calls return the cached content.
 *
 * @param skillName Name of the skill to load
 * @returns The loaded skill with full content, or null if not found
 */
export async function loadSkillFull(
  skillName: string,
): Promise<import('./SkillRegistry.js').LoadedSkill | null> {
  return SkillRegistry.loadSkillFull(skillName)
}

/**
 * Unloads a specific skill from the full-content cache.
 * The skill's metadata remains, so it can be re-loaded quickly.
 *
 * @param skillName Name of the skill to unload
 */
export function unloadSkill(skillName: string): void {
  SkillRegistry.unloadSkill(skillName)
}

/**
 * Unloads all skills from the full-content cache.
 * Called automatically on session end, but can be triggered manually.
 */
export function unloadAllSkills(): void {
  SkillRegistry.unloadAllSkills()
}

/**
 * Returns all currently loaded (full-content) skills.
 */
export function getLoadedSkills(): import('./SkillRegistry.js').LoadedSkill[] {
  return SkillRegistry.getLoadedSkills()
}

/**
 * Returns metadata for all registered skills.
 */
export function getSkillMetadata(): import('./SkillRegistry.js').SkillMetadata[] {
  return SkillRegistry.getSkillMetadata()
}

/**
 * Checks if a skill is currently loaded with full content.
 */
export function isSkillLoaded(skillName: string): boolean {
  return SkillRegistry.isLoaded(skillName)
}

/**
 * Returns the count of metadata-only skills.
 */
export function getMetadataCount(): number {
  return SkillRegistry.metadataCount
}

/**
 * Returns the count of fully-loaded skills.
 */
export function getLoadedCount(): number {
  return SkillRegistry.loadedCount
}

/**
 * Integration helper for SkillTool.
 *
 * This function can be called when a skill is invoked to register it
 * in the progressive loading system. It uses the existing command data
 * rather than re-reading the file.
 *
 * @param command The Command for the skill being invoked
 */
export function trackSkillInvocation(command: Command): void {
  if (command.type !== 'prompt') return
  if (SkillRegistry.isLoaded(command.name)) return
  const metadata = SkillRegistry.getMetadata(command.name)
  if (!metadata) {
    registerSkillFromCommand(command)
  }
}

/**
 * Integration helper for getting skill content.
 *
 * Returns cached content if already loaded, otherwise triggers lazy load.
 * This is the main integration point for SkillTool/SkillManageTool.
 *
 * @param skillName Name of the skill
 * @param getPromptFn Optional function to get content via existing system
 * @returns The skill content or null
 */
export async function getSkillContent(
  skillName: string,
  getPromptFn?: (name: string) => Promise<string>,
): Promise<string | null> {
  // Check if already loaded
  const cached = SkillRegistry.getLoadedContent(skillName)
  if (cached !== undefined) {
    return cached
  }

  // Trigger lazy load via registry
  const loaded = await SkillRegistry.loadSkillFull(skillName)
  if (loaded) {
    return loaded.content
  }

  // Fallback to provided function if available
  if (getPromptFn) {
    return getPromptFn(skillName)
  }

  return null
}