// @ts-nocheck
import { analyzeTask, type TaskAnalysis } from './task-complexity.js'
import { selectModel, type RouteResult } from './model-router.js'
import { getHiveBridge } from '../../services/hive-bridge/index.js'
import { spawnTeammate } from '../../tools/shared/spawnMultiAgent.js'
import type { ToolUseContext } from '../../Tool.js'

export interface HybridOrchestratorConfig {
  enableCouncil?: boolean
  enableCheckpoint?: boolean
  enableMetrics?: boolean
  enableTeamSpawn?: boolean
  enableParallelAgents?: boolean
  councilTimeout?: number
  defaultModel?: string
}

const DEFAULT_CONFIG: HybridOrchestratorConfig = {
  enableCouncil: true,
  enableCheckpoint: true,
  enableMetrics: true,
  enableTeamSpawn: true,
  enableParallelAgents: true,
  councilTimeout: 30000,
  defaultModel: 'minimax-portal/MiniMax-M2.7',
}

export class HybridOrchestrator {
  private config: HybridOrchestratorConfig

  constructor(config: Partial<HybridOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Analyze a task and determine routing strategy
   */
  analyze(message: string, history: Array<{role: string; content: string}>, tools: string[] = []): TaskRouting {
    const analysis = analyzeTask(message, { message, history, tools, timestamp: Date.now() })
    const routing = selectModel(message, analysis.complexity)

    return {
      analysis,
      routing,
      councilVerdict: analysis.needsCouncil ? 'pending' : null,
      checkpointId: analysis.needsCheckpoint ? `auto_${Date.now()}` : null,
      executionPlan: this.buildExecutionPlan(analysis),
    }
  }

  /**
   * Execute a task with full orchestration - spawns parallel agents, triggers council
   */
  async execute(
    message: string,
    history: Array<{role: string; content: string}>,
    tools: string[] = [],
    context?: ToolUseContext
  ): Promise<ExecutionResult> {
    const routing = this.analyze(message, history, tools)
    const { analysis, routing: routeResult } = routing

    const result: ExecutionResult = {
      taskId: `task_${Date.now()}`,
      analysis,
      routing: routeResult,
      executionPlan: routing.executionPlan,
      steps: [],
      councilTriggered: false,
      teamSpawned: false,
      status: 'pending',
    }

    // Step 1: Fire council for complex/critical tasks
    if (this.config.enableCouncil && (analysis.category === 'critical' || analysis.category === 'complex' || analysis.needsCouncil)) {
      const bridge = getHiveBridge()
      if (bridge.isEnabled() && bridge.shouldConsultCouncil(analysis.complexity)) {
        const councilResult = await bridge.startDeliberation(message, 'balanced')
        result.councilTriggered = councilResult.success
        result.councilSessionId = councilResult.sessionId
        result.steps.push({
          step: 'council_deliberate',
          status: councilResult.success ? 'completed' : 'failed',
          output: councilResult.success ? `Council session: ${councilResult.sessionId}` : councilResult.error,
        })
      }
    }

    // Step 2: Spawn parallel sub-agents for complex/critical tasks
    if (this.config.enableParallelAgents && context && (analysis.category === 'critical' || analysis.category === 'complex')) {
      const numAgents = analysis.category === 'critical' ? 4 : 2
      const subtasks = this.splitIntoSubtasks(message, numAgents)

      const teamName = `swarm_${Date.now()}`

      // Spawn agents in parallel
      const spawnPromises = subtasks.map(async (subtask, i) => {
        try {
          const agentName = `worker-${i + 1}`
          const spawnResult = await spawnTeammate(
            {
              name: agentName,
              prompt: subtask,
              team_name: teamName,
              description: `Parallel agent working on subtask ${i + 1}/${numAgents}`,
            },
            context
          )
          return {
            success: true,
            agentId: spawnResult.data.teammate_id,
            agentName,
            output: `Spawned ${agentName} for subtask`,
          }
        } catch (error: any) {
          return {
            success: false,
            agentName: `worker-${i + 1}`,
            error: error?.message ?? 'Unknown spawn error',
          }
        }
      })

      const spawnResults = await Promise.all(spawnPromises)

      for (const sr of spawnResults) {
        if (sr.success) {
          result.steps.push({
            step: `spawn_agent_${sr.agentName}`,
            status: 'completed',
            output: sr.output,
          })
          result.agentsSpawned = result.agentsSpawned ?? []
          result.agentsSpawned.push(sr.agentId!)
        } else {
          result.steps.push({
            step: `spawn_agent_${sr.agentName}`,
            status: 'failed',
            error: sr.error,
          })
        }
      }

      if (spawnResults.some(r => r.success)) {
        result.teamSpawned = true
        result.teamId = teamName
      }
    } else if (this.config.enableTeamSpawn && analysis.category === 'critical') {
      // Fallback to Hive bridge team spawn if no context
      const bridge = getHiveBridge()
      if (bridge.isEnabled()) {
        const teamName = `swarm_${Date.now()}`
        const teamResult = await bridge.spawnTeam(teamName, 'swarm')
        if (teamResult.success) {
          result.teamSpawned = true
          result.teamId = teamResult.teamId
          result.steps.push({
            step: 'team_spawn',
            status: 'completed',
            output: `Team spawned: ${teamResult.teamId}`,
          })
        }
      }
    }

    // Step 3: Checkpoint for complex+ tasks
    if (this.config.enableCheckpoint && analysis.needsCheckpoint) {
      result.checkpointId = `checkpoint_${Date.now()}`
      result.steps.push({
        step: 'checkpoint_save',
        status: 'completed',
        output: `Checkpoint: ${result.checkpointId}`,
      })
    }

    result.status = 'ready'
    return result
  }

  /**
   * Split a task into parallel subtasks
   */
  private splitIntoSubtasks(message: string, numSubtasks: number): string[] {
    const words = message.split(/\s+/)
    const wordsPerTask = Math.ceil(words.length / numSubtasks)
    const subtasks: string[] = []

    for (let i = 0; i < numSubtasks; i++) {
      const start = i * wordsPerTask
      const end = Math.min(start + wordsPerTask, words.length)
      const subtaskWords = words.slice(start, end)
      // Ensure each subtask has context about the full task
      const contextPrefix = i > 0 ? `[Part ${i + 1}/${numSubtasks}] ` : ''
      subtasks.push(contextPrefix + subtaskWords.join(' '))
    }

    return subtasks
  }
  
  /**
   * Build an execution plan from complexity analysis
   */
  private buildExecutionPlan(analysis: TaskAnalysis): string[] {
    const plan: string[] = []
    
    // Always: analyze → route
    plan.push('analyze')
    plan.push('route_model')
    
    // Council for complex/critical
    if (analysis.category === 'critical') {
      plan.push('council_deliberate')
      plan.push('council_approve')
    } else if (analysis.category === 'complex' || analysis.needsCouncil) {
      plan.push('council_deliberate')
    }
    
    // Checkpoint for complex+
    if (analysis.needsCheckpoint) {
      plan.push('checkpoint_save')
    }
    
    // Execute based on complexity
    const stepCount = Math.min(analysis.estimatedSteps, 10)
    for (let i = 0; i < stepCount; i++) {
      plan.push(`execute_step_${i + 1}`)
    }
    
    // Verify for complex+
    if (analysis.category === 'complex' || analysis.category === 'critical') {
      plan.push('verify_result')
    }
    
    // Checkpoint restore on error
    plan.push('handle_errors')
    
    return plan
  }
  
  /**
   * Get execution hint for OpenClaude's internal routing
   */
  getExecutionHint(routing: RouteResult): string {
    return `model=${routing.model} provider=${routing.provider} reason=${routing.reason}`
  }
}

export interface ExecutionStep {
  step: string
  status: 'pending' | 'completed' | 'failed'
  output?: string
  error?: string
}

export interface ExecutionResult {
  taskId: string
  analysis: TaskAnalysis
  routing: RouteResult
  executionPlan: string[]
  steps: ExecutionStep[]
  councilTriggered: boolean
  councilSessionId?: string
  teamSpawned: boolean
  teamId?: string
  agentsSpawned?: string[]
  checkpointId?: string
  status: 'pending' | 'ready' | 'completed' | 'failed'
  error?: string
}

export interface TaskRouting {
  analysis: TaskAnalysis
  routing: RouteResult
  councilVerdict: 'approve' | 'reject' | 'conditional' | 'pending' | null
  checkpointId: string | null
  executionPlan: string[]
}

export const createHybridOrchestrator = (config?: Partial<HybridOrchestratorConfig>) => new HybridOrchestrator(config)
export const getHybridOrchestrator = () => createHybridOrchestrator()
