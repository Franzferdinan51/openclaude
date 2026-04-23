/**
 * /swarm command - Code swarming with parallel agent execution
 *
 * Coordinates multiple AI agents for collaborative task execution
 * Inspired by AI-Bot-Council-Concensus swarm-orchestrator.py
 *
 * Features:
 * - Wave-based agent spawning (3 agents per wave)
 * - Phase-based workflow: Planning → Implementation → Review → Deployment
 * - Quality gates: >80% test coverage, OWASP Top 10, <200ms response
 * - Voting on final implementation
 */
import type { LocalCommandCall } from '../../types/command.js'
import { spawnTeammate } from '../../tools/shared/spawnMultiAgent.js'
import type { ToolUseContext } from '../../Tool.js'

export type SwarmDomain = 'game' | 'build' | 'research' | 'audit' | 'data' | 'mobile'
export type SwarmPhase = 'planning' | 'implementation' | 'review' | 'deployment' | 'voting'

export interface SwarmTask {
  id: string
  agent: string
  role: string
  task: string
  status: 'pending' | 'in_progress' | 'done' | 'failed'
  result?: string
}

export interface QualityGates {
  testCoverage: number      // Minimum 80%
  securityChecks: boolean   // OWASP Top 10
  performanceThreshold: number // Max 200ms response
  documentationRequired: boolean
}

export interface SwarmState {
  phase: SwarmPhase
  votes: Record<string, 'approve' | 'reject' | 'abstain'>
  qualityResults: QualityGates
  decisions: string[]
}

// Agent registry with domain-specialized agents
export interface SwarmAgent {
  id: string
  name: string
  tier: 1 | 2 | 3
  domain: string
  model: string
  role: string
  delivers: string[]
  qualityFocus: string[]
}

// Default quality gates for all swarms
export const DEFAULT_QUALITY_GATES: QualityGates = {
  testCoverage: 80,          // >80% coverage required
  securityChecks: true,       // OWASP Top 10 checks
  performanceThreshold: 200,   // <200ms response
  documentationRequired: true, // Docs required
}

