// @ts-nocheck
export { HybridOrchestrator, createHybridOrchestrator, getHybridOrchestrator, type TaskRouting, type ExecutionResult, type ExecutionStep } from './hybrid-orchestrator.js'
export { analyzeTask, type TaskAnalysis } from './task-complexity.js'
export { selectModel, type RouteResult } from './model-router.js'
export { autoOrchestrate, type AutoOrchestrationResult } from './auto-orchestrate.js'

import { getHiveBridge } from '../../services/hive-bridge/index.js'

/**
 * @deprecated Use autoOrchestrate() instead — this only fires the council,
 * while autoOrchestrate() runs the full pipeline (analyze → route → council → checkpoint).
 * Kept for backwards compatibility.
 */
export async function checkAndFireCouncil(
  message: string,
  history: Array<{role: string; content: string}>,
  tools: string[] = [],
): Promise<{ triggered: boolean; complexity: number; reasons: string[] }> {
  const { autoOrchestrate } = await import('./auto-orchestrate.js')
  const result = await autoOrchestrate(message, history, tools, {
    enableCouncil: true,
    enableCheckpoint: false, // Legacy callers only expect council
  })
  return {
    triggered: result.councilTriggered,
    complexity: result.complexity,
    reasons: result.councilTriggered ? ['Council triggered via auto-orchestration'] : [],
  }
}
