// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs'
import { resolve, join, basename } from 'path'
import { DESCRIPTION } from './prompt.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { unzipFile } from '../../utils/dxt/zip.js'

const sessionExportDeps: {
  getClaudeConfigHomeDir: () => string
} = {
  getClaudeConfigHomeDir,
}

export function setSessionExportToolTestDeps(
  overrides: Partial<typeof sessionExportDeps> | null,
): void {
  Object.assign(sessionExportDeps, {
    getClaudeConfigHomeDir,
    ...(overrides ?? {}),
  })
}

export function getSessionExportBaseDir(
  configHomeDir = sessionExportDeps.getClaudeConfigHomeDir(),
): string {
  return configHomeDir
}

export function getSessionExportsDir(
  configHomeDir = sessionExportDeps.getClaudeConfigHomeDir(),
): string {
  return join(getSessionExportBaseDir(configHomeDir), 'exports')
}

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z
      .enum(['export', 'import', 'list', 'share'])
      .describe('Session export action'),
    sessionName: z.string().optional().describe('Name for export/import session'),
    sessionPath: z.string().optional().describe('Path to session zip (import/share actions)'),
    workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
    upload: z.boolean().optional().describe('Whether to upload/share the package (share action)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    action: z.string(),
    zipPath: z.string().optional(),
    sessions: z
      .array(
        z.object({
          name: z.string(),
          path: z.string(),
          date: z.string(),
          size: z.string(),
        }),
      )
      .optional(),
    imported: z.boolean().optional(),
    error: z.string().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

interface SessionMeta {
  name: string
  createdAt: string
  workspaceRoot: string
  model: string
  provider: string
  tools: string[]
}

type LegacyHistoryEntry =
  | string
  | {
      display?: unknown
      pastedContents?: unknown
      timestamp?: unknown
      project?: unknown
      sessionId?: unknown
    }

type ExportEntry = {
  sourcePath: string
  zipPath: string
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function resolveInsideDir(baseDir: string, relativePath: string): string | null {
  const resolvedBaseDir = resolve(baseDir)
  const destination = resolve(resolvedBaseDir, relativePath)
  const prefix = resolvedBaseDir.endsWith('\\') || resolvedBaseDir.endsWith('/')
    ? resolvedBaseDir
    : `${resolvedBaseDir}${process.platform === 'win32' ? '\\' : '/'}`

  if (destination === resolvedBaseDir || destination.startsWith(prefix)) {
    return destination
  }

  return null
}

function collectExportFile(entry: ExportEntry): Uint8Array | null {
  if (!existsSync(entry.sourcePath)) return null
  try {
    return new Uint8Array(readFileSync(entry.sourcePath))
  } catch {
    return null
  }
}

function trimHistoryJsonl(raw: string, maxEntries = 100): string {
  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  return lines.slice(-maxEntries).join('\n')
}

function mergeJsonlHistory(
  existingRaw: string,
  importedRaw: string,
  maxEntries = 500,
): string {
  const merged = new Set<string>()
  for (const line of [...existingRaw.split(/\r?\n/), ...importedRaw.split(/\r?\n/)]) {
    const trimmed = line.trim()
    if (!trimmed) continue
    merged.add(trimmed)
  }
  return Array.from(merged).slice(-maxEntries).join('\n')
}

function convertLegacyHistoryJsonToJsonl(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as LegacyHistoryEntry[] | LegacyHistoryEntry
    const entries = Array.isArray(parsed) ? parsed : [parsed]
    const now = Date.now()
    const lines = entries
      .map((entry, index) => {
        if (typeof entry === 'string') {
          return JSON.stringify({
            display: entry,
            pastedContents: {},
            timestamp: now + index,
          })
        }
        if (!entry || typeof entry !== 'object') {
          return null
        }
        const display =
          typeof entry.display === 'string'
            ? entry.display
            : JSON.stringify(entry.display ?? '')
        return JSON.stringify({
          display,
          pastedContents:
            entry.pastedContents &&
            typeof entry.pastedContents === 'object' &&
            !Array.isArray(entry.pastedContents)
              ? entry.pastedContents
              : {},
          timestamp:
            typeof entry.timestamp === 'number' ? entry.timestamp : now + index,
          ...(typeof entry.project === 'string' ? { project: entry.project } : {}),
          ...(typeof entry.sessionId === 'string'
            ? { sessionId: entry.sessionId }
            : {}),
        })
      })
      .filter((line): line is string => Boolean(line))

    return lines.length > 0 ? lines.join('\n') : null
  } catch {
    return null
  }
}

async function createZip(
  contents: ExportEntry[],
  outZipPath: string,
): Promise<void> {
  const zipEntries: Record<string, Uint8Array> = {}

  for (const entry of contents) {
    const data = collectExportFile(entry)
    if (data) {
      zipEntries[entry.zipPath] = data
    }
  }

  const { zipSync } = await import('fflate')
  const zipped = zipSync(zipEntries, { level: 6 })
  writeFileSync(outZipPath, zipped)
}

async function extractZip(zipPath: string, outDir: string): Promise<void> {
  ensureDir(outDir)
  const zipData = readFileSync(zipPath)
  const extracted = await unzipFile(zipData)
  for (const [relativePath, data] of Object.entries(extracted)) {
    const destination = resolveInsideDir(outDir, relativePath)
    if (!destination) {
      throw new Error(`Unsafe path in session archive: ${relativePath}`)
    }
    ensureDir(resolve(destination, '..'))
    writeFileSync(destination, data)
  }
}

async function buildSessionZip(
  workspaceRoot: string,
  sessionName: string,
): Promise<string> {
  const configHomeDir = getSessionExportBaseDir()
  const exportsDir = getSessionExportsDir()
  ensureDir(exportsDir)
  ensureDir(configHomeDir)

  const safeName = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const zipName = `session_${safeName}_${Date.now()}.zip`
  const zipPath = resolve(exportsDir, zipName)

  const contents: ExportEntry[] = []

  const meta: SessionMeta = {
    name: sessionName,
    createdAt: new Date().toISOString(),
    workspaceRoot,
    model: process.env.MODEL ?? 'unknown',
    provider: process.env.PROVIDER ?? 'unknown',
    tools: [],
  }
  const metaPath = join(configHomeDir, 'tmp_meta.json')
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8')
  contents.push({ sourcePath: metaPath, zipPath: 'session.json' })

  for (const fileName of ['AGENTS.md', 'SOUL.md', 'TOOLS.md'] as const) {
    const filePath = resolve(workspaceRoot, fileName)
    if (existsSync(filePath)) {
      contents.push({ sourcePath: filePath, zipPath: fileName })
    }
  }

  const configPath = resolve(configHomeDir, 'config.json')
  if (existsSync(configPath)) {
    contents.push({
      sourcePath: configPath,
      zipPath: 'duckhive_config.json',
    })
  }

  const historyJsonlPath = join(configHomeDir, 'history.jsonl')
  if (existsSync(historyJsonlPath)) {
    try {
      const raw = readFileSync(historyJsonlPath, 'utf8')
      const trimmed = trimHistoryJsonl(raw)
      if (trimmed) {
        const trimmedPath = join(configHomeDir, 'tmp_history.jsonl')
        writeFileSync(trimmedPath, `${trimmed}\n`, 'utf8')
        contents.push({ sourcePath: trimmedPath, zipPath: 'history.jsonl' })
      }
    } catch {
      // Ignore malformed history for export.
    }
  } else {
    const legacyHistoryPath = join(configHomeDir, 'history.json')
    if (existsSync(legacyHistoryPath)) {
      try {
        const raw = readFileSync(legacyHistoryPath, 'utf8')
        const parsed = JSON.parse(raw)
        const trimmed = Array.isArray(parsed) ? parsed.slice(-100) : parsed
        const trimmedPath = join(configHomeDir, 'tmp_history.json')
        writeFileSync(trimmedPath, JSON.stringify(trimmed, null, 2), 'utf8')
        contents.push({ sourcePath: trimmedPath, zipPath: 'history.json' })
      } catch {
        // Ignore malformed history for export.
      }
    }
  }

  await createZip(contents, zipPath)

  try {
    const { unlinkSync } = await import('fs')
    for (const filePath of [
      metaPath,
      join(configHomeDir, 'tmp_history.json'),
      join(configHomeDir, 'tmp_history.jsonl'),
    ]) {
      if (existsSync(filePath)) unlinkSync(filePath)
    }
  } catch {
    // Ignore temp cleanup failures.
  }

  return zipPath
}

export const SessionExportTool = buildTool({
  name: 'session_export',
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return DESCRIPTION
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly(input) {
    return input.action === 'list'
  },
  mapToolResultToToolResultBlockParam(data: Output, toolUseID: string) {
    if (data.success) {
      const parts: string[] = []
      if (data.action === 'export' && data.zipPath) {
        parts.push(`Session exported: ${data.zipPath}`)
      }
      if (data.action === 'list' && data.sessions) {
        parts.push('Exported sessions:')
        for (const session of data.sessions) {
          parts.push(`  ${session.name} - ${session.size} - ${session.date}`)
        }
      }
      if (data.action === 'import' && data.imported) {
        parts.push('Session imported successfully into workspace and DuckHive config home')
      }
      return {
        tool_use_id: toolUseID,
        type: 'tool_result' as const,
        content: parts.length > 0 ? parts.join('\n') : JSON.stringify(data),
      }
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: `Error: ${data.error ?? 'unknown error'}`,
      is_error: true,
    }
  },
  async call(input, context, canUseTool, parentMessage) {
    const { action, sessionName, sessionPath, workspaceRoot } = input
    const root = workspaceRoot ?? process.cwd()
    const configHomeDir = getSessionExportBaseDir()
    const exportsDir = getSessionExportsDir()

    ensureDir(exportsDir)
    ensureDir(configHomeDir)

    switch (action) {
      case 'export': {
        const name = sessionName ?? basename(root)
        const zipPath = await buildSessionZip(root, name)
        return { data: { success: true, action: 'export', zipPath } }
      }

      case 'list': {
        const files = readdirSync(exportsDir).filter(f => f.endsWith('.zip'))
        const sessions = files
          .map(f => {
            const fullPath = resolve(exportsDir, f)
            const stat = statSync(fullPath)
            const size =
              stat.size > 1024 * 1024
                ? `${(stat.size / 1024 / 1024).toFixed(1)}MB`
                : `${(stat.size / 1024).toFixed(0)}KB`
            const date = stat.mtime.toISOString().split('T')[0] ?? 'unknown'
            const name = f
              .replace('.zip', '')
              .replace(/^session_/, '')
              .replace(/_\d+$/, '')
            return { name, path: fullPath, date, size }
          })
          .sort((a, b) => b.date.localeCompare(a.date))
        return { data: { success: true, action: 'list', sessions } }
      }

      case 'import': {
        if (!sessionPath) {
          return {
            data: {
              success: false,
              action: 'import',
              error: 'sessionPath required for import',
            },
          }
        }
        const zipPath = existsSync(sessionPath)
          ? sessionPath
          : resolve(exportsDir, sessionPath)
        if (!existsSync(zipPath)) {
          return {
            data: {
              success: false,
              action: 'import',
              error: `Session zip not found: ${zipPath}`,
            },
          }
        }

        const extractDir = join(configHomeDir, 'imports', `import_${Date.now()}`)
        try {
          await extractZip(zipPath, extractDir)
        } catch (e) {
          return {
            data: {
              success: false,
              action: 'import',
              error: `Failed to extract zip: ${e instanceof Error ? e.message : String(e)}`,
            },
          }
        }

        let imported = false
        for (const file of [
          'AGENTS.md',
          'SOUL.md',
          'TOOLS.md',
          'session.json',
          'history.jsonl',
          'history.json',
          'duckhive_config.json',
        ] as const) {
          const src = resolve(extractDir, file)
          if (!existsSync(src)) continue
          if (file === 'duckhive_config.json') {
            const targetConfig = resolve(configHomeDir, 'config.json')
            try {
              const existingConfig = existsSync(targetConfig)
                ? JSON.parse(readFileSync(targetConfig, 'utf8'))
                : {}
              const newConfig = JSON.parse(readFileSync(src, 'utf8'))
              writeFileSync(
                targetConfig,
                JSON.stringify({ ...existingConfig, ...newConfig }, null, 2),
                'utf8',
              )
            } catch {
              writeFileSync(targetConfig, readFileSync(src, 'utf8'), 'utf8')
            }
          } else if (file === 'history.jsonl') {
            const targetHistory = resolve(configHomeDir, 'history.jsonl')
            const importedHistory = readFileSync(src, 'utf8')
            const mergedHistory = existsSync(targetHistory)
              ? mergeJsonlHistory(
                  readFileSync(targetHistory, 'utf8'),
                  importedHistory,
                )
              : trimHistoryJsonl(importedHistory, 500)
            writeFileSync(
              targetHistory,
              mergedHistory ? `${mergedHistory}\n` : '',
              'utf8',
            )
          } else if (file === 'history.json') {
            const converted = convertLegacyHistoryJsonToJsonl(
              readFileSync(src, 'utf8'),
            )
            if (converted) {
              const targetHistory = resolve(configHomeDir, 'history.jsonl')
              const mergedHistory = existsSync(targetHistory)
                ? mergeJsonlHistory(
                    readFileSync(targetHistory, 'utf8'),
                    converted,
                  )
                : converted
              writeFileSync(
                targetHistory,
                mergedHistory ? `${mergedHistory}\n` : '',
                'utf8',
              )
            }
            writeFileSync(
              resolve(configHomeDir, 'history.json'),
              readFileSync(src, 'utf8'),
              'utf8',
            )
          } else {
            const dest = resolve(root, file)
            writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8')
          }
          imported = true
        }

        try {
          const { rmSync } = await import('fs')
          rmSync(extractDir, { recursive: true, force: true })
        } catch {
          // Ignore cleanup failures.
        }

        return { data: { success: true, action: 'import', imported } }
      }

      case 'share': {
        if (!sessionPath) {
          return {
            data: {
              success: false,
              action: 'share',
              error: 'sessionPath required for share',
            },
          }
        }
        const zipPath = existsSync(sessionPath)
          ? sessionPath
          : resolve(exportsDir, sessionPath)
        if (!existsSync(zipPath)) {
          return {
            data: {
              success: false,
              action: 'share',
              error: `Session zip not found: ${zipPath}`,
            },
          }
        }

        const shareUrl = `file://${zipPath}`
        return { data: { success: true, action: 'share', zipPath: shareUrl } }
      }

      default:
        return {
          data: { success: false, action, error: `Unknown action: ${action}` },
        }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
