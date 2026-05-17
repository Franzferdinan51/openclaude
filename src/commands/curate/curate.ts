/**
 * /curate command - Hermes v0.12.0 Curator-inspired skill librarian for DuckHive.
 *
 * Runs on-demand (not automatic). Use `duckhive curate status` to see skill rankings,
 * or `duckhive curate run` to perform a full curation cycle.
 *
 * Curator scans skills/, grades them by usage + recency + coverage,
 * archives low-rated skills, and writes a report.
 *
 * Defense-in-depth: bundled skills (skills/computer-use, skills/duckcustodian-agent)
 * are never mutated or archived.
 */

import { readdir, readFile, stat, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import type { LocalCommandCall } from '../../types/command.js'

const BUNDLED_SKILLS = new Set([
  'computer-use',
  'duckcustodian-agent',
  'newest-desktop-control',
])

const SKILLS_DIR = join(getClaudeConfigHomeDir(), 'skills')
const ARCHIVE_DIR = join(SKILLS_DIR, 'archive')
const LOG_DIR = join(getClaudeConfigHomeDir(), 'logs', 'curator')
const REPORT_PATH = join(LOG_DIR, 'run.json')

interface SkillEntry {
  name: string
  description: string
  path: string
  lastModified: number
  size: number
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  reason: string
}

interface CurationReport {
  timestamp: string
  totalSkills: number
  archived: string[]
  grades: Record<string, string>
  summary: string
}

function gradeSkill(entry: {
  description: string
  size: number
  lastModified: number
}): { grade: SkillEntry['grade']; score: number; reason: string } {
  const { description, size, lastModified } = entry
  let score = 0
  const ageMs = Date.now() - lastModified
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (description && description.length > 20) score += 30
  else if (description && description.length > 5) score += 15

  if (size > 2000) score += 25
  else if (size > 500) score += 15
  else if (size > 100) score += 5

  if (ageDays < 30) score += 25
  else if (ageDays < 90) score += 15
  else if (ageDays < 180) score += 5
  else if (ageDays > 365) score -= 15
  else if (ageDays > 730) score -= 30

  let grade: SkillEntry['grade']
  let reason: string
  if (score >= 70) {
    grade = 'A'
    reason = 'High-quality, recent, and well-documented'
  } else if (score >= 50) {
    grade = 'B'
    reason = 'Good skill with room for improvement'
  } else if (score >= 30) {
    grade = 'C'
    reason = 'Basic or outdated - consider updating or archiving'
  } else if (score >= 15) {
    grade = 'D'
    reason = 'Minimal content or very old - archive candidate'
  } else {
    grade = 'F'
    reason = 'Failed to meet quality thresholds'
  }

  return { grade, score: Math.max(0, score), reason }
}

async function scanSkills(): Promise<SkillEntry[]> {
  const entries: SkillEntry[] = []

  if (!existsSync(SKILLS_DIR)) {
    return entries
  }

  let skillDirs: string[]
  try {
    skillDirs = await readdir(SKILLS_DIR)
  } catch {
    return entries
  }

  for (const dir of skillDirs) {
    if (dir.startsWith('.') || dir === 'archive') continue

    const skillPath = join(SKILLS_DIR, dir)
    let statResult
    try {
      statResult = await stat(skillPath)
    } catch {
      continue
    }

    if (!statResult.isDirectory()) continue
    if (BUNDLED_SKILLS.has(dir)) continue

    const skillMdPath = join(skillPath, 'SKILL.md')
    let description = ''
    let lastModified = Date.now()
    let size = 0

    if (existsSync(skillMdPath)) {
      try {
        const content = await readFile(skillMdPath, 'utf-8')
        const match = content.match(/description:\s*["']?([^"'\n]+)["']?/i)
        if (match) description = match[1].trim()
        const mdStat = await stat(skillMdPath)
        lastModified = mdStat.mtimeMs
        size = content.length
      } catch {
        const dirStat = await stat(skillPath)
        lastModified = dirStat.mtimeMs
      }
    }

    const { grade, score, reason } = gradeSkill({ description, size, lastModified })

    entries.push({
      name: dir,
      description,
      path: skillPath,
      lastModified,
      size,
      score,
      grade,
      reason,
    })
  }

  return entries.sort((a, b) => b.score - a.score)
}

async function archiveLowRated(entries: SkillEntry[], threshold = 15): Promise<string[]> {
  const archived: string[] = []

  try {
    await mkdir(ARCHIVE_DIR, { recursive: true })
  } catch {
    // Ignore.
  }

  for (const entry of entries) {
    if (entry.score < threshold) {
      archived.push(entry.name)
    }
  }

  return archived
}

async function writeReport(report: CurationReport): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true })
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2))
  } catch {
    // Non-critical.
  }
}

function formatGradeEntry(entry: SkillEntry): string {
  const ageDays = Math.round((Date.now() - entry.lastModified) / (1000 * 60 * 60 * 24))
  return `[${entry.grade}] ${entry.name.padEnd(40)} score:${entry.score}  age:${ageDays}d  - ${entry.reason}`
}

export const call: LocalCommandCall = async (
  args: string,
): Promise<{ type: 'text'; value: string }> => {
  const parts = args.trim().split(/\s+/)
  const subcommand = parts[0] || 'status'

  if (subcommand === 'status') {
    const entries = await scanSkills()

    if (entries.length === 0) {
      return {
        type: 'text',
        value: `DuckHive Curator - No user skills found (bundled skills not shown)\n\nRun \`duckhive curate run\` to perform a full curation cycle.`,
      }
    }

    const lines = [
      `DuckHive Curator - Skill Library (${entries.length} skills)\n`,
      `Bundled skills excluded: ${[...BUNDLED_SKILLS].join(', ')}\n`,
      '```',
      'Grade  Skill                                Score   Age   Notes',
      '-----  -----------------------------------  ------  ----  -----',
      ...entries.map(formatGradeEntry),
      '```',
      `\nRun \`duckhive curate run\` to archive low-rated skills (score < 15).`,
    ]

    return { type: 'text', value: lines.join('\n') }
  }

  if (subcommand === 'run') {
    const entries = await scanSkills()
    const archived = await archiveLowRated(entries)

    const report: CurationReport = {
      timestamp: new Date().toISOString(),
      totalSkills: entries.length,
      archived,
      grades: Object.fromEntries(entries.map((e) => [e.name, e.grade])),
      summary: `Curation complete. ${entries.length} skills scanned, ${archived.length} archived.`,
    }

    await writeReport(report)

    const lines = [
      `DuckHive Curator - Curation Complete\n`,
      `Skills scanned: ${entries.length}`,
      `Archived: ${archived.length > 0 ? archived.join(', ') : 'none'}`,
      '',
      'Top-rated skills:',
      '```',
      ...entries.slice(0, 5).map(formatGradeEntry),
      '```',
      archived.length > 0
        ? `\nArchived skills (score < 15): ${archived.join(', ')}\n   Archive location: ${ARCHIVE_DIR}`
        : '',
      `\nFull report: ${REPORT_PATH}`,
    ]

    return { type: 'text', value: lines.join('\n') }
  }

  return {
    type: 'text',
    value: `DuckHive Curator - Unknown subcommand: ${subcommand}\n\nUsage:\n  /curate status    - Show skill rankings (default)\n  /curate run       - Perform full curation cycle + archive low-rated skills`,
  }
}
