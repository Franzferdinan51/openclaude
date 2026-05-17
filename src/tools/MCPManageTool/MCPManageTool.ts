// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

const mcpManageDeps: {
  getClaudeConfigHomeDir: () => string
} = {
  getClaudeConfigHomeDir,
}

export function setMcpManageToolTestDeps(
  overrides: Partial<typeof mcpManageDeps> | null,
): void {
  Object.assign(mcpManageDeps, {
    getClaudeConfigHomeDir,
    ...(overrides ?? {}),
  })
}

export function getMcpManageConfigPath(
  configHomeDir = mcpManageDeps.getClaudeConfigHomeDir(),
): string {
  return join(configHomeDir, 'mcp-servers.json')
}

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['list', 'add', 'remove', 'health', 'reload']).describe('MCP action'),
    name: z.string().optional().describe('Server name'),
    transport: z.enum(['stdio', 'http', 'sse']).optional().describe('Transport type'),
    url: z.string().optional().describe('Server URL or command'),
    env: z.record(z.string(), z.string()).optional().describe('Environment variables'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    action: z.string(),
    servers: z.array(z.object({ name: z.string(), transport: z.string(), url: z.string(), status: z.string() })).optional(),
    hint: z.string().optional(),
    error: z.string().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

export function loadMcpManageServers(
  configPath = getMcpManageConfigPath(),
): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return {}
  }
}

export function saveMcpManageServers(
  servers: Record<string, unknown>,
  configPath = getMcpManageConfigPath(),
) {
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(servers, null, 2), 'utf8')
}

export const MCPManageTool = buildTool({
  name: 'mcp_manage',
  async description() { return 'Manage MCP servers — add stdio/http/sse servers, list servers, remove servers, check health' },
  async prompt() { return 'Manage MCP servers — add stdio/http/sse servers, list servers, remove servers, check health' },
  get inputSchema(): InputSchema { return inputSchema() },
  get outputSchema(): OutputSchema { return outputSchema() },
  isConcurrencySafe() { return true },
  isReadOnly(input) { return input.action === 'list' || input.action === 'health' },
  async call(input, context, canUseTool, parentMessage) {
    const { action, name, transport, url } = input
    const servers = loadMcpManageServers() as Record<string, { type?: string; command?: string; url?: string }>

    switch (action) {
      case 'list':
        return { data: { success: true, action: 'list', servers: Object.entries(servers).map(([n, s]) => ({ name: n, transport: s.type ?? 'stdio', url: s.url ?? s.command ?? '', status: 'configured' })) } }
      case 'add': {
        if (!name || !transport) return { data: { success: false, action: 'add', error: 'name and transport required' } }
        servers[name] = transport === 'stdio' ? { type: 'stdio', command: url } : { type: transport, url }
        saveMcpManageServers(servers)
        return { data: { success: true, action: 'add' } }
      }
      case 'remove': {
        if (!name) return { data: { success: false, action: 'remove', error: 'name required' } }
        delete servers[name]
        saveMcpManageServers(servers)
        return { data: { success: true, action: 'remove' } }
      }
      case 'health':
        return { data: { success: true, action: 'health', servers: Object.entries(servers).map(([n, s]) => ({ name: n, transport: s.type ?? 'stdio', url: s.url ?? s.command ?? '', status: 'configured' })) } }
      case 'reload':
        return { data: { success: true, action: 'reload', hint: 'Restart DuckHive to reload MCP servers', servers: Object.entries(servers).map(([n, s]) => ({ name: n, transport: s.type ?? 'stdio', url: s.url ?? s.command ?? '', status: 'pending-reload' })) } }
      default:
        return { data: { success: false, action, error: `Unknown action: ${action}` } }
    }
  },

  mapToolResultToToolResultBlockParam(data: z.infer<OutputSchema>, toolUseID: string) {
    return { tool_use_id: toolUseID, type: 'tool_result' as const, content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
  },
} satisfies ToolDef<InputSchema, Output>)
