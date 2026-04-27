/**
 * Swarm voting — collect teammate results, score them, return ranked response.
 *
 * Modes:
 *  - vote     : each agent rates the others (requires judge model)
 *  - merge    : combine complementary parts into one super-answer
 *  - pick-best : score-only, rank by quality, return best + rankings
 *
 * Works with DuckHive's existing in-process teammate infrastructure.
 * Does NOT spawn agents — call spawnInProcessTeammate() separately,
 * then pass the collected responses to the appropriate voting function.
 */

import { z } from 'zod/v4'
import { sample } from 'lodash-es/sample.js'
import { logForDebugging } from './debug.js'
import { getLastPeerDmSummary, readMailbox, writeToMailbox } from './teammateMailbox.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScoreResult = {
  agentId: string
  score: number       // 0–10
  reasoning: string
}

export type RankedResults = {
  rankings: ScoreResult[]
  best: ScoreResult
  mode: 'pick-best'
}

export type MergedResult = {
  mergedText: string
  contributors: string[]   // agent IDs that contributed to the merge
  mode: 'merge'
}

export type VotedResult = {
  winner: string
  votes: Record<string, string[]>  // agentId → [voted-for agentIds]
  tally: Record<string, number>   // agentId → vote count
  mode: 'vote'
}

export type SwarmResult =
  | RankedResults
  | MergedResult
  | VotedResult

export type VotingMode = 'pick-best' | 'merge' | 'vote'

export const VotingModeSchema = z.enum(['pick-best', 'merge', 'vote'])

/**
 * Collection of teammate responses gathered from the mailbox.
 * Gather these by reading each agent's mailbox after they've completed.
 */
export type CollectedResponses = Map<
  string,   // agentId e.g. "researcher@squad"
  {
    text: string
    timestamp: number
    taskId?: string
  }
>

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Gather responses from all agents by reading their mailbox summaries.
 * Returns only agents that have responded (non-empty summary).
 */
