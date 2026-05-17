import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve, sep } from 'node:path'
import { unzipSync } from 'fflate'
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
}

type OriginMetadata = {
  source: 'clawhub'
  slug: string
  registry: string
  installedAt: string
  latestVersion: string | null
}

const DEFAULT_CLAWHUB_REGISTRY = 'https://clawhub.ai'

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
  return join(getInstalledSkillsRoot(), slug)
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
    const archive = unzipSync(zipBytes)
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

    const originPath = join(skillDir, '.clawhub', 'origin.json')
    await mkdir(dirname(originPath), { recursive: true })
    await writeFile(originPath, JSON.stringify(origin, null, 2), 'utf8')
    return join(skillDir, 'SKILL.md')
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
  }
}

export async function installClawHubSkill(
  slug: string,
): Promise<{ skillPath: string; version: string | null }> {
  const detail = await inspectClawHubSkill(slug)
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
  const originPath = join(getInstalledSkillDir(slug), '.clawhub', 'origin.json')
  try {
    const raw = await readFile(originPath, 'utf8')
    return JSON.parse(raw) as OriginMetadata
  } catch {
    return null
  }
}
