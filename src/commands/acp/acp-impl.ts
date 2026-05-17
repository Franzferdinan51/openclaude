/**
 * ACP (Agent Client Protocol) server implementation
 *
 * ACP is a protocol for connecting AI agents to IDEs and external clients.
 * It provides a standardized way for editors to communicate with agents
 * like DuckHive, enabling features like:
 * - Real-time code completion and editing
 * - Terminal command execution
 * - File system operations
 * - Context awareness
 *
 * Reference: https://github.com/agentclientprotocol
 */
import { createServer, Socket } from 'net'
import { randomUUID } from 'crypto'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import path from 'path'
import { queryAsync } from '../../entrypoints/sdk/query.js'

// ACP message types
export type ACPPayloadType =
  | 'initialize'
  | 'initialize_result'
  | 'chat/message'
  | 'chat/message_result'
  | 'tools/list'
  | 'tools/list_result'
  | 'tools/call'
  | 'tools/call_result'
  | 'tools/call_batch'
  | 'tools/call_batch_result'
  | 'ping'
  | 'pong'
  | 'close'

export interface ACPMessage {
  type: ACPPayloadType
  id?: string
  [key: string]: unknown
}

export interface ACPClient {
  id: string
  name: string
  version: string
  socket: Socket
  sessionId?: string
  capabilities?: string[]
}

interface InitializeMessage {
  type: 'initialize'
  id: string
  client_name: string
  client_version: string
  capabilities?: string[]
  session_id?: string
}

interface ChatMessage {
  type: 'chat/message'
  id: string
  content: string
  context?: Record<string, unknown>
}

interface ToolsListMessage {
  type: 'tools/list'
  id: string
}

interface ToolsCallMessage {
  type: 'tools/call'
  id: string
  tool: string
  input: Record<string, unknown>
}

interface ToolsCallBatchMessage {
  type: 'tools/call_batch'
  id: string
  calls: Array<{ tool: string; input: Record<string, unknown> }>
}

interface ACPServerHandle {
  close: () => void
}

interface ACPStartOptions {
  port?: number
  host?: string
  socketPath?: string
}

type ACPTestDeps = {
  startServer?: (options: ACPStartOptions) => ACPServerHandle
  queryAsync?: typeof queryAsync
}

const ACP_CHAT_ALLOWED_TOOLS = new Set([
  'Bash',
  'PowerShell',
  'Read',
  'Write',
  'Edit',
  'Grep',
  'Glob',
  'LSP',
])

const execAsync = promisify(execCallback)

// Session state for connected clients
const sessions = new Map<string, {
  client: ACPClient
  duckSessionId?: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date }>
}>()

let currentServer:
  | {
      handle: ACPServerHandle
      addr: string
      port: number
      host: string
      socketPath?: string
    }
  | null = null
let acpTestDeps: ACPTestDeps | null = null

// Tool definitions available via ACP
const TOOLS = [
  {
    name: 'shell',
    description: 'Execute a shell command in the terminal',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' }
      },
      required: ['command']
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        offset: { type: 'number', description: 'Line offset to start reading from' },
        limit: { type: 'number', description: 'Maximum number of lines to read' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        content: { type: 'string', description: 'Content to write' },
        append: { type: 'boolean', description: 'Append to existing file instead of overwriting' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'List contents of a directory',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the directory' },
        recursive: { type: 'boolean', description: 'Recursively list subdirectories' }
      },
      required: ['path']
    }
  },
  {
    name: 'search',
    description: 'Search for files or content',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        path: { type: 'string', description: 'Directory to search in' },
        mode: { type: 'string', enum: ['files', 'content', 'both'], description: 'Search mode' }
      },
      required: ['query']
    }
  }
]

function send(socket: Socket, msg: ACPMessage): void {
  if (socket.destroyed) return
  socket.write(JSON.stringify(msg) + '\n')
}

