import { describe, expect, test } from 'bun:test'
import { call } from './mcp-manage-impl.js'

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

describe('/mcp-manage command', () => {
  test('shows generic MCP guidance instead of a stale hardcoded server list', async () => {
    const result = expectTextResult(await call('', {} as never))

    expect(result.value).toContain('MCP Manage')
    expect(result.value).toContain('/mcp enable <server-name>')
    expect(result.value).toContain('/mcp reconnect <server>')
    expect(result.value).not.toContain('runescape')
  })

  test('renders connect guidance for an arbitrary configured server name', async () => {
    const result = expectTextResult(await call('connect github', {} as never))

    expect(result.value).toContain('Enable MCP server "github"')
    expect(result.value).toContain('/mcp enable github')
  })

  test('renders disconnect guidance for an arbitrary configured server name', async () => {
    const result = expectTextResult(await call('disconnect filesystem', {} as never))

    expect(result.value).toContain('Disable MCP server "filesystem"')
    expect(result.value).toContain('/mcp disable filesystem')
  })

  test('renders reconnect guidance for an arbitrary configured server name', async () => {
    const result = expectTextResult(await call('reconnect brave-search', {} as never))

    expect(result.value).toContain('Reconnect MCP server "brave-search"')
    expect(result.value).toContain('/mcp reconnect brave-search')
  })
})
