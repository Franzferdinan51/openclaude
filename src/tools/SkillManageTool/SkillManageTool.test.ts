import { afterEach, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getSkillManageSkillsDir,
  setSkillManageToolTestDeps,
  SkillManageTool,
} from './SkillManageTool.js'

let configHomeDir: string | undefined

afterEach(() => {
  setSkillManageToolTestDeps(null)
  if (configHomeDir) {
    rmSync(configHomeDir, { recursive: true, force: true })
    configHomeDir = undefined
  }
})

test('uses DuckHive config home for the managed skills directory', () => {
  expect(getSkillManageSkillsDir('C:/DuckHive')).toBe(
    join('C:/DuckHive', 'skills'),
  )
})

test('creates and lists skills inside DuckHive config home', async () => {
  configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-skill-manage-'))
  setSkillManageToolTestDeps({
    getClaudeConfigHomeDir: () => configHomeDir!,
  })

  const created = await SkillManageTool.call(
    {
      action: 'create',
      name: 'Release Readiness',
      description: 'Checks release blockers',
      content: '# release-readiness\n\nChecklist skill',
    },
    {} as never,
    undefined as never,
    undefined as never,
  )

  expect(created.data.success).toBe(true)
  const skillPath = join(
    configHomeDir,
    'skills',
    'release-readiness',
    'SKILL.md',
  )
  expect(existsSync(skillPath)).toBe(true)
  expect(readFileSync(skillPath, 'utf8')).toContain('Checks release blockers')

  const listed = await SkillManageTool.call(
    {
      action: 'list',
    },
    {} as never,
    undefined as never,
    undefined as never,
  )

  expect(listed.data.success).toBe(true)
  expect(listed.data.skills).toEqual([
    expect.objectContaining({
      name: 'release-readiness',
      path: skillPath,
    }),
  ])
})
