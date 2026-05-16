import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getMcpManageConfigPath,
  loadMcpManageServers,
  saveMcpManageServers,
} from './MCPManageTool.ts'

let configHomeDir: string

describe('MCPManageTool', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-mcp-manage-tool-'))
  })

  afterEach(() => {
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('stores MCP server config inside DuckHive config home and preserves server metadata', () => {
    const configPath = getMcpManageConfigPath(configHomeDir)
    expect(configPath).toBe(join(configHomeDir, 'mcp-servers.json'))
    saveMcpManageServers(
      {
        filesystem: {
          type: 'stdio',
          command: 'npx -y @modelcontextprotocol/server-filesystem',
        },
      },
      configPath,
    )

    const stored = JSON.parse(
      readFileSync(configPath, 'utf8'),
    ) as Record<string, { type: string; command?: string }>
    expect(stored.filesystem.type).toBe('stdio')
    expect(stored.filesystem.command).toContain(
      '@modelcontextprotocol/server-filesystem',
    )

    expect(loadMcpManageServers(configPath)).toEqual({
      filesystem: {
        type: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-filesystem',
      },
    })
  })
})
