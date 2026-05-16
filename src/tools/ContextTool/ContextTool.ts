// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { resolve, dirname, join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

const contextToolDeps: {
  getClaudeConfigHomeDir: () => string
  homedir: () => string
} = {
  getClaudeConfigHomeDir,
  homedir,
}

export function setContextToolTestDeps(
  overrides: Partial<typeof contextToolDeps> | null,
): void {
  Object.assign(contextToolDeps, {
    getClaudeConfigHomeDir,
    homedir,
    ...(overrides ?? {}),
  })
}

export function getContextToolDir(
  configHomeDir = contextToolDeps.getClaudeConfigHomeDir(),
): string {
  return join(configHomeDir, 'context')
}

// Hierarchical context loading: global → workspace → JIT
function loadContextFile(path: string): string | null {
  try {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8')
    }
  } catch { /* skip */ }
  return null
}

export function scanContextFiles(
  projectPath: string,
  options?: { contextDir?: string; homeDir?: string },
): { path: string; content: string; level: string }[] {
  const results: { path: string; content: string; level: string }[] = []
  
  // Global context
  const globalFile = resolve(options?.contextDir ?? getContextToolDir(), 'global.md')
  const globalContent = loadContextFile(globalFile)
  if (globalContent) results.push({ path: globalFile, content: globalContent, level: 'global' })

  // Workspace context
  const workspaceFile = resolve(projectPath, '.duckhive.md')
  const workspaceContent = loadContextFile(workspaceFile)
  if (workspaceContent) results.push({ path: workspaceFile, content: workspaceContent, level: 'workspace' })

  // Also check AGENTS.md, GEMINI.md, CONTEXT.md (common names)
  const commonNames = ['AGENTS.md', 'GEMINI.md', 'CONTEXT.md', '.duckhive.md']
  for (const name of commonNames) {
    const p = resolve(projectPath, name)
    if (existsSync(p) && !results.some(r => r.path === p)) {
      const c = loadContextFile(p)
      if (c) results.push({ path: p, content: c, level: 'workspace' })
    }
  }

  // JIT context (parent directories up to $HOME)
  let current = dirname(projectPath)
  const home = options?.homeDir ?? contextToolDeps.homedir()
  while (current && current !== home && current !== '/') {
    for (const name of commonNames) {
      const p = resolve(current, name)
      if (existsSync(p) && !results.some(r => r.path === p)) {
        const c = loadContextFile(p)
        if (c) results.push({ path: p, content: c, level: 'jit' })
      }
    }
    current = dirname(current)
  }

  return results
}

export function writeContextToolFile(
  filePath: string,
  content: string,
  mode: 'append' | 'create',
): void {
  mkdirSync(dirname(filePath), { recursive: true })
  if (mode === 'append') {
    const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
    writeFileSync(filePath, existing + '\n' + content, 'utf8')
    return
  }
  writeFileSync(filePath, content, 'utf8')
}

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['load', 'list', 'append', 'create', 'scan', 'context']).describe('Context action'),
    path: z.string().optional().describe('File path or project path'),
    content: z.string().optional().describe('Content to append or create'),
    level: z.enum(['global', 'workspace', 'jit']).optional().describe('Context level'),
    showAll: z.boolean().optional().describe('Include all levels'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

export const ContextTool = buildTool({
  name: 'context',
  async description() { return 'Hierarchical context loading (GEMINI.md pattern) — loads .duckhive.md, AGENTS.md, GEMINI.md from global → workspace → JIT (just-in-time). Build context for AI sessions from layered files.' },
  async prompt() { return 'Hierarchical context files — loads context from .duckhive.md, AGENTS.md, GEMINI.md in project. Use /context load to get all context for a project, /context append to add to global context.' },
  get inputSchema(): InputSchema { return inputSchema() },
  get outputSchema() {
    return z.object({
      success: z.boolean(),
      action: z.string(),
      contexts: z.array(z.object({ level: z.string(), path: z.string(), preview: z.string() })).optional(),
      combined: z.string().optional(),
      appended: z.boolean().optional(),
      error: z.string().optional(),
    })
  },
  isConcurrencySafe() { return true },
  isReadOnly(input) { return input.action === 'load' || input.action === 'list' || input.action === 'scan' },
  async call(input, context, canUseTool, parentMessage) {
    const { action, path, content, level = 'global', showAll } = input
    const projectPath = path ?? process.cwd()

    switch (action) {
      case 'load':
      case 'scan': {
        const contexts = scanContextFiles(projectPath)
        if (!showAll) {
          // Return first (highest priority) matching context
          if (contexts.length > 0) {
            return {
              data: {
                success: true,
                action: 'load',
                combined: contexts.map(c => `<!-- ${c.level}: ${c.path} -->\n${c.content}`).join('\n\n'),
              },
            }
          }
          return { data: { success: true, action: 'load', combined: '' } }
        }
        return {
          data: {
            success: true,
            action: 'scan',
            contexts: contexts.map(c => ({ level: c.level, path: c.path, preview: c.content.slice(0, 100) })),
          },
        }
      }
      case 'list': {
        const contexts = scanContextFiles(projectPath)
        return {
          data: {
            success: true,
            action: 'list',
            contexts: contexts.map(c => ({ level: c.level, path: c.path, preview: c.content.slice(0, 100) })),
          },
        }
      }
      case 'append': {
        if (!content) return { data: { success: false, action: 'append', error: 'content required' } }
        const filePath = level === 'global'
          ? resolve(getContextToolDir(), 'global.md')
          : resolve(projectPath, '.duckhive.md')
        try {
          writeContextToolFile(filePath, content, 'append')
          return { data: { success: true, action: 'append', appended: true } }
        } catch (err) {
          return { data: { success: false, action: 'append', error: String(err) } }
        }
      }
      case 'create': {
        if (!content) return { data: { success: false, action: 'create', error: 'content required' } }
        const filePath = level === 'global'
          ? resolve(getContextToolDir(), 'global.md')
          : resolve(projectPath, '.duckhive.md')
        try {
          writeContextToolFile(filePath, content, 'create')
          return { data: { success: true, action: 'create', appended: true } }
        } catch (err) {
          return { data: { success: false, action: 'create', error: String(err) } }
        }
      }
      case 'context': {
        // Alias for load
        const contexts = scanContextFiles(projectPath)
        const combined = contexts.map(c => c.content).join('\n\n')
        return { data: { success: true, action: 'context', combined } }
      }
      default:
        return { data: { success: false, action, error: `Unknown action: ${action}` } }
    }
  },

  mapToolResultToToolResultBlockParam(data: any, toolUseID: string) {
    return { tool_use_id: toolUseID, type: 'tool_result' as const, content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
  },
} satisfies ToolDef<InputSchema, { data: any }>)
