import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getTrustedFoldersConfigPath,
  getLegacyTrustedFoldersConfigPath,
  loadTrustedFoldersConfig,
  saveTrustedFoldersConfig,
} from './TrustedFoldersTool.ts'

let configHomeDir: string
let homeDir: string

describe('TrustedFoldersTool', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-trusted-tool-config-'))
    homeDir = mkdtempSync(join(tmpdir(), 'duckhive-trusted-tool-home-'))
  })

  afterEach(() => {
    rmSync(configHomeDir, { recursive: true, force: true })
    rmSync(homeDir, { recursive: true, force: true })
  })

  test('writes trusted folders to DuckHive config home and reads legacy Claude config as fallback', () => {
    const configPath = getTrustedFoldersConfigPath(configHomeDir)
    expect(configPath).toBe(
      join(configHomeDir, 'trusted-folders.json'),
    )
    saveTrustedFoldersConfig(
      { paths: ['/workspace/project'], enabled: false },
      configPath,
    )

    const stored = JSON.parse(
      readFileSync(configPath, 'utf8'),
    ) as { paths: string[] }
    expect(stored.paths).toEqual(['/workspace/project'])

    const legacyPath = getLegacyTrustedFoldersConfigPath(homeDir)
    mkdirSync(join(homeDir, '.claude'), { recursive: true })
    writeFileSync(
      legacyPath,
      JSON.stringify({ paths: ['/legacy/path'], enabled: true }),
      'utf8',
    )

    const loaded = loadTrustedFoldersConfig([
      join(configHomeDir, 'missing.json'),
      legacyPath,
    ])
    expect(loaded.paths).toEqual(['/legacy/path'])
    expect(loaded.enabled).toBe(true)

    const preferred = loadTrustedFoldersConfig([
      configPath,
      legacyPath,
    ])
    expect(preferred.paths).toEqual(['/workspace/project'])
    expect(preferred.enabled).toBe(false)
  })
})