export async function collectResponses(
  agentIds: string[],
  timeoutMs = 30_000,
): Promise<CollectedResponses> {
  const responses = new Map()
  const deadline = Date.now() + timeoutMs

  for (const agentId of agentIds) {
    if (Date.now() > deadline) break

    try {
      const summary = await getLastPeerDmSummary(agentId)
      if (summary && summary.trim().length > 0) {
        responses.set(agentId, {
          text: summary.trim(),
          timestamp: Date.now(),
        })
      }
    } catch {
      // Agent hasn't responded yet — skip
    }
  }

  return responses
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export type ScoringCriteria = {
  /** Weight for solution completeness (0-1) */
  completeness?: number
  /** Weight for correctness/accuracy (0-1) */
  correctness?: number
  /** Weight for conciseness (0-1) */
  conciseness?: number
  /** Weight for code quality (0-1) */
  codeQuality?: number
}

const DEFAULT_CRITERIA: ScoringCriteria = {
  completeness: 0.3,
  correctness: 0.35,
  conciseness: 0.1,
  codeQuality: 0.25,
}

function scoreResponse(text: string, criteria: ScoringCriteria): { score: number; reasoning: string } {
  // Lightweight heuristics — no LLM needed for pick-best mode
  const lines = text.split('\n').length
  const words = text.split(/\s+/).length
  const sentences = text.split(/[.!?]+/).length
  const hasCode = /```|function|const|import |class |def |async |await/.test(text)
  const hasList = /^\s*[-*•]\s/m.test(text)
  const hasSteps = /\d\.\s/.test(text)
  const isLong = words > 200
  const hasError = /\berror\b|\bfail(ed|ure)?\b|\bnot (working|correct)\b/i.test(text)
  const hasConclusion = /^(therefore|so|in (conclusion|summary)|final|answer|result)/im.test(text)

  let score = 5.0
  let reasoning = ''

  // Completeness
  if (isLong && hasList && hasSteps) {
    score += criteria.completeness! * 2
    reasoning += 'Detailed + structured. '
  }

  // Correctness
  if (!hasError) {
    score += criteria.correctness! * 2
    reasoning += 'No error signals. '
  } else {
    score -= 2
    reasoning += 'Contains error indicators. '
  }

  // Conciseness
  const density = words / Math.max(lines, 1)
  if (density > 10) {
    score += criteria.conciseness!
    reasoning += 'High information density. '
  }

  // Code quality
  if (hasCode) {
    score += criteria.codeQuality! * 1.5
    reasoning += 'Contains code. '
  }

  // Bonus for clear conclusion
  if (hasConclusion) {
    score += 0.5
    reasoning += 'Clear conclusion. '
  }

  // Cap at 10, floor at 0
  score = Math.max(0, Math.min(10, score))
  if (!reasoning) reasoning = 'Average response'

  return { score: Math.round(score * 10) / 10, reasoning: reasoning.trim() }
}

// ─── pick-best ───────────────────────────────────────────────────────────────

/**
 * Score all collected responses and return ranked results.
 * Auto-picks the highest-scoring agent as "best".
 */
export async function pickBest(
  responses: CollectedResponses,
  criteria?: ScoringCriteria,
): Promise<RankedResults> {
  const opts = { ...DEFAULT_CRITERIA, ...criteria }

  const scored: ScoreResult[] = []

  for (const [agentId, { text }] of responses) {
    const { score, reasoning } = scoreResponse(text, opts)
    scored.push({ agentId, score, reasoning })
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score)

  const best = scored[0]

  logForDebugging(`[swarmVoting] pick-best: ${scored.map(s => `${s.agentId}: ${s.score}`).join(', ')}`)

  return { rankings: scored, best, mode: 'pick-best' }
}

// ─── merge ────────────────────────────────────────────────────────────────────

/**
 * Merge multiple responses into one coherent answer.
 * Uses simple text-segment stitching — identifies distinct sections from each
 * agent and combines non-redundant parts.
 *
 * For a smarter merge, call this with a model that has context.
 */
export async function mergeResponses(
  responses: CollectedResponses,
): Promise<MergedResult> {
  // Simple approach: extract unique sections from each response
  const sections: { source: string; text: string; lines: number }[] = []

  for (const [agentId, { text }] of responses) {
    const lines = text.split('\n')
    // Group into blocks of up to 15 lines
    for (let i = 0; i < lines.length; i += 15) {
      const block = lines.slice(i, i + 15).join('\n').trim()
      if (block.length > 20) {
        sections.push({ source: agentId, text: block, lines: block.split('\n').length })
      }
    }
  }

  // Deduplicate similar sections (basic similarity: first 50 chars)
  const seen = new Set<string>()
  const unique: typeof sections = []
  for (const s of sections) {
    const key = s.text.slice(0, 80).toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(s)
    }
  }

  // Build merged text: interleave sections, preserving order
  const mergedParts: string[] = []
  const contributors = new Set<string>()

  for (const s of unique) {
    // Add source label if not already present
    mergedParts.push(`\n--- From ${s.source} ---\n${s.text}`)
    contributors.add(s.source)
  }

  const mergedText = mergedParts.join('\n')

  logForDebugging(`[swarmVoting] merge: ${contributors.size} agents, ${unique.length} unique sections`)

  return {
    mergedText,
    contributors: Array.from(contributors),
    mode: 'merge',
  }
}

// ─── vote ────────────────────────────────────────────────────────────────────

/**
 * Each agent votes for the best response.
 * Requires an LLM to evaluate — returns placeholder tally for now.
 * For real vote mode, you'd have each agent send a DM to the leader voting
 * for the best peer. This function tallies those votes from the mailbox.
 */
export async function vote(
  responses: CollectedResponses,
  _voters: string[],  // agentIds who submitted votes (read from mailbox)
): Promise<VotedResult> {
  // In a full implementation, you'd read each voter's mailbox for their vote.
  // Here we fall back to the scoring heuristic as a proxy for voting.
  const opts = DEFAULT_CRITERIA

  // Score as proxy for votes (higher score = more likely to get votes)
  const scores: Record<string, number> = {}
  for (const [agentId, { text }] of responses) {
    scores[agentId] = scoreResponse(text, opts).score
  }

  // Convert scores to votes: each agent "votes" for agents with lower scores
  const votes: Record<string, string[]> = {}
  const tally: Record<string, number> = {}

  const agentIds = Array.from(responses.keys())
  for (const voter of agentIds) {
    const voterScore = scores[voter] ?? 0
    const votedFor = agentIds.filter(
      a => a !== voter && (scores[a] ?? 0) < voterScore,
    )
    votes[voter] = votedFor
  }

  // Tally votes
  for (const v of agentIds) tally[v] = 0
  for (const voter of agentIds) {
    for (const voted of votes[voter]) {
      tally[voted] = (tally[voted] ?? 0) + 1
    }
  }

  const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? agentIds[0]

  logForDebugging(`[swarmVoting] vote: winner=${winner}, tally=${JSON.stringify(tally)}`)

  return { winner, votes, tally, mode: 'vote' }
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export type VoteOptions = {
  mode: VotingMode
  criteria?: ScoringCriteria
  voters?: string[]
}

export async function runSwarmVoting(
  responses: CollectedResponses,
  options: VoteOptions,
): Promise<SwarmResult> {
  switch (options.mode) {
    case 'pick-best':
      return pickBest(responses, options.criteria)
    case 'merge':
      return mergeResponses(responses)
    case 'vote':
      return vote(responses, options.voters ?? [])
    default:
      throw new Error(`Unknown voting mode: ${options.mode}`)
  }
}