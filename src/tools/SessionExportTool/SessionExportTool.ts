// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, createReadStream, createWriteStream } from 'fs'
import { resolve, join, basename, extname } from 'path'
import { execSync } from 'child_process'
import { DESCRIPTION } from './prompt.js'

const DUCKHIVE_DIR = join(process.env.HOME ?? '~', '.duckhive')
const EXPORTS_DIR = join(DUCKHIVE_DIR, 'exports')

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['export', 'import', 'list', 'share']).describe('Session export action'),
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
    sessions: z.array(z.object({ name: z.string(), path: z.string(), date: z.string(), size: z.string() })).optional(),
    imported: z.boolean().optional(),
    error: z.string().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

// ─── Zip helpers using native commands (macOS/Unix) ───────────────────────────

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

async function createZip(contents: { path: string; zipPath: string }[], outZipPath: string): Promise<void> {
  // Use native zip command
  const tempDir = join(DUCKHIVE_DIR, 'tmp', `export_${Date.now()}`)
  ensureDir(tempDir)

  for (const { path, zipPath } of contents) {
    const dest = join(tempDir, zipPath)
    const destDir = resolve(dest, '..')
    ensureDir(destDir)
    try {
      if (existsSync(path)) {
        execSync(`cp -r "${path}" "${dest}"`)
      }
    } catch { /* skip files that fail to copy */ }
  }

  // Create zip
  const zipCmd = `cd "${tempDir}" && zip -r "${outZipPath}" . && rm -rf "${tempDir}"`
  execSync(zipCmd, { stdio: 'pipe' })
}

async function extractZip(zipPath: string, outDir: string): Promise<void> {
  ensureDir(outDir)
  execSync(`unzip -o "${zipPath}" -d "${outDir}"`, { stdio: 'pipe' })
}

// ─── Session packing ──────────────────────────────────────────────────────────

interface SessionMeta {
  name: string
  createdAt: string
  workspaceRoot: string
  model: string
  provider: string
  tools: string[]
}

async function buildSessionZip(workspaceRoot: string, sessionName: string): Promise<string> {
  ensureDir(EXPORTS_DIR)

  const safeName = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const zipName = `session_${safeName}_${Date.now()}.zip`
  const zipPath = resolve(EXPORTS_DIR, zipName)

  // Gather files to package
  const contents: { path: string; zipPath: string }[] = []

  // Session metadata
  const meta: SessionMeta = {
    name: sessionName,
    createdAt: new Date().toISOString(),
    workspaceRoot,
    model: process.env.MODEL ?? 'unknown',
    provider: process.env.PROVIDER ?? 'unknown',
    tools: [],
  }
  const metaPath = join(DUCKHIVE_DIR, 'tmp_meta.json')
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8')
  contents.push({ path: metaPath, zipPath: 'session.json' })

  // AGENTS.md if exists
  const agentsPath = resolve(workspaceRoot, 'AGENTS.md')
  if (existsSync(agentsPath)) contents.push({ path: agentsPath, zipPath: 'AGENTS.md' })

  // SOUL.md if exists
  const soulPath = resolve(workspaceRoot, 'SOUL.md')
  if (existsSync(soulPath)) contents.push({ path: soulPath, zipPath: 'SOUL.md' })

  // TOOLS.md if exists
  const toolsPath = resolve(workspaceRoot, 'TOOLS.md')
  if (existsSync(toolsPath)) contents.push({ path: toolsPath, zipPath: 'TOOLS.md' })

  // DuckHive config
  const configPath = resolve(DUCKHIVE_DIR, 'config.json')
  if (existsSync(configPath)) contents.push({ path: configPath, zipPath: 'duckhive_config.json' })

  // Read recent history if available
  const historyPath = join(DUCKHIVE_DIR, 'history.json')
  if (existsSync(historyPath)) {
    try {
      const raw = readFileSync(historyPath, 'utf8')
      const parsed = JSON.parse(raw)
      // Only include last 100 entries to keep zip manageable
      const trimmed = Array.isArray(parsed) ? parsed.slice(-100) : parsed
      const trimmedPath = join(DUCKHIVE_DIR, 'tmp_history.json')
      writeFileSync(trimmedPath, JSON.stringify(trimmed, null, 2), 'utf8')
      contents.push({ path: trimmedPath, zipPath: 'history.json' })
    } catch { /* ignore history read errors */ }
  }

  await createZip(contents, zipPath)

  // Clean up temp files
  try {
    const { unlinkSync, rmSync } = await import('fs')
    const tmpFiles = [metaPath]
    for (const f of tmpFiles) {
      if (existsSync(f)) unlinkSync(f)
    }
    const tmpDir = join(DUCKHIVE_DIR, 'tmp')
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
  } catch { /* ignore cleanup errors */ }

  return zipPath
}

// ─── Main tool ────────────────────────────────────────────────────────────────