function formatError(id: string, error: string): ACPMessage {
  return {
    type: 'error' as ACPPayloadType,
    id,
    error
  }
}

async function executeShellCommand(input: Record<string, unknown>) {
  const command = typeof input.command === 'string' ? input.command : ''
  const timeout =
    typeof input.timeout === 'number' && Number.isFinite(input.timeout)
      ? Math.max(1, input.timeout)
      : 30000
  if (!command.trim()) {
    return {
      success: false,
      error: 'command is required',
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })
    return {
      success: true,
      stdout: stdout.trimEnd(),
      stderr: stderr.trimEnd(),
      timeout,
    }
  } catch (error) {
    const err = error as {
      stdout?: string
      stderr?: string
      message?: string
      code?: string | number
    }
    return {
      success: false,
      error: err.message ?? 'shell command failed',
      stdout: err.stdout?.trimEnd() ?? '',
      stderr: err.stderr?.trimEnd() ?? '',
      exitCode: err.code ?? null,
      timeout,
    }
  }
}

async function executeReadFile(input: Record<string, unknown>) {
  const targetPath = typeof input.path === 'string' ? input.path : ''
  const offset = typeof input.offset === 'number' ? Math.max(0, input.offset) : 0
  const limit = typeof input.limit === 'number' ? Math.max(1, input.limit) : 200
  if (!targetPath.trim()) {
    return { success: false, error: 'path is required' }
  }

  const resolvedPath = path.resolve(targetPath)
  const content = await readFile(resolvedPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const sliced = lines.slice(offset, offset + limit)
  return {
    success: true,
    path: resolvedPath,
    offset,
    limit,
    content: sliced.join('\n'),
    totalLines: lines.length,
  }
}

async function executeWriteFile(input: Record<string, unknown>) {
  const targetPath = typeof input.path === 'string' ? input.path : ''
  const content = typeof input.content === 'string' ? input.content : null
  const append = input.append === true
  if (!targetPath.trim()) {
    return { success: false, error: 'path is required' }
  }
  if (content === null) {
    return { success: false, error: 'content is required' }
  }

  const resolvedPath = path.resolve(targetPath)
  await mkdir(path.dirname(resolvedPath), { recursive: true })
  if (append) {
    await appendFile(resolvedPath, content, 'utf8')
  } else {
    await writeFile(resolvedPath, content, 'utf8')
  }
  return {
    success: true,
    path: resolvedPath,
    append,
    bytesWritten: Buffer.byteLength(content, 'utf8'),
  }
}

async function executeListDirectory(input: Record<string, unknown>) {
  const targetPath = typeof input.path === 'string' ? input.path : '.'
  const recursive = input.recursive === true
  const resolvedPath = path.resolve(targetPath)

  async function walk(dirPath: string, prefix = ''): Promise<string[]> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const results: string[] = []
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      results.push(entry.isDirectory() ? `${relative}/` : relative)
      if (recursive && entry.isDirectory()) {
        results.push(...(await walk(path.join(dirPath, entry.name), relative)))
      }
    }
    return results
  }

  const items = await walk(resolvedPath)
  return {
    success: true,
    path: resolvedPath,
    recursive,
    items,
  }
}

