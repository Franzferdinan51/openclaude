/**
 * SkillRegistry - Progressive Skill Loading System
 *
 * Implements lazy loading of skill content: only loads full SKILL.md content
 * when a skill is first activated, keeping memory usage low at startup.
 *
 * Based on DeerFlow's progressive skill loading pattern where skills are
 * loaded only when a sub-agent actually needs them.
 */

import { getFsImplementation } from '../../utils/fsOperations.js'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import type { Command } from '../../types/command.js'

export type SkillMetadata = {
  name: string
  description: string
  category: string // derived from skill path structure
  path: string // absolute path to SKILL.md
  source: string
  loadedFrom: string
  isHidden: boolean
  allowedTools?: string[]
  model?: string
  effort?: number
  whenToUse?: string
}

/**
 * Skill content that has been fully loaded (including markdown body)
 */
export type LoadedSkill = SkillMetadata & {
  content: string // full SKILL.md content (no frontmatter wrapper)
  frontmatter: Record<string, unknown>
  baseDir: string // skill directory path
}

/**
 * Internal registry tracking both metadata-only and fully-loaded skills
 */
class SkillRegistryImpl {
  // Skills with only metadata loaded (fast startup)
  private metadataMap = new Map<string, SkillMetadata>()
  // Skills with full content loaded (lazy loaded on activation)
  private loadedContentMap = new Map<string, LoadedSkill>()
  // Set of skill names currently marked as activated
  private activatedSkills = new Set<string>()

  /**
   * Registers skill metadata for a skill. This is the fast path for startup -
   * only frontmatter fields are parsed, not the full markdown content.
   *
   * @param metadata Skill metadata from loadSkillsDir parsing
   */
  registerMetadata(metadata: SkillMetadata): void {
    this.metadataMap.set(metadata.name, metadata)
  }

  /**
   * Unregisters a skill from the registry. Used when skill directories are
   * removed or updated.
   *
   * @param skillName Name of the skill to remove
   */
  unregisterSkill(skillName: string): void {
    this.metadataMap.delete(skillName)
    this.loadedContentMap.delete(skillName)
    this.activatedSkills.delete(skillName)
  }

  /**
   * Loads only the frontmatter metadata for a skill (fast operation).
   * Used at startup to quickly build the skill index.
   *
   * @param skillPath Absolute path to SKILL.md file
   * @returns SkillMetadata or null if file can't be read
   */
  async loadSkillMetadata(skillPath: string): Promise<SkillMetadata | null> {
    const fs = getFsImplementation()

    try {
      const content = await fs.readFile(skillPath, { encoding: 'utf-8' })
      const { frontmatter } = parseFrontmatter(content, skillPath)

      // Extract path structure for category
      const pathParts = skillPath.split('/')
      const skillsIndex = pathParts.indexOf('skills')
      const category =
        skillsIndex >= 0 && pathParts.length > skillsIndex + 2
          ? pathParts[skillsIndex + 1]
          : 'uncategorized'

      const name =
        frontmatter.name != null
          ? String(frontmatter.name)
          : this.extractNameFromPath(skillPath)

        const userInvocableVal = frontmatter['user-invocable']
        const isHiddenSkill = userInvocableVal != null && String(userInvocableVal) !== 'true' && String(userInvocableVal) !== '1'

        return {
          name,
          description: this.coerceDescription(frontmatter.description, name),
          category,
          path: skillPath,
          source: frontmatter.source as string ?? 'unknown',
          loadedFrom: frontmatter.loadedFrom as string ?? 'unknown',
          isHidden: isHiddenSkill,
          allowedTools: this.parseAllowedTools(frontmatter['allowed-tools']),
          model: frontmatter.model as string | undefined,
          effort:
            frontmatter.effort != null
              ? parseInt(String(frontmatter.effort), 10)
              : undefined,
          whenToUse: frontmatter.when_to_use as string | undefined,
        }
    } catch {
      return null
    }
  }

  /**
   * Loads the full SKILL.md content for a skill (slower, done on first activation).
   * After loading, the skill stays in memory for session duration.
   *
   * @param skillName Name of the skill to load
   * @returns LoadedSkill with full content, or null if not found
   */
  async loadSkillFull(skillName: string): Promise<LoadedSkill | null> {
    // Check if already fully loaded
    const existing = this.loadedContentMap.get(skillName)
    if (existing) {
      return existing
    }

    // Get metadata to find the path
    const metadata = this.metadataMap.get(skillName)
    if (!metadata) {
      return null
    }

    const fs = getFsImplementation()

    try {
      const content = await fs.readFile(metadata.path, { encoding: 'utf-8' })
      const { frontmatter, content: bodyContent } = parseFrontmatter(
        content,
        metadata.path,
      )

      // Extract base directory from the skill path
      const lastSlash = metadata.path.lastIndexOf('/')
      const baseDir = lastSlash >= 0 ? metadata.path.slice(0, lastSlash) : ''

      const loadedSkill: LoadedSkill = {
        ...metadata,
        content: bodyContent,
        frontmatter,
        baseDir,
      }

      // Mark as activated
      this.activatedSkills.add(skillName)
      this.loadedContentMap.set(skillName, loadedSkill)

      return loadedSkill
    } catch {
      return null
    }
  }

