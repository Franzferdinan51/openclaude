import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve, sep } from 'node:path'
import { unzip } from 'fflate'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

export type ClawHubSearchResult = {
  slug: string
  displayName: string
  summary: string | null
  score?: number | null
  version?: string | null
  updatedAt?: number | null
  ownerHandle?: string | null
}

export type ClawHubSkillDetail = {
  slug: string
  displayName: string
  summary: string | null
  latestVersion: string | null
  changelog: string | null
  updatedAt?: number | null
  ownerHandle?: string | null
  ownerDisplayName?: string | null
  metadata?: Record<string, unknown> | null
  moderation?: ClawHubModeration | null
}

export type ClawHubModeration = {
  isSuspicious: boolean
  isMalwareBlocked: boolean
  verdict?: 'clean' | 'suspicious' | 'malicious' | null
  reasonCodes?: string[] | null
  updatedAt?: number | null
  engineVersion?: string | null
  summary?: string | null
}

type SearchResponse = {
  results?: Array<{
    slug: string
    displayName?: string | null
    summary?: string | null
    score?: number | null
    version?: string | null
    updatedAt?: number | null
    ownerHandle?: string | null
  }>
}

type DetailResponse = {
  skill?: {
    slug: string
    displayName?: string | null
    summary?: string | null
    updatedAt?: number | null
  }
  latestVersion?: {
    version?: string | null
    changelog?: string | null
  }
  owner?: {
    handle?: string | null
    displayName?: string | null
  }
  metadata?: Record<string, unknown> | null
  moderation?: ClawHubModeration | null
}

type OriginMetadata = {
  source: 'clawhub'
  slug: string
  registry: string
  installedAt: string
  latestVersion: string | null
}

const DEFAULT_CLAWHUB_REGISTRY = 'https://clawhub.ai'
const CLAWHUB_SKILL_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/i

type ClawHubDeps = {
  fetchImpl: typeof fetch
  getConfigHomeDir: () => string
}

let clawHubDeps: ClawHubDeps = {
  fetchImpl: fetch,
  getConfigHomeDir: getClaudeConfigHomeDir,
}

export function setClawHubSkillServiceTestDeps(
  overrides: Partial<ClawHubDeps> | null,
): void {
  clawHubDeps = {
    fetchImpl: fetch,
    getConfigHomeDir: getClaudeConfigHomeDir,
    ...(overrides ?? {}),
  }
}

export function getClawHubRegistryUrl(): string {
  return (
    process.env.DUCKHIVE_CLAWHUB_REGISTRY?.trim() ||
    process.env.CLAWHUB_REGISTRY?.trim() ||
    DEFAULT_CLAWHUB_REGISTRY
  ).replace(/\/+$/, '')
}

function getInstalledSkillsRoot(): string {
  return join(clawHubDeps.getConfigHomeDir(), 'skills')
}

function getInstalledSkillDir(slug: string): string {
  assertValidClawHubSkillSlug(slug)
  return join(getInstalledSkillsRoot(), slug)
}

