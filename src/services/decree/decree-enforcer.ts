// @ts-nocheck
/**
 * Decree Enforcement Service — DuckHive
 * Phase 3: Decree enforcement in tool execution
 *
 * Decrees are rules issued by Senate that must be enforced during tool execution.
 * They are stored in global config and checked before dangerous operations.
 */

import { getGlobalConfig } from '../../utils/config.js'

export interface Decree {
  id: string
  name: string
  rule: string // Natural language rule
  pattern: RegExp // Pattern to match against tool calls
  severity: 'warning' | 'block' | 'mandatory'
  createdAt: string
  createdBy: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

const DECREE_STORAGE_KEY = 'duckhive.decrees'

/**
 * Get all active decrees
 */
export function getActiveDecrees(): Decree[] {
  try {
    const config = getGlobalConfig()
    const decrees = (config as Record<string, unknown>)[DECREE_STORAGE_KEY] as Decree[] || []
    const now = new Date().toISOString()

    // Filter out expired decrees
    return decrees.filter(
      (d) => !d.expiresAt || d.expiresAt > now
    )
  } catch {
    return []
  }
}

/**
 * Add a new decree
 */
export function addDecree(decree: Omit<Decree, 'id' | 'createdAt'>): Decree {
  const decrees = getActiveDecrees()
  const newDecree: Decree = {
    ...decree,
    id: `decree_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  decrees.push(newDecree)
  saveDecrees(decrees)
  return newDecree
}

/**
 * Remove a decree by ID
 */
export function removeDecree(decreeId: string): boolean {
  const decrees = getActiveDecrees()
  const index = decrees.findIndex((d) => d.id === decreeId)
  if (index === -1) return false
  decrees.splice(index, 1)
  saveDecrees(decrees)
  return true
}

/**
 * Save decrees to config
 */
async function saveDecrees(decrees: Decree[]): Promise<void> {
  const { saveGlobalConfig } = await import('../../utils/config.js')
  const config = getGlobalConfig()
  ;(config as Record<string, unknown>)[DECREE_STORAGE_KEY] = decrees
  await saveGlobalConfig(config)
}

/**
 * Check if a tool call matches any decree patterns
 */
export interface DecreeCheckResult {
  enforced: boolean
  decree?: Decree
  action: 'allow' | 'warn' | 'block'
  message?: string
}

export function checkDecrees(toolName: string, toolArgs: Record<string, unknown>): DecreeCheckResult {
  const decrees = getActiveDecrees()

  for (const decree of decrees) {
    // Check if tool matches decree pattern
    if (decree.pattern.test(toolName)) {
      // Check args against decree
      const argsStr = JSON.stringify(toolArgs).toLowerCase()

      // For blocking decrees
      if (decree.severity === 'block') {
        return {
          enforced: true,
          decree,
          action: 'block',
          message: `DECREE ENFORCEMENT: ${decree.name} blocks this operation.\nRule: ${decree.rule}`,
        }
      }

      // For warning decrees
      if (decree.severity === 'warning') {
        return {
          enforced: true,
          decree,
          action: 'warn',
          message: `DECREE WARNING: ${decree.name}\nRule: ${decree.rule}`,
        }
      }

      // For mandatory decrees (always log but allow)
      return {
        enforced: true,
        decree,
        action: 'allow',
        message: `DECREE LOGGED: ${decree.name}`,
      }
    }
  }

  return { enforced: false, action: 'allow' }
}

/**
 * Create standard decrees for security
 */
export function createSecurityDecrees(): void {
  const existingDecrees = getActiveDecrees()
  const hasDeleteProtection = existingDecrees.some(
    (d) => d.name === 'No Untracked File Deletion'
  )

  if (!hasDeleteProtection) {
    addDecree({
      name: 'No Untracked File Deletion',
      rule: 'Agents SHALL verify file paths before deletion - never delete untracked files without user confirmation',
      pattern: /rm|del|delete|unlink/i,
      severity: 'warning',
      createdBy: 'system',
    })
  }
}

/**
 * Format decree for display
 */
export function formatDecree(decree: Decree): string {
  const expires = decree.expiresAt
    ? ` (expires: ${new Date(decree.expiresAt).toLocaleString()})`
    : ''

  return [
    `📜 Decree: ${decree.name}`,
    `   Rule: ${decree.rule}`,
    `   Severity: ${decree.severity.toUpperCase()}`,
    `   Created: ${new Date(decree.createdAt).toLocaleString()}${expires}`,
    `   ID: ${decree.id}`,
  ].join('\n')
}

/**
 * List all decrees formatted for REPL
 */
export function listDecrees(): string {
  const decrees = getActiveDecrees()

  if (decrees.length === 0) {
    return 'No active decrees.'
  }

  const lines = [`\n📜 Active Decrees (${decrees.length})\n`]
  for (const decree of decrees) {
    lines.push(formatDecree(decree))
    lines.push('')
  }
  return lines.join('\n')
}
