// @ts-nocheck
export { HybridOrchestrator, createHybridOrchestrator, getHybridOrchestrator, type TaskRouting, type ExecutionResult, type ExecutionStep } from './hybrid-orchestrator.js'
export { analyzeTask, type TaskAnalysis } from './task-complexity.js'
export { selectModel, type RouteResult } from './model-router.js'

import { getHiveBridge } from '../../services/hive-bridge/index.js'

/**
 * Check if task warrants council deliberation and fire if needed.
 * Called before the main query loop to trigger council for complex tasks.
 * Returns true if council was triggered (caller should wait or include council context).
 */
export async function checkAndFireCouncil(
  message: string,
  history: Array<{role: string; content: string}>,
  tools: string[] = [],
): Promise<{ triggered: boolean; complexity: number; reasons: string[] }> {
  const { analyzeTask } = await import('./task-complexity.js')
  const analysis = analyzeTask(message, {
    message,
    history,
    tools,
    timestamp: Date.now(),
  })

  const bridge = getHiveBridge()
  if (bridge.shouldConsultCouncil(analysis.complexity)) {
    const result = await bridge.startDeliberation(message, 'balanced')
    return {
      triggered: result.success,
      complexity: analysis.complexity,
      reasons: analysis.councilReasons,
    }
  }

  return {
    triggered: false,
    complexity: analysis.complexity,
    reasons: analysis.councilReasons,
  }
}
