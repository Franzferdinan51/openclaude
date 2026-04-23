import type { LocalCommandCall } from '../../types/command.js'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'
import { findGitRoot } from '../../utils/git.js'
import { getCwd } from '../../utils/cwd.js'

interface PrSizeResult {
  type: 'text'
  value: string
}

interface DiffStats {
  filesChanged: number
  insertions: number
  deletions: number
  files: Array<{ path: string; additions: number; deletions: number }>
}

interface SizeClassification {
  label: string
  emoji: string
}

const SIZE_THRESHOLDS = {
  xs: { files: 1, lines: 10 },
  small: { files: 5, lines: 50 },
  medium: { files: 15, lines: 200 },
  large: { files: 30, lines: 500 },
}

const SIZE_MAP: Record<string, SizeClassification> = {
  xs: { label: 'XS (tiny)', emoji: '[~]' },
  small: { label: 'Small', emoji: '[+]' },
  medium: { label: 'Medium', emoji: '[*]' },
  large: { label: 'Large', emoji: '[-]' },
  xl: { label: 'XL (massive)', emoji: '[x]' },
}

function classifySize(stats: DiffStats): SizeClassification {
  const { filesChanged, insertions, deletions } = stats
  const totalLines = insertions + deletions

  if (filesChanged === 0) return SIZE_MAP.xs
  if (filesChanged <= SIZE_THRESHOLDS.xs.files && totalLines <= SIZE_THRESHOLDS.xs.lines)
    return SIZE_MAP.xs
  if (filesChanged <= SIZE_THRESHOLDS.small.files && totalLines <= SIZE_THRESHOLDS.small.lines)
    return SIZE_MAP.small
  if (filesChanged <= SIZE_THRESHOLDS.medium.files && totalLines <= SIZE_THRESHOLDS.medium.lines)
    return SIZE_MAP.medium
  if (filesChanged <= SIZE_THRESHOLDS.large.files && totalLines <= SIZE_THRESHOLDS.large.lines)
    return SIZE_MAP.large
  return SIZE_MAP.xl
}

function renderSizeReport(
  stats: DiffStats,
  size: SizeClassification,
  baseBranch: string,
): string {
  const lines: string[] = []

  lines.push('' + size.emoji + ' PR Size: ' + size.label)
  lines.push('Files:       ' + stats.filesChanged)
  lines.push('Insertions: ' + (stats.insertions > 0 ? '+' + stats.insertions : 0))
  lines.push('Deletions:  ' + (stats.deletions > 0 ? '-' + stats.deletions : 0))
  lines.push('Total:      ' + (stats.insertions + stats.deletions) + ' lines')
  lines.push('Base:       ' + baseBranch)

  if (stats.files.length > 0) {
    lines.push('[*] Largest files:')
    const sorted = [...stats.files].sort(
      (a, b) => b.additions + b.deletions - (a.additions + a.deletions),
    )
    for (const file of sorted.slice(0, 5)) {
      const pct = ((file.additions + file.deletions) / (stats.insertions + stats.deletions + 1)) * 100
      const addStr = file.additions > 0 ? '+' + file.additions : '0'
      const delStr = file.deletions > 0 ? '-' + file.deletions : '0'
      lines.push('  ' + addStr + ' ' + delStr + '  ' + file.path + ' (' + pct.toFixed(0) + '%)')
    }
  }

  return lines.join('\n')
}

async function getDiffStats(baseBranch: string): Promise<DiffStats | null> {
  const { stdout } = await execFileNoThrow('git', ['diff', '--numstat', baseBranch])

  if (!stdout) return null

  const files: DiffStats['files'] = []
  let insertions = 0
  let deletions = 0

  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue

    const add = parts[0]
    const del = parts[1]
    const path = parts[2]
    const addNum = parseInt(add, 10) || 0
    const delNum = parseInt(del, 10) || 0

    insertions += addNum
    deletions += delNum
    files.push({ path, additions: addNum, deletions: delNum })
  }

  return {
    filesChanged: files.length,
    insertions,
    deletions,
    files,
  }
}

async function getBaseBranch(): Promise<string> {
  const root = findGitRoot(getCwd())
  if (!root) return 'origin/main'

  // Try to detect current branch
  const { stdout } = await execFileNoThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = stdout?.trim()
  if (branch && branch !== 'HEAD') {
    const { stdout: upstream } = await execFileNoThrow(
      'git',
      ['rev-parse', '--abbrev-ref', branch + '@{upstream}'],
    )
    if (upstream?.trim()) return upstream.trim()
  }

  // Fall back to origin/main or origin/master
  for (const fallback of ['origin/main', 'origin/master', 'main', 'master']) {
    const { stdout: verified } = await execFileNoThrow(
      'git',
      ['rev-parse', '--verify', fallback],
    )
    if (verified?.trim()) return fallback
  }

  return 'origin/main'
}

export const call: LocalCommandCall = async (args: string): Promise<PrSizeResult> => {
  const parsedArgs = args.trim().split(/\s+/).filter(Boolean)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (const arg of parsedArgs) {
    if (arg.startsWith('--')) {
      const idx = arg.indexOf('=')
      if (idx !== -1) {
        flags[arg.substring(2, idx)] = arg.substring(idx + 1)
      } else {
        flags[arg.substring(2)] = true
      }
    } else {
      positional.push(arg)
    }
  }

  const baseFlag = typeof flags.base === 'string' ? flags.base : undefined
  const baseBranch = baseFlag ?? (await getBaseBranch())

  const stats = await getDiffStats(baseBranch)
  if (!stats || stats.filesChanged === 0) {
    return {
      type: 'text',
      value: 'No diff found. Are you on a feature branch with changes?',
    }
  }

  const size = classifySize(stats)
  return {
    type: 'text',
    value: renderSizeReport(stats, size, baseBranch),
  }
}