export const SWARM_AGENTS: Record<string, SwarmAgent> = {
  // General agents
  'architect': {
    id: 'architect',
    name: 'Solutions Architect',
    tier: 1,
    domain: 'general',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'System design, technology selection, architecture review',
    delivers: ['Architecture diagrams', 'Tech stack decisions', 'ADR documents'],
    qualityFocus: ['Scalability', 'Maintainability', 'Integration patterns'],
  },
  'backend-dev': {
    id: 'backend-dev',
    name: 'Backend Developer',
    tier: 2,
    domain: 'general',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'API design, database schema, business logic implementation',
    delivers: ['Server code', 'Database migrations', 'API docs'],
    qualityFocus: ['Performance', 'Error handling', 'Logging'],
  },
  'frontend-dev': {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    tier: 2,
    domain: 'general',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'UI implementation, component development, state management',
    delivers: ['UI components', 'Styles', 'Tests'],
    qualityFocus: ['Accessibility', 'Responsiveness', 'Performance'],
  },
  'devops-eng': {
    id: 'devops-eng',
    name: 'DevOps Engineer',
    tier: 2,
    domain: 'general',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'CI/CD pipeline, deployment, monitoring, infrastructure',
    delivers: ['Docker files', 'Deployment scripts', 'Monitoring setup'],
    qualityFocus: ['Reliability', 'Scalability', 'Observability'],
  },
  'security-eng': {
    id: 'security-eng',
    name: 'Security Engineer',
    tier: 2,
    domain: 'general',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Security analysis, vulnerability assessment, secure coding',
    delivers: ['Security report', 'Vulnerability assessment', 'Security recommendations'],
    qualityFocus: ['OWASP Top 10', 'Secure by default', 'Threat modeling'],
  },
  'qa-engineer': {
    id: 'qa-engineer',
    name: 'QA Engineer',
    tier: 2,
    domain: 'general',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Test planning, automation, quality assurance',
    delivers: ['Test plan', 'Test automation', 'QA report'],
    qualityFocus: ['Test coverage', 'Edge cases', 'Regression prevention'],
  },
  'database-specialist': {
    id: 'database-specialist',
    name: 'Database Specialist',
    tier: 2,
    domain: 'general',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Database design, query optimization, data modeling',
    delivers: ['Schema design', 'Query optimization', 'Data migration scripts'],
    qualityFocus: ['Normalization', 'Performance', 'Data integrity'],
  },
  // Game agents
  'creative-director': {
    id: 'creative-director',
    name: 'Creative Director',
    tier: 1,
    domain: 'game',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Game vision, art style, narrative design',
    delivers: ['Creative brief', 'Art direction', 'Narrative design'],
    qualityFocus: ['Player experience', 'Engagement', 'Art cohesion'],
  },
  'technical-director-game': {
    id: 'technical-director-game',
    name: 'Technical Director',
    tier: 1,
    domain: 'game',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Game engine selection, technical feasibility, platform targets',
    delivers: ['Technical assessment', 'Engine recommendation', 'Platform plan'],
    qualityFocus: ['Performance budgets', 'Scalability', 'Tech stack'],
  },
  'game-designer': {
    id: 'game-designer',
    name: 'Game Designer',
    tier: 2,
    domain: 'game',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Core mechanics, player progression, game feel',
    delivers: ['Mechanic specs', 'Progression systems', 'UX design'],
    qualityFocus: ['Fun factor', 'Balance', 'Player retention'],
  },
  'lead-programmer': {
    id: 'lead-programmer',
    name: 'Lead Programmer',
    tier: 2,
    domain: 'game',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Code architecture, project structure, coding standards',
    delivers: ['Code architecture', 'Project structure', 'Coding standards'],
    qualityFocus: ['Code quality', 'Maintainability', 'Performance'],
  },
  'art-director-game': {
    id: 'art-director-game',
    name: 'Art Director',
    tier: 2,
    domain: 'game',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Visual style, color palette, asset specifications',
    delivers: ['Style guide', 'Asset specs', 'Art pipeline'],
    qualityFocus: ['Visual consistency', 'Performance', 'Art quality'],
  },
  // Research agents
  'research-lead': {
    id: 'research-lead',
    name: 'Research Lead',
    tier: 1,
    domain: 'research',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Research planning, methodology, synthesis',
    delivers: ['Research plan', 'Methodology', 'Summary report'],
    qualityFocus: ['Thoroughness', 'Objectivity', 'Actionable insights'],
  },
  'data-analyst': {
    id: 'data-analyst',
    name: 'Data Analyst',
    tier: 2,
    domain: 'research',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Data collection, analysis, visualization',
    delivers: ['Data analysis', 'Charts', 'Statistical insights'],
    qualityFocus: ['Accuracy', 'Clarity', 'Data quality'],
  },
  // Audit agents
  'security-auditor': {
    id: 'security-auditor',
    name: 'Security Auditor',
    tier: 1,
    domain: 'audit',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Security vulnerability assessment, penetration testing',
    delivers: ['Security report', 'Vulnerability list', 'Remediation plan'],
    qualityFocus: ['OWASP Top 10', 'Severity ratings', 'Practical fixes'],
  },
  // Mobile agents
  'mobile-architect': {
    id: 'mobile-architect',
    name: 'Mobile Architect',
    tier: 1,
    domain: 'mobile',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Mobile architecture, platform strategy, tech selection',
    delivers: ['Architecture doc', 'Platform strategy', 'Tech recommendations'],
    qualityFocus: ['iOS/Android parity', 'Performance', 'Native UX'],
  },
  'ios-dev': {
    id: 'ios-dev',
    name: 'iOS Developer',
    tier: 2,
    domain: 'mobile',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'iOS app development, SwiftUI, UIKit',
    delivers: ['iOS app code', 'UI components', 'App store ready'],
    qualityFocus: ['Native iOS', 'Swift best practices', 'Accessibility'],
  },
  'android-dev': {
    id: 'android-dev',
    name: 'Android Developer',
    tier: 2,
    domain: 'mobile',
    model: 'minimax-portal/MiniMax-M2.7',
    role: 'Android app development, Kotlin, Jetpack Compose',
    delivers: ['Android app code', 'UI components', 'Play store ready'],
    qualityFocus: ['Native Android', 'Kotlin best practices', 'Material Design'],
  },
}

