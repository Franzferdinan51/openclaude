import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  call,
  loadTrustedFoldersConfig,
  setTrustedFoldersTestDeps,
} from './trusted-impl.js'

let tempDir: string | undefined

function expectText(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') throw new Error('expected text result')
  return result
}

function setupTempConfigDir(): string {
  tempDir = mkdtempSync(join(tmpdir(), 'duckhive-trusted-'))
  setTrustedFoldersTestDeps({
    getClaudeConfigHomeDir: () => tempDir!,
    homedir: () => tempDir!,
  })
  return tempDir
}

afterEach(() => {
  setTrustedFoldersTestDeps(null)
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

describe('/trusted command', () => {
  test('lists an empty trusted folder config', async () => {
    setupTempConfigDir()

    const result = expectText(await call('list', {} as never))

    expect(result.value).toContain('No trusted folders')
  })

  test('adds and removes trusted folders in the DuckHive config dir', async () => {
    const configDir = setupTempConfigDir()
    const folder = join(configDir, 'workspace')

    const added = expectText(await call(`add ${folder}`, {} as never))
    expect(added.value).toContain(`Added trusted folder: ${folder}`)
    expect(loadTrustedFoldersConfig().folders).toEqual([folder])

    const trustedFile = join(configDir, 'trusted-folders.json')
    expect(existsSync(trustedFile)).toBe(true)
    const saved = JSON.parse(readFileSync(trustedFile, 'utf8'))
    expect(saved.folders).toEqual([folder])

    const listed = expectText(await call('list', {} as never))
    expect(listed.value).toContain(folder)

    const removed = expectText(await call(`remove ${folder}`, {} as never))
    expect(removed.value).toContain(`Removed trusted folder: ${folder}`)
    expect(loadTrustedFoldersConfig().folders).toEqual([])
  })

  test('reports duplicate and missing folders clearly', async () => {
    const configDir = setupTempConfigDir()
    const folder = join(configDir, 'workspace')

    expectText(await call(`add ${folder}`, {} as never))
    const duplicate = expectText(await call(`add ${folder}`, {} as never))
    expect(duplicate.value).toBe(`Already trusted: ${folder}`)

    const missing = expectText(
      await call(`remove ${join(configDir, 'missing')}`, {} as never),
    )
    expect(missing.value).toContain('Not found:')
  })
})