export const SessionExportTool = buildTool({
  name: 'session_export',
  async description() { return DESCRIPTION },
  async prompt() { return DESCRIPTION },
  get inputSchema(): InputSchema { return inputSchema() },
  get outputSchema(): OutputSchema { return outputSchema() },
  isConcurrencySafe() { return false },
  isReadOnly(input) { return input.action === 'list' },
  mapToolResultToToolResultBlockParam(data: Output, toolUseID: string) {
    if (data.success) {
      const parts: string[] = []
      if (data.action === 'export' && data.zipPath) {
        parts.push(`✅ Session exported: ${data.zipPath}`)
      }
      if (data.action === 'list' && data.sessions) {
        parts.push('**Exported sessions:**')
        for (const s of data.sessions) {
          parts.push(`  📦 ${s.name} — ${s.size} — ${s.date}`)
        }
      }
      if (data.action === 'import' && data.imported) {
        parts.push('✅ Session imported successfully into workspace')
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
    const { action, sessionName, sessionPath, workspaceRoot, upload } = input
    const root = workspaceRoot ?? process.cwd()

    ensureDir(EXPORTS_DIR)
    ensureDir(DUCKHIVE_DIR)

    switch (action) {
      case 'export': {
        const name = sessionName ?? basename(root)
        const zipPath = await buildSessionZip(root, name)
        return { data: { success: true, action: 'export', zipPath } }
      }

      case 'list': {
        const files = readdirSync(EXPORTS_DIR).filter(f => f.endsWith('.zip'))
        const sessions = files.map(f => {
          const fullPath = resolve(EXPORTS_DIR, f)
          let size = 'unknown'
          try {
            const stat = require('fs').statSync(fullPath)
            size = stat.size > 1024 * 1024 ? `${(stat.size / 1024 / 1024).toFixed(1)}MB` : `${(stat.size / 1024).toFixed(0)}KB`
          } catch { /* ignore */ }
          const stat = require('fs').statSync(fullPath)
          const date = stat.mtime.toISOString().split('T')[0] ?? 'unknown'
          const name = f.replace('.zip', '').replace(/^session_/, '').replace(/_\d+$/, '')
          return { name, path: fullPath, date, size }
        }).sort((a, b) => b.date.localeCompare(a.date))
        return { data: { success: true, action: 'list', sessions } }
      }

      case 'import': {
        if (!sessionPath) return { data: { success: false, action: 'import', error: 'sessionPath required for import' } }
        const zipPath = existsSync(sessionPath) ? sessionPath : resolve(EXPORTS_DIR, sessionPath)
        if (!existsSync(zipPath)) return { data: { success: false, action: 'import', error: `Session zip not found: ${zipPath}` } }

        const extractDir = join(DUCKHIVE_DIR, 'imports', `import_${Date.now()}`)
        try {
          await extractZip(zipPath, extractDir)
        } catch (e) {
          return { data: { success: false, action: 'import', error: `Failed to extract zip: ${e instanceof Error ? e.message : String(e)}` } }
        }

        // Copy files to workspace
        let imported = false
        for (const file of ['AGENTS.md', 'SOUL.md', 'TOOLS.md', 'session.json', 'history.json', 'duckhive_config.json'] as const) {
          const src = resolve(extractDir, file)
          if (existsSync(src)) {
            if (file === 'duckhive_config.json') {
              // Merge config instead of overwriting
              const targetConfig = resolve(DUCKHIVE_DIR, 'config.json')
              try {
                const existingConfig = existsSync(targetConfig) ? JSON.parse(readFileSync(targetConfig, 'utf8')) : {}
                const newConfig = JSON.parse(readFileSync(src, 'utf8'))
                writeFileSync(targetConfig, JSON.stringify({ ...existingConfig, ...newConfig }, null, 2), 'utf8')
              } catch { writeFileSync(targetConfig, readFileSync(src, 'utf8'), 'utf8') }
            } else {
              const dest = resolve(root, file)
              writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8')
            }
            imported = true
          }
        }

        // Clean up import dir
        try {
          const { rmSync } = await import('fs')
          rmSync(extractDir, { recursive: true })
        } catch { /* ignore */ }

        return { data: { success: true, action: 'import', imported } }
      }

      case 'share': {
        if (!sessionPath) return { data: { success: false, action: 'share', error: 'sessionPath required for share' } }
        const zipPath = existsSync(sessionPath) ? sessionPath : resolve(EXPORTS_DIR, sessionPath)
        if (!existsSync(zipPath)) return { data: { success: false, action: 'share', error: `Session zip not found: ${zipPath}` } }

        // For share, we just return the path — actual upload would be platform-specific
        const shareUrl = `file://${zipPath}`
        return { data: { success: true, action: 'share', zipPath: shareUrl } }
      }

      default:
        return { data: { success: false, action, error: `Unknown action: ${action}` } }
    }
  },
} satisfies ToolDef<InputSchema, Output>)