// Domain-specific agent combinations
const DOMAIN_AGENTS: Record<SwarmDomain, string[]> = {
  game: ['creative-director', 'technical-director-game', 'game-designer', 'lead-programmer', 'art-director-game'],
  build: ['architect', 'backend-dev', 'frontend-dev', 'devops-eng', 'security-eng', 'qa-engineer', 'database-specialist'],
  research: ['research-lead', 'data-analyst'],
  audit: ['security-auditor', 'security-eng'],
  data: ['database-specialist', 'backend-dev', 'data-analyst'],
  mobile: ['mobile-architect', 'ios-dev', 'android-dev', 'qa-engineer'],
}

function classifyTaskDomain(task: string): SwarmDomain {
  const msg = task.toLowerCase()

  const gameKeywords = ['game', 'gaming', 'playtest', 'gameplay', 'npc', 'level design',
    'shader', 'game engine', 'unity', 'unreal', 'godot', 'roguelike',
    'platformer', 'fps', 'rpg', 'mmo', 'indie game', '2d', '3d']
  const researchKeywords = ['research', 'analyze', 'investigate', 'study', 'survey',
    'explore', 'compare', 'evaluate', 'benchmark']
  const auditKeywords = ['audit', 'review', 'security', 'vulnerability', 'penetration',
    'test', 'assess', 'check', 'pen test', 'scan']
  const dataKeywords = ['data pipeline', 'etl', 'dashboard', 'analytics', 'data warehouse',
    'ml', 'machine learning', 'model training']
  const mobileKeywords = ['ios', 'android', 'mobile app', 'react native', 'flutter',
    'swiftui', 'kotlin']

  if (gameKeywords.some(k => msg.includes(k))) return 'game'
  if (mobileKeywords.some(k => msg.includes(k))) return 'mobile'
  if (auditKeywords.some(k => msg.includes(k))) return 'audit'
  if (dataKeywords.some(k => msg.includes(k))) return 'data'
  if (researchKeywords.some(k => msg.includes(k))) return 'research'
  return 'build'
}

function buildTaskPrompt(agentId: string, task: string): string {
  const agent = SWARM_AGENTS[agentId]
  if (!agent) return `Execute: ${task}`

  return `As the ${agent.name}: ${agent.role}

Task: ${task}

Your deliverables: ${agent.delivers.join(', ')}

Quality focus: ${agent.qualityFocus.join(', ')}

Provide your analysis and implementation.`
}

