import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import {
  inspectClawHubSkill,
  installClawHubSkill,
  searchClawHubSkills,
  setClawHubSkillServiceTestDeps,
} from './skillHub.js'

afterEach(() => {
  setClawHubSkillServiceTestDeps(null)
  delete process.env.DUCKHIVE_CLAWHUB_REGISTRY
  delete process.env.CLAWHUB_REGISTRY
})

describe('ClawHub skill service', () => {
  test('searches skills through the ClawHub search API', async () => {
    const calls: string[] = []
    setClawHubSkillServiceTestDeps({
      fetchImpl: (async (input: string | URL) => {
        calls.push(String(input))
        return new Response(
          JSON.stringify({
            results: [
              {
                slug: 'calendar',
                displayName: 'Calendar',
                summary: 'Manage calendars',
                score: 4.2,
                ownerHandle: 'openclaw',
              },
            ],
          }),
        )
      }) as typeof fetch,
    })

    const results = await searchClawHubSkills('calendar', 3)

    expect(calls[0]).toContain('/api/v1/search?q=calendar&limit=3')
    expect(results).toEqual([
      expect.objectContaining({
        slug: 'calendar',
        displayName: 'Calendar',
        summary: 'Manage calendars',
      }),
    ])
  })

  test('inspects a skill through the ClawHub detail API', async () => {
    setClawHubSkillServiceTestDeps({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            skill: {
              slug: 'calendar',
              displayName: 'Calendar',
              summary: 'Manage calendars',
              updatedAt: 123,
            },
            latestVersion: {
              version: '1.2.3',
              changelog: 'Initial release',
            },
            owner: {
              handle: 'openclaw',
              displayName: 'OpenClaw',
            },
            metadata: {
              os: ['macos'],
            },
          }),
        )) as typeof fetch,
    })

    const detail = await inspectClawHubSkill('calendar')

    expect(detail).toEqual({
      slug: 'calendar',
      displayName: 'Calendar',
      summary: 'Manage calendars',
      latestVersion: '1.2.3',
      changelog: 'Initial release',
      updatedAt: 123,
      ownerHandle: 'openclaw',
      ownerDisplayName: 'OpenClaw',
      metadata: { os: ['macos'] },
    })
  })

  test('downloads and installs a skill archive safely', async () => {
    const configHome = await mkdtemp(join(tmpdir(), 'duckhive-clawhub-'))
    const archive = zipSync({
      'SKILL.md': new TextEncoder().encode('# Calendar\n'),
      'scripts/setup.sh': new TextEncoder().encode('echo hi\n'),
    })
    let callIndex = 0

    setClawHubSkillServiceTestDeps({
      getConfigHomeDir: () => configHome,
      fetchImpl: (async () => {
        callIndex += 1
        if (callIndex === 1) {
          return new Response(
            JSON.stringify({
              skill: {
                slug: 'calendar',
                displayName: 'Calendar',
                summary: 'Manage calendars',
              },
              latestVersion: {
                version: '1.0.0',
              },
            }),
          )
        }
        return new Response(archive)
      }) as typeof fetch,
    })

    const result = await installClawHubSkill('calendar')

    expect(result.version).toBe('1.0.0')
    expect(await readFile(result.skillPath, 'utf8')).toContain('# Calendar')
    await stat(join(configHome, 'skills', 'calendar', 'scripts', 'setup.sh'))
    const origin = JSON.parse(
      await readFile(
        join(configHome, 'skills', 'calendar', '.clawhub', 'origin.json'),
        'utf8',
      ),
    )
    expect(origin).toEqual(
      expect.objectContaining({
        source: 'clawhub',
        slug: 'calendar',
        latestVersion: '1.0.0',
      }),
    )
  })

  test('rejects unsafe archive paths', async () => {
    const configHome = await mkdtemp(join(tmpdir(), 'duckhive-clawhub-'))
    const archive = zipSync({
      '../escape.txt': new TextEncoder().encode('bad'),
    })
    let callIndex = 0

    setClawHubSkillServiceTestDeps({
      getConfigHomeDir: () => configHome,
      fetchImpl: (async () => {
        callIndex += 1
        if (callIndex === 1) {
          return new Response(
            JSON.stringify({
              skill: { slug: 'calendar' },
              latestVersion: { version: '1.0.0' },
            }),
          )
        }
        return new Response(archive)
      }) as typeof fetch,
    })

    await expect(installClawHubSkill('calendar')).rejects.toThrow(
      /Unsafe skill archive path/,
    )
  })
})
