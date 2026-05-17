import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  discoverLocalPluginComponents,
  type InstallablePlugin,
} from './pluginDetailsHelpers.js'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'duckhive-plugin-details-'))
  tempDirs.push(dir)
  return dir
}

function makePlugin(
  marketplaceInstallLocation: string,
  source: string,
): InstallablePlugin {
  return {
    entry: {
      name: 'demo-plugin',
      source,
      strict: false,
    },
    marketplaceInstallLocation,
    marketplaceName: 'demo-marketplace',
    pluginId: 'demo-plugin@demo-marketplace',
    isInstalled: false,
  }
}

describe('discoverLocalPluginComponents', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })),
    )
  })

  test('discovers standard local plugin directories and config files', async () => {
    const marketplaceRoot = await makeTempDir()
    const pluginRoot = join(marketplaceRoot, 'plugins', 'demo-plugin')

    await mkdir(join(pluginRoot, 'commands'), { recursive: true })
    await mkdir(join(pluginRoot, 'agents'), { recursive: true })
    await mkdir(join(pluginRoot, 'skills', 'reviewer'), { recursive: true })
    await mkdir(join(pluginRoot, 'output-styles'), { recursive: true })
    await mkdir(join(pluginRoot, 'hooks'), { recursive: true })

    await writeFile(join(pluginRoot, 'commands', 'build.md'), '# build')
    await writeFile(join(pluginRoot, 'agents', 'qa.md'), '# qa')
    await writeFile(join(pluginRoot, 'skills', 'reviewer', 'SKILL.md'), '# skill')
    await writeFile(join(pluginRoot, 'output-styles', 'compact.md'), '# style')
    await writeFile(join(pluginRoot, 'hooks', 'hooks.json'), '{"hooks":{}}')
    await writeFile(join(pluginRoot, '.mcp.json'), '{"demo":{}}')

    expect(
      discoverLocalPluginComponents(
        makePlugin(marketplaceRoot, './plugins/demo-plugin'),
      ),
    ).toEqual([
      'Command: 1 entry in commands/',
      'Agent: 1 entry in agents/',
      'Skill: 1 entry in skills/',
      'Output style: 1 entry in output-styles/',
      'Hooks: hooks/hooks.json',
      'MCP Servers: .mcp.json',
    ])
  })

  test('resolves local marketplace.json paths back to the marketplace root', async () => {
    const marketplaceRoot = await makeTempDir()
    const pluginRoot = join(marketplaceRoot, 'plugins', 'demo-plugin')
    const manifestPath = join(marketplaceRoot, '.claude-plugin', 'marketplace.json')

    await mkdir(join(pluginRoot, 'commands'), { recursive: true })
    await mkdir(join(manifestPath, '..'), { recursive: true })
    await writeFile(join(pluginRoot, 'commands', 'build.md'), '# build')
    await writeFile(manifestPath, '{"name":"demo-marketplace","plugins":[]}')

    expect(
      discoverLocalPluginComponents(
        makePlugin(manifestPath, './plugins/demo-plugin'),
      ),
    ).toEqual(['Command: 1 entry in commands/'])
  })

  test('rejects local plugin paths that escape the marketplace root', async () => {
    const marketplaceRoot = await makeTempDir()

    expect(
      discoverLocalPluginComponents(makePlugin(marketplaceRoot, './../escape')),
    ).toEqual([])
  })
})
