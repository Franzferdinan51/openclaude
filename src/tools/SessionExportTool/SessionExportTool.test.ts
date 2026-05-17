import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { zipSync } from 'fflate'
import {
  SessionExportTool,
  getSessionExportsDir,
  setSessionExportToolTestDeps,
} from './SessionExportTool.ts'

let configHomeDir: string
let workspaceDir: string

describe('SessionExportTool', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-session-export-config-'))
    workspaceDir = mkdtempSync(join(tmpdir(), 'duckhive-session-export-workspace-'))
    setSessionExportToolTestDeps({ getClaudeConfigHomeDir: () => configHomeDir })
  })

  afterEach(() => {
    setSessionExportToolTestDeps(null)
    rmSync(configHomeDir, { recursive: true, force: true })
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  test('exports are stored under DuckHive config home', () => {
    expect(getSessionExportsDir()).toBe(join(configHomeDir, 'exports'))
  })

  test('exports, lists, and imports a session archive without shell zip utilities', async () => {
    writeFileSync(join(workspaceDir, 'AGENTS.md'), 'agent instructions', 'utf8')
    writeFileSync(join(configHomeDir, 'config.json'), '{"theme":"duck"}', 'utf8')
    writeFileSync(
      join(configHomeDir, 'history.jsonl'),
      '{"display":"older turn","pastedContents":{},"timestamp":1}\n{"display":"recent turn","pastedContents":{},"timestamp":2}\n',
      'utf8',
    )

    const exported = await SessionExportTool.call(
      { action: 'export', sessionName: 'release-ready', workspaceRoot: workspaceDir },
      {} as never,
      undefined as never,
      undefined as never,
    )
    expect(exported.data.success).toBe(true)
    expect(exported.data.zipPath).toContain(join(configHomeDir, 'exports'))

    const listed = await SessionExportTool.call(
      { action: 'list' },
      {} as never,
      undefined as never,
      undefined as never,
    )
    expect(listed.data.sessions?.some(s => s.name === 'release-ready')).toBe(true)

    writeFileSync(join(workspaceDir, 'AGENTS.md'), 'stale', 'utf8')
    const imported = await SessionExportTool.call(
      {
        action: 'import',
        sessionPath: exported.data.zipPath,
        workspaceRoot: workspaceDir,
      },
      {} as never,
      undefined as never,
      undefined as never,
    )
    expect(imported.data.success).toBe(true)
    expect(readFileSync(join(workspaceDir, 'AGENTS.md'), 'utf8')).toBe(
      'agent instructions',
    )
    expect(
      JSON.parse(readFileSync(join(configHomeDir, 'config.json'), 'utf8')),
    ).toMatchObject({ theme: 'duck' })
    expect(
      readFileSync(join(configHomeDir, 'history.jsonl'), 'utf8'),
    ).toContain(
      '"display":"recent turn"',
    )
  })

  test('rejects unsafe archive paths during import', async () => {
    const maliciousZipPath = join(configHomeDir, 'exports', 'session_bad.zip')
    mkdirSync(join(configHomeDir, 'exports'), { recursive: true })
    const zipped = zipSync({
      '../escape.txt': new TextEncoder().encode('owned'),
    })
    writeFileSync(maliciousZipPath, zipped)

    const imported = await SessionExportTool.call(
      {
        action: 'import',
        sessionPath: maliciousZipPath,
        workspaceRoot: workspaceDir,
      },
      {} as never,
      undefined as never,
      undefined as never,
    )

    expect(imported.data.success).toBe(false)
    expect(imported.data.error).toContain('Unsafe file path detected')
  })

  test('imports legacy history.json archives into active history.jsonl', async () => {
    const legacyZipPath = join(configHomeDir, 'exports', 'session_legacy.zip')
    mkdirSync(join(configHomeDir, 'exports'), { recursive: true })
    writeFileSync(
      join(configHomeDir, 'history.jsonl'),
      '{"display":"local turn","pastedContents":{},"timestamp":1}\n',
      'utf8',
    )

    const zipped = zipSync({
      'history.json': new TextEncoder().encode(
        JSON.stringify(['imported turn'], null, 2),
      ),
      'session.json': new TextEncoder().encode('{"name":"legacy"}'),
    })
    writeFileSync(legacyZipPath, zipped)

    const imported = await SessionExportTool.call(
      {
        action: 'import',
        sessionPath: legacyZipPath,
        workspaceRoot: workspaceDir,
      },
      {} as never,
      undefined as never,
      undefined as never,
    )

    expect(imported.data.success).toBe(true)
    const historyJsonl = readFileSync(join(configHomeDir, 'history.jsonl'), 'utf8')
    expect(historyJsonl).toContain('"display":"local turn"')
    expect(historyJsonl).toContain('"display":"imported turn"')
  })
})