  /**
   * Unloads a skill from the full-content map. Called on session end.
   * Metadata is kept so the skill can be re-activated quickly.
   *
   * @param skillName Name of the skill to unload
   */
  unloadSkill(skillName: string): void {
    this.loadedContentMap.delete(skillName)
    this.activatedSkills.delete(skillName)
  }

  /**
   * Unloads all fully-loaded skills. Called on session end.
   * Preserves metadata for all registered skills.
   */
  unloadAllSkills(): void {
    this.loadedContentMap.clear()
    this.activatedSkills.clear()
  }

  /**
   * Returns all skills with full content loaded.
   * These are the skills that have been activated during the session.
   *
   * @returns Array of fully-loaded skills
   */
  getLoadedSkills(): LoadedSkill[] {
    return Array.from(this.loadedContentMap.values())
  }

  /**
   * Returns metadata for all registered skills (lightweight, no content).
   * Use this for listing/discovering skills at startup.
   *
   * @returns Array of all skill metadata
   */
  getSkillMetadata(): SkillMetadata[] {
    return Array.from(this.metadataMap.values())
  }

  /**
   * Returns metadata for a single skill by name.
   *
   * @param skillName Name of the skill
   * @returns SkillMetadata or undefined
   */
  getMetadata(skillName: string): SkillMetadata | undefined {
    return this.metadataMap.get(skillName)
  }

  /**
   * Returns the full content for a skill if it's been loaded.
   * Does NOT trigger lazy loading - use loadSkillFull for that.
   *
   * @param skillName Name of the skill
   * @returns Content string or undefined if not loaded
   */
  getLoadedContent(skillName: string): string | undefined {
    return this.loadedContentMap.get(skillName)?.content
  }

  /**
   * Returns true if a skill has full content loaded (activated).
   *
   * @param skillName Name of the skill
   */
  isLoaded(skillName: string): boolean {
    return this.loadedContentMap.has(skillName)
  }

  /**
   * Returns true if a skill has been activated (even if content not yet loaded).
   *
   * @param skillName Name of the skill
   */
  isActivated(skillName: string): boolean {
    return this.activatedSkills.has(skillName)
  }

  /**
   * Returns the count of metadata-only skills.
   */
  get metadataCount(): number {
    return this.metadataMap.size
  }

  /**
   * Returns the count of fully-loaded skills.
   */
  get loadedCount(): number {
    return this.loadedContentMap.size
  }

  /**
   * Clears all skills (metadata and content). Used for testing or reset.
   */
  clear(): void {
    this.metadataMap.clear()
    this.loadedContentMap.clear()
    this.activatedSkills.clear()
  }

  private extractNameFromPath(skillPath: string): string {
    // skill-name/SKILL.md -> skill-name
    const parts = skillPath.split('/')
    const fileName = parts[parts.length - 1] ?? ''
    if (fileName.toLowerCase() === 'skill.md') {
      return parts[parts.length - 2] ?? fileName
    }
    return fileName.replace(/\.md$/i, '')
  }

  private coerceDescription(
    desc: unknown,
    fallback: string,
  ): string {
    if (typeof desc === 'string' && desc.trim()) {
      return desc.trim()
    }
    return fallback
  }

  private parseAllowedTools(
    allowed: unknown,
  ): string[] | undefined {
    if (!allowed) return undefined
    if (Array.isArray(allowed)) return allowed.map(String)
    if (typeof allowed === 'string') {
      return allowed
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    }
    return undefined
  }
}

// Singleton instance - shared across the session
export const SkillRegistry = new SkillRegistryImpl()

/**
 * Registers skill metadata from an existing Command object.
 * Used by tools that already have skill data from loadSkillsDir.
 *
 * @param command Command from getCommands() (prompt variant)
 */
export function registerSkillFromCommand(command: Command): void {
  if (command.type !== 'prompt') return

  // Extract path from skillRoot or reconstruct from command
  const path = command.skillRoot
    ? `${command.skillRoot}/SKILL.md`
    : undefined

  if (!path) return

  let effort: number | undefined
  if (command.effort !== undefined) {
    effort = typeof command.effort === 'number' ? command.effort : undefined
  }

  SkillRegistry.registerMetadata({
    name: command.name,
    description: command.description,
    category: extractCategoryFromPath(path),
    path,
    source: command.source,
    loadedFrom: command.loadedFrom ?? 'unknown',
    isHidden: command.isHidden ?? false,
    allowedTools: command.allowedTools,
    model: command.model,
    effort,
    whenToUse: command.whenToUse,
  })
}

function extractCategoryFromPath(path: string): string {
  const parts = path.split('/')
  const skillsIndex = parts.indexOf('skills')
  if (skillsIndex >= 0 && parts.length > skillsIndex + 2) {
    return parts[skillsIndex + 1]
  }
  return 'uncategorized'
}