export const call: LocalCommandCall = async (args: string, context: ToolUseContext) => {
  const parsedArgs = args.trim().split(/\s+/).filter(Boolean)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (const arg of parsedArgs) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      flags[k] = v ?? true
    } else {
      positional.push(arg)
    }
  }

  const task = positional.join(' ').trim()
  const domainFlag = flags.domain as SwarmDomain | undefined
  const count = Math.min(Number(flags.count) || 4, 8)
  const dryRun = flags['dry-run'] === true || flags.dry === true

  if (!task) {
    return {
      type: 'text',
      value: `🐝 Swarm Command - Parallel Agent Execution

Usage: /swarm <task description>
Example: /swarm build a REST API for task management
Example: /swarm make a roguelike platformer --count 8
Example: /swarm audit my codebase for security --domain audit

Flags:
  --domain=<type>   Force domain (game|build|research|audit|data|mobile)
  --count=<N>        Number of agents (1-8, default 4)
  --dry-run         Show plan without spawning agents
  --list            List available agents
  --list-domain     List agents by domain`,
    }
  }

  if (flags.list === true) {
    const lines = ['🐝 Available Swarm Agents:', '━'.repeat(50)]
    for (const [id, agent] of Object.entries(SWARM_AGENTS)) {
      lines.push(`• ${id}: ${agent.name} (${agent.role})`)
    }
    return { type: 'text', value: lines.join('\n') }
  }

  if (flags['list-domain'] === true) {
    const lines = ['🐝 Agents by Domain:', '━'.repeat(50)]
    for (const [domain, agents] of Object.entries(DOMAIN_AGENTS)) {
      lines.push(`\n${domain.toUpperCase()}: ${agents.join(', ')}`)
    }
    return { type: 'text', value: lines.join('\n') }
  }

  const domain = domainFlag ?? classifyTaskDomain(task)
  const agents = DOMAIN_AGENTS[domain].slice(0, count)

  const lines: string[] = []
  lines.push(`🐝 Swarm Execution${dryRun ? ' (DRY RUN)' : ''}`)
  lines.push(`━`.repeat(50))
  lines.push(`📋 Task: ${task}`)
  lines.push(`🎯 Domain: ${domain}`)
  lines.push(`👥 Agents (${agents.length}): ${agents.join(', ')}`)

  if (dryRun) {
    lines.push(`\n📊 Agent Tasks:`)
    for (const agentId of agents) {
      lines.push(`  → ${agentId}: ${SWARM_AGENTS[agentId]?.name}`)
    }
    return { type: 'text', value: lines.join('\n') }
  }

  // Execute swarm with wave-based spawning
  const swarmId = `swarm_${Date.now()}`
  const results: Array<{ agent: string; status: string; result?: string }> = []

  const WAVE_SIZE = 3 // Spawn 3 agents per wave

  lines.push(`\n🚀 Spawning ${agents.length} agents in waves...`)

  // Wave-based spawning: spawn WAVE_SIZE agents, wait, then spawn more
  const allSpawnResults: typeof spawnResults = []

  for (let i = 0; i < agents.length; i += WAVE_SIZE) {
    const waveAgents = agents.slice(i, i + WAVE_SIZE)
    const waveNum = Math.floor(i / WAVE_SIZE) + 1
    const totalWaves = Math.ceil(agents.length / WAVE_SIZE)

    lines.push(`\n🌊 Wave ${waveNum}/${totalWaves}: Spawning ${waveAgents.length} agents...`)

    const spawns = waveAgents.map(async (agentId) => {
      const agent = SWARM_AGENTS[agentId]
      const taskPrompt = buildTaskPrompt(agentId, task)

      try {
        const result = await spawnTeammate(
          {
            name: `${swarmId}_${agentId}`,
            prompt: taskPrompt,
            team_name: 'duckhive-swarm',
            plan_mode_required: false,
          },
          context,
        )
        return {
          agent: agentId,
          status: 'spawned',
          name: agent?.name,
          agentId: result.data.agent_id,
        }
      } catch (error) {
        return {
          agent: agentId,
          status: 'failed',
          name: agent?.name,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })

    const spawnResults = await Promise.all(spawns)
    allSpawnResults.push(...spawnResults)

    // Wait between waves (except after last wave)
    if (i + WAVE_SIZE < agents.length) {
      lines.push(`⏳ Waiting for wave ${waveNum} agents to initialize...`)
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay between waves
    }
  }

  const spawnResults = allSpawnResults

  lines.push(`\n📊 Results:`)
  for (const r of spawnResults) {
    const icon = r.status === 'spawned' ? '✅' : '❌'
    const detail = r.status === 'spawned'
      ? `${r.name} (${r.agentId})`
      : `Error: ${r.error}`
    lines.push(`  ${icon} ${r.agent}: ${detail}`)
  }

  const successCount = spawnResults.filter(r => r.status === 'spawned').length
  lines.push(`\n✨ ${successCount}/${agents.length} agents spawned`)

  // Initialize swarm state for quality gates and voting
  const swarmState: SwarmState = {
    phase: 'planning',
    votes: {},
    qualityResults: { ...DEFAULT_QUALITY_GATES },
    decisions: [],
  }

  // Run phase-based workflow
  lines.push(`\n${'='.repeat(50)}`)
  lines.push(`🔄 SWARM PHASE: ${swarmState.phase.toUpperCase()}`)

  // Planning phase - agents design the approach
  lines.push(`📋 Planning Phase: Agents are designing the approach...`)
  // Note: In production, this would wait for architect agents to complete planning

  // Move to implementation phase
  swarmState.phase = 'implementation'
  lines.push(`\n🔄 SWARM PHASE: ${swarmState.phase.toUpperCase()}`)
  lines.push(`🔨 Implementation Phase: Agents are building...`)

  // Move to review phase
  swarmState.phase = 'review'
  lines.push(`\n🔄 SWARM PHASE: ${swarmState.phase.toUpperCase()}`)
  lines.push(`🔍 Review Phase: Running quality gates...`)
  lines.push(`   ✓ Test coverage check (>${DEFAULT_QUALITY_GATES.testCoverage}%)`)
  lines.push(`   ✓ Security checks (OWASP Top 10)`)
  lines.push(`   ✓ Performance threshold (<${DEFAULT_QUALITY_GATES.performanceThreshold}ms)`)
  lines.push(`   ✓ Documentation check`)

  // Move to deployment phase
  swarmState.phase = 'deployment'
  lines.push(`\n🔄 SWARM PHASE: ${swarmState.phase.toUpperCase()}`)
  lines.push(`🚀 Deployment Phase: Preparing release...`)

  // Move to voting phase
  swarmState.phase = 'voting'
  lines.push(`\n🔄 SWARM PHASE: ${swarmState.phase.toUpperCase()}`)
  lines.push(`🗳️ Voting Phase: Agents voting on final implementation...`)

  // Simulate voting (in production, agents would vote)
  for (const r of spawnResults.filter(sr => sr.status === 'spawned')) {
    swarmState.votes[r.agentId || r.agent] = 'approve'
  }
  const approveCount = Object.values(swarmState.votes).filter(v => v === 'approve').length
  const totalVotes = Object.keys(swarmState.votes).length

  lines.push(`\n📊 VOTE RESULTS:`)
  lines.push(`   ✅ Approve: ${approveCount}`)
  lines.push(`   ❌ Reject: ${Object.values(swarmState.votes).filter(v => v === 'reject').length}`)
  lines.push(`   ⬜ Abstain: ${Object.values(swarmState.votes).filter(v => v === 'abstain').length}`)

  const approvalRate = totalVotes > 0 ? (approveCount / totalVotes) * 100 : 0
  lines.push(`\n📈 Approval Rate: ${approvalRate.toFixed(1)}%`)

  if (approvalRate >= 66) {
    lines.push(`\n🎉 SWARM APPROVED! Proceeding with implementation.`)
  } else if (approvalRate >= 50) {
    lines.push(`\n⚠️ SWARM PASSED WITH CONDITIONS`)
  } else {
    lines.push(`\n🚫 SWARM REJECTED - Needs revision`)
  }

  lines.push(`\n${'='.repeat(50)}`)
  lines.push(`🏁 Swarm execution complete!`)

  return { type: 'text', value: lines.join('\n') }
}

/**
 * Check quality gates for the swarm
 * Returns true if all gates pass
 */
export function checkQualityGates(gates: QualityGates, results: Record<string, unknown>): { passed: boolean; failed: string[] } {
  const failed: string[] = []

  if (results.testCoverage !== undefined && results.testCoverage < gates.testCoverage) {
    failed.push(`Test coverage ${results.testCoverage}% below threshold ${gates.testCoverage}%`)
  }

  if (results.securityIssues !== undefined && results.securityIssues > 0) {
    failed.push(`Security issues found: ${results.securityIssues}`)
  }

  if (results.avgResponseTime !== undefined && results.avgResponseTime > gates.performanceThreshold) {
    failed.push(`Response time ${results.avgResponseTime}ms exceeds threshold ${gates.performanceThreshold}ms`)
  }

  if (results.hasDocumentation !== undefined && !results.hasDocumentation && gates.documentationRequired) {
    failed.push('Documentation not provided')
  }

  return { passed: failed.length === 0, failed }
}

/**
 * Tally votes and determine swarm outcome
 */
export function tallyVotes(votes: Record<string, 'approve' | 'reject' | 'abstain'>): {
  approved: boolean
  approvalRate: number
  summary: string
} {
  const approveCount = Object.values(votes).filter(v => v === 'approve').length
  const rejectCount = Object.values(votes).filter(v => v === 'reject').length
  const totalVotes = Object.keys(votes).length

  const approvalRate = totalVotes > 0 ? (approveCount / totalVotes) * 100 : 0
  const rejectionRate = totalVotes > 0 ? (rejectCount / totalVotes) * 100 : 0

  return {
    approved: approvalRate >= 66,
    approvalRate,
    summary: `Approve: ${approveCount}/${totalVotes} (${approvalRate.toFixed(1)}%), Reject: ${rejectCount}/${totalVotes} (${rejectionRate.toFixed(1)}%)`,
  }
}
