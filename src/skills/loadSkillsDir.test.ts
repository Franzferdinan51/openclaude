import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { getSkillDirCommands, clearSkillCaches } from './loadSkillsDir.ts'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

function writeSkill(rootDir: string, skillPath: string): void {
  const skillDir = join(rootDir, '.claude', 'skills', ...skillPath.split('/'))
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\ndescription: ${skillPath}\n---\n# ${skillPath}\n`,
    'utf8',
  )
}

test('loads flat and nested skills with colon namespaces', async () => {
  await acquireSharedMutationLock('loadSkillsDir.test.ts')
  const configDir = mkdtempSync(join(tmpdir(), 'openclaude-skills-'))
  const cwd = join(configDir, 'workspace')
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR

  try {
    mkdirSync(cwd, { recursive: true })
    writeSkill(configDir, 'flat-skill')
    writeSkill(configDir, 'git/commit')
    writeSkill(configDir, 'frontend/react/form')

    process.env.CLAUDE_CONFIG_DIR = configDir
    clearSkillCaches()

    const skills = await getSkillDirCommands(cwd)
    const promptSkills = skills.filter(skill => skill.type === 'prompt')
    const skillNames = promptSkills.map(skill => skill.name).sort()

    assert.deepEqual(skillNames, [
      'flat-skill',
      'frontend:react:form',
      'git:commit',
    ])

    const nestedSkill = promptSkills.find(skill => skill.name === 'git:commit')
    assert.ok(nestedSkill)
    assert.equal(nestedSkill.skillRoot, join(configDir, '.claude', 'skills', 'git', 'commit'))

    const deepSkill = promptSkills.find(
      skill => skill.name === 'frontend:react:form',
    )
    assert.ok(deepSkill)
    assert.equal(
      deepSkill.skillRoot,
      join(configDir, '.claude', 'skills', 'frontend', 'react', 'form'),
    )
  } finally {
    try {
      if (originalConfigDir === undefined) {
        delete process.env.CLAUDE_CONFIG_DIR
      } else {
        process.env.CLAUDE_CONFIG_DIR = originalConfigDir
      }
      clearSkillCaches()
      rmSync(configDir, { recursive: true, force: true })
    } finally {
      releaseSharedMutationLock()
    }
  }
})

test('loads skill commands from symlinked skill directories', async (t) => {
  await acquireSharedMutationLock('loadSkillsDir.symlink.test.ts')
  const configDir = mkdtempSync(join(tmpdir(), 'duckhive-symlinked-skills-'))
  const cwd = join(configDir, 'workspace')
  const externalRoot = join(configDir, 'external')
  const externalSkill = join(externalRoot, 'release-helper')
  const localSkillsRoot = join(configDir, '.claude', 'skills')
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR

  try {
    mkdirSync(cwd, { recursive: true })
    mkdirSync(externalSkill, { recursive: true })
    mkdirSync(localSkillsRoot, { recursive: true })
    writeFileSync(
      join(externalSkill, 'SKILL.md'),
      `---\ndescription: symlinked skill\n---\n# release-helper\n`,
      'utf8',
    )

    try {
      symlinkSync(externalSkill, join(localSkillsRoot, 'release-helper'), 'junction')
    } catch (error) {
      t.skip(`symlinks unavailable in test environment: ${error}`)
      return
    }

    process.env.CLAUDE_CONFIG_DIR = configDir
    clearSkillCaches()

    const skills = await getSkillDirCommands(cwd)
    const promptSkills = skills.filter(skill => skill.type === 'prompt')
    const skill = promptSkills.find(candidate => candidate.name === 'release-helper')

    assert.ok(skill)
    assert.equal(skill.skillRoot, join(localSkillsRoot, 'release-helper'))
  } finally {
    try {
      if (originalConfigDir === undefined) {
        delete process.env.CLAUDE_CONFIG_DIR
      } else {
        process.env.CLAUDE_CONFIG_DIR = originalConfigDir
      }
      clearSkillCaches()
      rmSync(configDir, { recursive: true, force: true })
    } finally {
      releaseSharedMutationLock()
    }
  }
})
