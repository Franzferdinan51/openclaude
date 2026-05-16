import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { getEmptyToolPermissionContext } from './Tool.js'

let lspConnected = false

mock.module('./services/lsp/manager.js', () => ({
  getInitializationStatus: () => ({ status: 'success' }),
  getLspServerManager: () => undefined,
  isLspConnected: () => lspConnected,
  reinitializeLspServerManager: () => {},
  shutdownLspServerManager: async () => {},
  waitForInitialization: async () => {},
}))

const { getAllBaseTools, getTools } = await import('./tools.js')

const originalDuckHiveAgentTeamsEnabled =
  process.env.DUCKHIVE_AGENT_TEAMS_ENABLED

beforeEach(() => {
  lspConnected = false
  delete process.env.DUCKHIVE_AGENT_TEAMS_ENABLED
})

afterEach(() => {
  if (originalDuckHiveAgentTeamsEnabled === undefined) {
    delete process.env.DUCKHIVE_AGENT_TEAMS_ENABLED
  } else {
    process.env.DUCKHIVE_AGENT_TEAMS_ENABLED =
      originalDuckHiveAgentTeamsEnabled
  }
})

test('LSPTool is part of the base tool pool', () => {
  expect(getAllBaseTools().map(tool => tool.name)).toContain('LSP')
})

test('LSPTool is filtered from usable tools until a server is connected', () => {
  const permissionContext = getEmptyToolPermissionContext()

  expect(getTools(permissionContext).map(tool => tool.name)).not.toContain('LSP')

  lspConnected = true

  expect(getTools(permissionContext).map(tool => tool.name)).toContain('LSP')
})

test('team tools are part of the base tool pool by default', () => {
  expect(getAllBaseTools().map(tool => tool.name)).toEqual(
    expect.arrayContaining(['TeamCreate', 'TeamDelete']),
  )
})

test('team tools respect the explicit DuckHive opt-out', () => {
  process.env.DUCKHIVE_AGENT_TEAMS_ENABLED = 'false'

  expect(getAllBaseTools().map(tool => tool.name)).not.toContain('TeamCreate')
  expect(getAllBaseTools().map(tool => tool.name)).not.toContain('TeamDelete')
})