export function assertValidClawHubSkillSlug(slug: string): void {
  if (!CLAWHUB_SKILL_SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Invalid ClawHub skill slug: ${slug}. Use letters, numbers, dots, underscores, and hyphens only.`,
    )
  }
}

function assertSafeZipRelativePath(relativePath: string): string {
  const normalized = normalize(relativePath.replace(/\\/g, '/'))
  if (
    !normalized ||
    normalized.startsWith('..') ||
    normalized.includes('/../') ||
    normalized.startsWith('/') ||
    normalized.includes(':\u005c') ||
    normalized.includes(':/')
  ) {
    throw new Error(`Unsafe skill archive path: ${relativePath}`)
  }
  return normalized
}

async function ensureSkillDoesNotAlreadyExist(skillDir: string): Promise<void> {
  try {
    await stat(skillDir)
    throw new Error(
      `Skill already exists locally: ${skillDir}. Delete it first if you want to reinstall.`,
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw error
  }
}

async function writeZipArchiveIntoSkillDir(
  slug: string,
  zipBytes: Uint8Array,
  origin: OriginMetadata,
): Promise<string> {
  const skillDir = getInstalledSkillDir(slug)
  await ensureSkillDoesNotAlreadyExist(skillDir)
  await mkdir(skillDir, { recursive: true })

  try {
    const archive = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(zipBytes, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
    for (const [relativePath, content] of Object.entries(archive)) {
      const safePath = assertSafeZipRelativePath(relativePath)
      const destination = resolve(skillDir, safePath)
      if (
        destination !== skillDir &&
        !destination.startsWith(`${skillDir}${sep}`)
      ) {
        throw new Error(`Unsafe extracted path: ${relativePath}`)
      }
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, Buffer.from(content))
    }

    const skillPath = join(skillDir, 'SKILL.md')
    try {
      const skillFile = await stat(skillPath)
      if (!skillFile.isFile()) {
        throw new Error()
      }
    } catch {
      throw new Error(
        `Invalid ClawHub skill archive for "${slug}": missing root SKILL.md.`,
      )
    }

    const originPath = join(skillDir, '.clawhub', 'origin.json')
    await mkdir(dirname(originPath), { recursive: true })
    await writeFile(originPath, JSON.stringify(origin, null, 2), 'utf8')
    return skillPath
  } catch (error) {
    await rm(skillDir, { recursive: true, force: true })
    throw error
  }
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await clawHubDeps.fetchImpl(
    `${getClawHubRegistryUrl()}${path}`,
    init,
  )
  if (!response.ok) {
    throw new Error(`ClawHub request failed (${response.status})`)
  }
  return (await response.json()) as T
}

export async function searchClawHubSkills(
  query: string,
  limit = 8,
): Promise<ClawHubSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const params = new URLSearchParams({
    q: trimmed,
    limit: String(limit),
  })
  const response = await getJson<SearchResponse>(`/api/v1/search?${params}`)
  return (response.results ?? []).map(result => ({
    slug: result.slug,
    displayName: result.displayName ?? result.slug,
    summary: result.summary ?? null,
    score: result.score ?? null,
    version: result.version ?? null,
    updatedAt: result.updatedAt ?? null,
    ownerHandle: result.ownerHandle ?? null,
  }))
}

export async function inspectClawHubSkill(
  slug: string,
): Promise<ClawHubSkillDetail> {
  assertValidClawHubSkillSlug(slug)
  const response = await getJson<DetailResponse>(
    `/api/v1/skills/${encodeURIComponent(slug)}`,
  )
  if (!response.skill) {
    throw new Error(`ClawHub skill not found: ${slug}`)
  }
  return {
    slug: response.skill.slug,
    displayName: response.skill.displayName ?? response.skill.slug,
    summary: response.skill.summary ?? null,
    latestVersion: response.latestVersion?.version ?? null,
    changelog: response.latestVersion?.changelog ?? null,
    updatedAt: response.skill.updatedAt ?? null,
    ownerHandle: response.owner?.handle ?? null,
    ownerDisplayName: response.owner?.displayName ?? null,
    metadata: response.metadata ?? null,
    moderation: response.moderation ?? null,
  }
}

export async function installClawHubSkill(
  slug: string,
): Promise<{ skillPath: string; version: string | null }> {
  assertValidClawHubSkillSlug(slug)
  const detail = await inspectClawHubSkill(slug)
  const verdict = detail.moderation?.verdict
  if (
    detail.moderation?.isMalwareBlocked ||
    verdict === 'malicious'
  ) {
    throw new Error(
      `Refusing to install ClawHub skill "${slug}" because the registry moderation verdict is ${verdict ?? 'blocked'}.`,
    )
  }
  const response = await clawHubDeps.fetchImpl(
    `${getClawHubRegistryUrl()}/api/v1/download?slug=${encodeURIComponent(slug)}`,
  )
  if (!response.ok) {
    throw new Error(`ClawHub download failed (${response.status})`)
  }
  const archive = new Uint8Array(await response.arrayBuffer())
  const skillPath = await writeZipArchiveIntoSkillDir(slug, archive, {
    source: 'clawhub',
    slug,
    registry: getClawHubRegistryUrl(),
    installedAt: new Date().toISOString(),
    latestVersion: detail.latestVersion,
  })
  return { skillPath, version: detail.latestVersion }
}

export async function readInstalledClawHubOrigin(
  slug: string,
): Promise<OriginMetadata | null> {
  assertValidClawHubSkillSlug(slug)
  const originPath = join(getInstalledSkillDir(slug), '.clawhub', 'origin.json')
  try {
    const raw = await readFile(originPath, 'utf8')
    return JSON.parse(raw) as OriginMetadata
  } catch {
    return null
  }
}
