// @ts-nocheck
/**
 * Deliberation Service — Embedded Council for DuckHive
 * Phase 3: Deep Integration - Council deliberation embedded in task pipeline
 *
 * Provides lightweight internal deliberation without requiring external Hive server.
 * For full multi-model council, use the external Hive Council at localhost:3007.
 */

import { getHiveBridge } from '../hive-bridge/hive-bridge.js'
import { logForDebugging } from '../../utils/debug.js'

export interface DeliberationRequest {
  topic: string
  mode?: 'standard' | 'socratic' | 'adversarial' | 'consensus' | 'creative' | 'analytical'
  urgency?: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, unknown>
}

export interface DeliberationResult {
  verdict: string
  consensus: number // 0-1
  arguments: string[]
  councilors: string[]
  duration: number // ms
  source: 'internal' | 'external'
}

/**
 * Lightweight internal deliberation using built-in reasoning
 */
async function internalDeliberate(
  request: DeliberationRequest
): Promise<DeliberationResult> {
  const start = Date.now()
  const { topic, mode = 'standard', urgency = 'medium' } = request

  // Internal deliberation uses the model's own reasoning
  // This provides quick turnaround for simple decisions
  const analysis = await internalAnalyze(topic, mode, urgency)

  return {
    verdict: analysis.verdict,
    consensus: analysis.confidence,
    arguments: analysis.reasons,
    councilors: ['internal-deliberator'],
    duration: Date.now() - start,
    source: 'internal',
  }
}

/**
 * Internal analysis helper
 */
async function internalAnalyze(
  topic: string,
  mode: string,
  urgency: string
): Promise<{ verdict: string; confidence: number; reasons: string[] }> {
  // Simple heuristic-based deliberation
  // In production, this would use a local model or external council
  const reasons: string[] = []
  let confidence = 0.7
  let verdict = 'PROCEED'

  const topic_lower = topic.toLowerCase()

  // Risk indicators
  if (
    topic_lower.includes('delete') ||
    topic_lower.includes('rm -rf') ||
    topic_lower.includes('drop table') ||
    topic_lower.includes('remove all')
  ) {
    reasons.push('WARNING: Operation appears destructive')
    confidence -= 0.2
    verdict = 'CAUTION'
  }

  if (
    topic_lower.includes('git push --force') ||
    topic_lower.includes('reset --hard') ||
    topic_lower.includes('destroy')
  ) {
    reasons.push('CRITICAL: Irreversible operation detected')
    confidence -= 0.3
    verdict = 'REVIEW REQUIRED'
  }

  // Cost indicators
  if (
    topic_lower.includes('api key') ||
    topic_lower.includes('secret') ||
    topic_lower.includes('password')
  ) {
    reasons.push('Security-sensitive operation')
    confidence -= 0.1
  }

  // Safety indicators
  if (topic_lower.includes('exec') || topic_lower.includes('eval')) {
    reasons.push('DANGEROUS: Code execution detected')
    confidence -= 0.25
    verdict = 'BLOCK'
  }

  // Mode-specific adjustments
  if (mode === 'adversarial') {
    confidence -= 0.1
    reasons.push('Adversarial mode: lower confidence due to conflict analysis')
  } else if (mode === 'consensus') {
    reasons.push('Consensus mode: seeking broad agreement')
  }

  // Urgency adjustments
  if (urgency === 'critical') {
    reasons.push('Critical urgency: expedited decision')
    confidence += 0.05
  } else if (urgency === 'low') {
    reasons.push('Low urgency: thorough analysis warranted')
    confidence -= 0.05
  }

  confidence = Math.max(0.1, Math.min(0.95, confidence))

  return { verdict, confidence, reasons }
}

function normalizeExternalCouncilMode(
  mode: DeliberationRequest['mode'] | undefined,
): 'deliberation' | 'inquiry' | 'adversarial' | 'consensus' | 'brainstorm' {
  switch (mode) {
    case 'socratic':
    case 'analytical':
      return 'inquiry'
    case 'creative':
      return 'brainstorm'
    case 'adversarial':
      return 'adversarial'
    case 'consensus':
      return 'consensus'
    case 'standard':
    default:
      return 'deliberation'
  }
}

/**
 * Consult council for a task decision
 * Tries external Hive Council first, falls back to internal deliberation
 */
export async function consultCouncil(
  request: DeliberationRequest
): Promise<DeliberationResult> {
  const hive = getHiveBridge()

  // Try external council first
  if (hive.isEnabled()) {
    try {
      const health = await hive.isHealthy()
      if (health) {
        const result = await hive.startDeliberation(
          request.topic,
          normalizeExternalCouncilMode(request.mode),
        )
        return {
          verdict: result.verdict || 'COMPLEX',
          consensus: result.consensusScore || 0.5,
          arguments: result.arguments || [],
          councilors: result.councilors || [],
          duration: result.duration || 1000,
          source: 'external',
        }
      }
    } catch (err) {
      logForDebugging('Council external fallback to internal', { error: String(err) })
    }
  }

  // Fall back to internal deliberation
  return internalDeliberate(request)
}

/**
 * Quick safety check - wraps consultCouncil for synchronous use
 */
export async function safetyCheck(
  operation: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<{ safe: boolean; warning?: string }> {
  if (severity === 'low') {
    return { safe: true }
  }

  const result = await consultCouncil({
    topic: `Should I proceed with: ${operation}`,
    mode: severity === 'critical' ? 'adversarial' : 'standard',
    urgency: severity,
  })

  const safe = result.verdict !== 'BLOCK' && result.consensus > 0.3

  return {
    safe,
    warning: !safe
      ? `Council blocked: ${result.verdict} (confidence: ${(result.consensus * 100).toFixed(0)}%)`
      : result.verdict === 'CAUTION'
        ? `Council caution: ${result.arguments.join(', ')}`
        : undefined,
  }
}

/**
 * Check if task complexity warrants council deliberation
 */
export function warrantsDeliberation(
  taskDescription: string,
  estimatedComplexity: number
): boolean {
  const complexityThreshold = 5

  // High complexity tasks warrant deliberation
  if (estimatedComplexity >= complexityThreshold) {
    return true
  }

  // Keywords that trigger deliberation
  const deliberationTriggers = [
    'architecture',
    'refactor',
    'security',
    'authentication',
    'database',
    'migration',
    'deploy',
    'production',
    'critical',
    'ethical',
    'multi-agent',
    'coordinate',
  ]

  const task_lower = taskDescription.toLowerCase()
  return deliberationTriggers.some((trigger) => task_lower.includes(trigger))
}

/**
 * Format deliberation result for REPL display
 */
export function formatDeliberationForRepl(result: DeliberationResult): string {
  const lines: string[] = []

  lines.push(`\n🗳️  Council Deliberation [${result.source}]`)
  lines.push(`   Verdict: ${result.verdict}`)
  lines.push(`   Consensus: ${(result.consensus * 100).toFixed(0)}%`)
  lines.push(`   Duration: ${result.duration}ms`)

  if (result.councilors.length > 0) {
    lines.push(`   Councilors: ${result.councilors.join(', ')}`)
  }

  if (result.arguments.length > 0) {
    lines.push(`   Arguments:`)
    for (const arg of result.arguments.slice(0, 5)) {
      lines.push(`     • ${arg}`)
    }
  }

  return lines.join('\n')
}