async function executeSearch(input: Record<string, unknown>) {
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  const targetPath = typeof input.path === 'string' ? input.path : '.'
  const mode =
    input.mode === 'files' || input.mode === 'content' || input.mode === 'both'
      ? input.mode
      : 'both'
  if (!query) {
    return { success: false, error: 'query is required' }
  }

  const resolvedPath = path.resolve(targetPath)
  const files: string[] = []
  const content: Array<{ path: string; line: number; text: string }> = []

  async function walk(dirPath: string): Promise<string[]> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const results: string[] = []
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        results.push(...(await walk(fullPath)))
      } else {
        results.push(fullPath)
      }
    }
    return results
  }

  const allFiles = await walk(resolvedPath)
  const normalizedQuery = query.toLowerCase()
  for (const filePath of allFiles) {
    const relativePath = path.relative(resolvedPath, filePath) || path.basename(filePath)
    if (mode === 'files' || mode === 'both') {
      if (relativePath.toLowerCase().includes(normalizedQuery)) {
        files.push(relativePath)
      }
    }

    if (mode === 'content' || mode === 'both') {
      try {
        const fileStats = await stat(filePath)
        if (fileStats.size > 1024 * 1024) {
          continue
        }
        const text = await readFile(filePath, 'utf8')
        const lines = text.split(/\r?\n/)
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(normalizedQuery)) {
            content.push({
              path: relativePath,
              line: index + 1,
              text: line,
            })
          }
        })
      } catch {
        // Skip unreadable or binary files.
      }
    }
  }

  return {
    success: true,
    path: resolvedPath,
    mode,
    files,
    content,
  }
}

export async function runACPChat(
  prompt: string,
  session: { duckSessionId?: string },
  options: { allowTools?: boolean } = {},
): Promise<{ content: string; duckSessionId?: string }> {
  const sdkQueryAsync = acpTestDeps?.queryAsync ?? queryAsync
  const query = await sdkQueryAsync({
    prompt,
    options: {
      cwd: process.cwd(),
      sessionId: session.duckSessionId,
      canUseTool: async (toolName: string) => {
        if (options.allowTools && ACP_CHAT_ALLOWED_TOOLS.has(toolName)) {
          return { behavior: 'allow' as const }
        }

        return {
          behavior: 'deny' as const,
          message: options.allowTools
            ? `ACP chat/message can only use the local shell/filesystem/search tool set (${Array.from(ACP_CHAT_ALLOWED_TOOLS).join(', ')}). Use ACP tools/call for direct execution outside that set.`
            : 'ACP chat/message currently runs in read-only chat mode. Re-initialize the ACP client with the "tools" capability or use ACP tools/call for shell or filesystem operations.',
        }
      },
    },
  })

  const textParts: string[] = []
  for await (const message of query) {
    if (message.type !== 'assistant') continue
    const contentBlocks = Array.isArray(message.message?.content)
      ? message.message.content
      : []
    for (const block of contentBlocks) {
      if (
        block &&
        typeof block === 'object' &&
        'type' in block &&
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string'
      ) {
        textParts.push(block.text)
      }
    }
  }

  return {
    content:
      textParts.join('\n').trim() ||
      'DuckHive ACP chat completed without assistant text output.',
    duckSessionId: query.sessionId,
  }
}

export async function executeToolCall(
  tool: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (tool) {
    case 'shell':
      return executeShellCommand(input)
    case 'read_file':
      return executeReadFile(input)
    case 'write_file':
      return executeWriteFile(input)
    case 'list_directory':
      return executeListDirectory(input)
    case 'search':
      return executeSearch(input)
    default:
      return {
        success: false,
        error: `Unknown tool: ${tool}`,
      }
  }
}

