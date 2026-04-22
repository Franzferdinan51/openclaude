// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const DUCKHIVE_DIR = join(process.env.HOME ?? '~', '.duckhive')
const PALACE_DIR = join(DUCKHIVE_DIR, 'mempalace')

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['search', 'init', 'mine', 'wake', 'status', 'config']).describe('MemPalace action'),
    query: z.string().optional().describe('Query for search'),
    mode: z.enum(['raw', 'hybrid', 'hybrid-rerank']).optional().describe('Search mode'),
    paths: z.array(z.string()).optional().describe('Paths to mine'),
    wing: z.string().optional().describe('Wing (project/person scope) for mining'),
    context: z.number().optional().describe('Lines of context for mine'),
    maxResults: z.number().optional().describe('Max search results'),
  })
)

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    action: z.string(),
    results: z.array(z.object({
      content: z.string(),
      drawer: z.string().optional(),
      score: z.number().optional(),
    })).optional(),
    output: z.string().optional(),
    installed: z.boolean().optional(),
    error: z.string().optional(),
  })
)

type InputSchema = z.infer<typeof inputSchema>
type Output = z.infer<typeof outputSchema>

function runMempalace(args: string[], timeout = 30000): string {
  try {
    const cmd = `python3 -m mempalace --palace ${PALACE_DIR} ${args.join(' ')}`
    const result = execSync(cmd, { timeout })
    return result.toString().trim()
  } catch (e: any) {
    return e.stdout?.toString()?.trim() || e.stderr?.toString()?.trim() || e.message
  }
}

export const MemPalaceTool = buildTool({
  name: 'mempalace',
  description() { return 'MemPalace -- local-first AI memory with semantic search. pip install mempalace; pyenv install 3.10+' },
  prompt() { return 'MemPalace memory system -- search your local memory palace, mine files, load context. Install: pip install mempalace && pyenv install 3.10+' },
  get inputSchema() { return inputSchema() },
  get outputSchema() { return outputSchema() },
  async call(input: z.infer<InputSchema>): Promise<{ data: Output }> {
    const { action, query, mode, paths, wing, context, maxResults } = input

    if (action === 'status') {
      let version = 'unknown'
      let installed = false
      try {
        version = runMempalace(['--version']).trim()
        installed = true
      } catch {
        installed = false
      }
      const palaceExists = existsSync(PALACE_DIR)
      return {
        data: {
          success: true,
          action: 'status',
          installed,
          output: installed
            ? `MemPalace: ${version}\nDuckHive palace: ${palaceExists ? PALACE_DIR : 'not initialized'}\nPalace dir: ${PALACE_DIR}`
            : 'MemPalace not installed. Run: pip install mempalace',
        },
      }
    }

    try {
      runMempalace(['--version'])
    } catch {
      return { data: { success: false, action, error: 'MemPalace not installed. Install: pip install mempalace && pyenv install 3.10+' } }
    }

    switch (action) {
      case 'init': {
        mkdirSync(PALACE_DIR, { recursive: true })
        const configPath = join(PALACE_DIR, 'config.json')
        const palaceConfig = {
          palace_path: PALACE_DIR,
          collection_name: 'duckhive_drawers',
          topic_wings: ['duckhive', 'context', 'learnings'],
          hall_keywords: { facts: ['fact', 'important'], preferences: ['pref', 'prefer'] }
        }
        writeFileSync(configPath, JSON.stringify(palaceConfig, null, 2), 'utf8')
        const out = runMempalace([`init ${PALACE_DIR} --yes`])
        return { data: { success: true, action: 'init', output: `Initialized DuckHive MemPalace at ${PALACE_DIR}\n${out}` } }
      }

      case 'search': {
        if (!query) return { data: { success: false, action: 'search', error: 'query required' } }
        const args2 = ['search', query]
        if (mode) args2.push('--mode', mode)
        if (maxResults) args2.push('--results', String(maxResults))
        else args2.push('--results', '5')
        const out = runMempalace(args2)
        const lines = out.trim().split('\n').filter(l => l.trim())
        const results = lines.map(line => ({ content: line, score: undefined }))
        return { data: { success: true, action: 'search', results, output: out } }
      }

      case 'mine': {
        if (!paths || paths.length === 0) return { data: { success: false, action: 'mine', error: 'paths required' } }
        const args2 = ['mine', ...paths]
        if (wing) args2.push('--wing', wing)
        else args2.push('--wing', 'duckhive')
        if (context) args2.push('--context', String(context))
        else args2.push('--context', '50')
        const out = runMempalace(args2)
        return { data: { success: true, action: 'mine', output: out } }
      }

      case 'wake': {
        const out = runMempalace(['wake-up'])
        return { data: { success: true, action: 'wake', output: out } }
      }

      default:
        return { data: { success: false, action, error: `Unknown action: ${action}` } }
    }
  },
  mapToolResultToToolResultBlockParam(data: Output, toolUseID: string) {
    return { tool_use_id: toolUseID, type: 'tool_result' as const, content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
  },
} satisfies ToolDef<InputSchema, Output>)

export default MemPalaceTool
