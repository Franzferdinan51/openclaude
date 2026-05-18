import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Command } from '@commander-js/extra-typings'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getDuckHiveMcpConfigPath,
  registerDuckhiveMcpCommand,
  setDuckHiveMcpCommandTestDeps,
} from './duckhiveMcpCommand.js'

let configHomeDir: string

function createProgram(): Command {
  const program = new Command('duckhive')
  program.exitOverride()
  program.configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  })
  registerDuckhiveMcpCommand(program)
  return program
}

async function captureLog(fn: () => Promise<void>): Promise<string[]> {
  const originalLog = console.log
  const messages: string[] = []
  console.log = (message?: unknown) => {
    messages.push(String(message ?? ''))
  }
  try {
    await fn()
  } finally {
    console.log = originalLog
  }
  return messages
}

describe('duckhive MCP command', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-mcp-command-'))
    setDuckHiveMcpCommandTestDeps({
      getClaudeConfigHomeDir: () => configHomeDir,
    })
  })

  afterEach(() => {
    setDuckHiveMcpCommandTestDeps(null)
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('stores MCP server config inside DuckHive config home', async () => {
    const configPath = getDuckHiveMcpConfigPath()
    expect(configPath).toBe(join(configHomeDir, 'mcp-servers.json'))

    await captureLog(async () => {
      await createProgram().parseAsync(
        [
          'node',
          'duckhive',
          'mcp',
          'add',
          'github',
          'npx',
          '-y',
          '@modelcontextprotocol/server-github',
        ],
        { from: 'node' },
      )
    })

    const stored = JSON.parse(
      readFileSync(configPath, 'utf8'),
    ) as Record<string, { type: string; command?: string }>
    expect(stored).toEqual({
      github: {
        type: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-github',
      },
    })
  })

  test('lists MCP servers from DuckHive config home', async () => {
    const configPath = getDuckHiveMcpConfigPath()
    mkdirSync(configHomeDir, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        filesystem: {
          type: 'stdio',
          command: 'npx -y @modelcontextprotocol/server-filesystem C:\\repo',
        },
      }),
      'utf8',
    )

    const messages = await captureLog(async () => {
      await createProgram().parseAsync(['node', 'duckhive', 'mcp', 'list'], {
        from: 'node',
      })
    })

    expect(messages.join('\n')).toContain('DuckHive MCP Servers (1)')
    expect(messages.join('\n')).toContain('filesystem')
    expect(messages.join('\n')).toContain('@modelcontextprotocol/server-filesystem')
  })
})