async function handleMessage(client: ACPClient, raw: string): Promise<void> {
  let msg: ACPMessage
  try {
    msg = JSON.parse(raw) as ACPMessage
  } catch {
    send(client.socket, formatError('', 'Invalid JSON'))
    return
  }

  switch (msg.type) {
    case 'initialize': {
      const init = msg as unknown as InitializeMessage
      client.name = init.client_name
      client.version = init.client_version
      client.capabilities = init.capabilities || []
      client.sessionId = init.session_id || randomUUID()

      // Create session
      sessions.set(client.sessionId, {
        client,
        messages: []
      })

      send(client.socket, {
        type: 'initialize_result',
        id: init.id,
        session_id: client.sessionId,
        server_name: 'DuckHive',
        server_version: '1.0.0',
        capabilities: ['chat', 'tools', 'batch_tools'],
        tools: TOOLS
      })
      break
    }

    case 'chat/message': {
      const chat = msg as unknown as ChatMessage
      const session = sessions.get(client.sessionId!)
      if (!session) {
        send(client.socket, formatError(chat.id, 'No active session'))
        return
      }

      // Add user message to history
      session.messages.push({
        role: 'user',
        content: chat.content,
        timestamp: new Date()
      })

      // Build prompt with context
      const context = chat.context || {}
      const contextStr = Object.entries(context)
        .map(([k, v]) => `[${k}] ${v}`)
        .join('\n')

      const prompt = contextStr
        ? `Context:\n${contextStr}\n\nUser: ${chat.content}`
        : chat.content

      const chatResult = await runACPChat(prompt, session, {
        allowTools: client.capabilities?.includes('tools') ?? false,
      })
      session.duckSessionId = chatResult.duckSessionId

      send(client.socket, {
        type: 'chat/message_result',
        id: chat.id,
        message: {
          role: 'assistant',
          content: chatResult.content,
          session_id: client.sessionId
        }
      })

      session.messages.push({
        role: 'assistant',
        content: chatResult.content,
        timestamp: new Date()
      })
      break
    }

    case 'tools/list': {
      send(client.socket, {
        type: 'tools/list_result',
        id: msg.id,
        tools: TOOLS
      })
      break
    }

    case 'tools/call': {
      const call = msg as unknown as ToolsCallMessage
      const result = await executeToolCall(call.tool, call.input)
      send(client.socket, {
        type: 'tools/call_result',
        id: call.id,
        tool: call.tool,
        result,
      })
      break
    }

    case 'tools/call_batch': {
      const batch = msg as unknown as ToolsCallBatchMessage
      const results = await Promise.all(batch.calls.map(async call => ({
        tool: call.tool,
        result: await executeToolCall(call.tool, call.input),
      })))

      send(client.socket, {
        type: 'tools/call_batch_result',
        id: batch.id,
        results
      })
      break
    }

    case 'ping': {
      send(client.socket, { type: 'pong', id: msg.id })
      break
    }

    default:
      send(client.socket, formatError(msg.id || '', `Unknown message type: ${msg.type}`))
  }
}

function handleConnection(socket: Socket): void {
  const client: ACPClient = {
    id: randomUUID(),
    name: 'unknown',
    version: 'unknown',
    socket
  }

  let buffer = ''

  socket.on('data', async (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        await handleMessage(client, line)
      }
    }
  })

  socket.on('close', () => {
    if (client.sessionId) {
      sessions.delete(client.sessionId)
    }
  })

  socket.on('error', (err) => {
    console.error('[ACP] Socket error:', err.message)
  })
}

export interface ACPServerOptions {
  port?: number
  host?: string
  socketPath?: string
}

export function setACPTestDeps(deps: ACPTestDeps | null): void {
  acpTestDeps = deps
}

export function resetACPServerState(): void {
  if (currentServer) {
    currentServer.handle.close()
    currentServer = null
  }
  sessions.clear()
}

function getAddress(options: ACPStartOptions): string {
  if (options.socketPath) {
    return `unix://${options.socketPath}`
  }
  return `${options.host ?? 'localhost'}:${options.port ?? 8080}`
}

function getUsageText(): string {
  return `ACP Server

Usage:
  /acp
  /acp status
  /acp stop
  /acp --port=8080 [--host=localhost]
  /acp --socket=/tmp/duckhive-acp.sock

Notes:
  - /acp starts the ACP server in the current DuckHive process.
  - /acp status reports the in-process ACP server state.
  - /acp stop stops the in-process ACP server.`
}

export function startACPServer(options: ACPServerOptions = {}): { close: () => void } {
  const { port = 8080, host = 'localhost', socketPath } = options

  const server = createServer(handleConnection)

  server.on('error', (err: Error) => {
    console.error('[ACP] Server error:', err.message)
  })

  if (socketPath) {
    // Unix socket mode
    server.listen(socketPath, () => {
      console.log(`[ACP] Server listening on Unix socket: ${socketPath}`)
    })
  } else {
    // TCP mode
    server.listen(port, host, () => {
      console.log(`[ACP] Server listening on ${host}:${port}`)
    })
  }

  return {
    close: () => {
      server.close(() => {
        console.log('[ACP] Server closed')
      })
    }
  }
}

// CLI entrypoint
export const call = async (args: string) => {
  const parsedArgs = args.trim().split(/\s+/).filter(Boolean)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (const arg of parsedArgs) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      flags[k] = v ?? true
    } else {
      positional.push(arg)
    }
  }

  if (positional.length > 1) {
    return {
      type: 'text' as const,
      value: getUsageText(),
    }
  }

  const subcommand = positional[0]?.toLowerCase()
  if (subcommand && subcommand !== 'status' && subcommand !== 'stop') {
    return {
      type: 'text' as const,
      value: getUsageText(),
    }
  }

  if ((subcommand === 'status' || subcommand === 'stop') && Object.keys(flags).length > 0) {
    return {
      type: 'text' as const,
      value: getUsageText(),
    }
  }

  if (subcommand === 'status') {
    if (!currentServer) {
      return {
        type: 'text' as const,
        value: `ACP Server Status

Status: not running

Run /acp to start the in-process ACP server.`,
      }
    }

    return {
      type: 'text' as const,
      value: `ACP Server Status

Status: running
Address: ${currentServer.addr}

This ACP server is running inside the current DuckHive process.`,
    }
  }

  if (subcommand === 'stop') {
    if (!currentServer) {
      return {
        type: 'text' as const,
        value: `ACP Server Status

Status: not running

Nothing to stop.`,
      }
    }

    const addr = currentServer.addr
    currentServer.handle.close()
    currentServer = null
    return {
      type: 'text' as const,
      value: `ACP Server Stopped

Address: ${addr}`,
    }
  }

  const port = typeof flags.port === 'string' ? parseInt(flags.port) : 8080
  const host = typeof flags.host === 'string' ? flags.host : 'localhost'
  const socketPath = typeof flags.socket === 'string' ? flags.socket : undefined

  const addr = getAddress({ port, host, socketPath })

  if (!socketPath && Number.isNaN(port)) {
    return {
      type: 'text' as const,
      value: getUsageText(),
    }
  }

  if (currentServer) {
    return {
      type: 'text' as const,
      value:
        currentServer.addr === addr
          ? `ACP Server Status

Status: already running
Address: ${currentServer.addr}`
          : `ACP Server Already Running

Current address: ${currentServer.addr}

Run /acp stop before starting a new ACP server at ${addr}.`,
    }
  }

  console.log(`[ACP] Starting DuckHive ACP server...`)
  console.log(`[ACP] Address: ${addr}`)
  console.log(`[ACP] This enables IDE integrations following the Agent Client Protocol`)

  const server = (acpTestDeps?.startServer ?? startACPServer)({
    port,
    host,
    socketPath,
  })
  currentServer = {
    handle: server,
    addr,
    port,
    host,
    socketPath,
  }

  // Keep server running
  process.on('SIGINT', () => {
    server.close()
    currentServer = null
    process.exit(0)
  })

  return {
    type: 'text',
    value: `ACP Server Started

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DuckHive ACP server is running and ready for IDE connections.

Address: ${addr}

Available tools via ACP:
  - shell: Execute shell commands
  - read_file: Read file contents
  - write_file: Write file contents
  - list_directory: List directory contents
  - search: Search files and content

ACP tool calls now execute DuckHive-backed shell/file/search operations. ACP chat/message routes through DuckHive's SDK query path too: clients that negotiate the "tools" capability can use the local shell/filesystem/search tool family (Bash, PowerShell, Read, Write, Edit, Grep, Glob, LSP), while other tools remain denied and should go through ACP tools/call.

Run /acp status to inspect the in-process server or /acp stop to stop it.`
  }
}
