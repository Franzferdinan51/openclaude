import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import {
  assertValidClawHubSkillSlug,
  inspectClawHubSkill,
  installClawHubSkill,
  readInstalledClawHubOrigin,
  searchClawHubSkills,
  setClawHubSkillServiceTestDeps,
} from './skillHub.js'

afterEach(() => {
  setClawHubSkillServiceTestDeps(null)
  delete process.env.DUCKHIVE_CLAWHUB_REGISTRY
  delete process.env.CLAWHUB_REGISTRY
})

describe('ClawHub skill service', () => {
  test('validates skill slugs before registry lookup or local install paths', async () => {
    const calls: string[] = []
    setClawHubSkillServiceTestDeps({
      fetchImpl: (async (input: string | URL) => {
        calls.push(String(input))
        return new Response('{}')
      }) as unknown as typeof fetch,
    })

    expect(() => assertValidClawHubSkillSlug('calendar-helper_1.2')).not.toThrow()
    expect(() => assertValidClawHubSkillSlug('../escape')).toThrow(/Invalid ClawHub skill slug/)
    await expect(inspectClawHubSkill('../escape')).rejects.toThrow(
      /Invalid ClawHub skill slug/,
    )
    await expect(installClawHubSkill('calendar/../../escape')).rejects.toThrow(
      /Invalid ClawHub skill slug/,
    )
    await expect(readInstalledClawHubOrigin('C:/escape')).rejects.toThrow(
      /Invalid ClawHub skill slug/,
    )
    expect(calls).toHaveLength(0)
  })

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
      }) as unknown as typeof fetch,
    })

    const results = await searchClawHubSkills('calendar', 3)

    const searchUrl = new URL(calls[0]!)
    expect(searchUrl.pathname).toBe('/api/v1/search')
    expect(searchUrl.searchParams.get('q')).toBe('calendar')
    expect(searchUrl.searchParams.get('limit')).toBe('3')
    expect(searchUrl.searchParams.get('nonSuspiciousOnly')).toBe('true')
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
            moderation: {
              verdict: 'clean',
              isSuspicious: false,
              isMalwareBlocked: false,
              reasonCodes: [],
              summary: 'No issues detected',
            },
          }),
        )) as unknown as typeof fetch,
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
      moderation: {
        verdict: 'clean',
        isSuspicious: false,
        isMalwareBlocked: false,
        reasonCodes: [],
        summary: 'No issues detected',
      },
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
        return new Response(archive as unknown as BodyInit)
      }) as unknown as typeof fetch,
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
        return new Response(archive as unknown as BodyInit)
      }) as unknown as typeof fetch,
    })

    await expect(installClawHubSkill('calendar')).rejects.toThrow(
      /Unsafe skill archive path/,
    )
  })

  test('rejects archives that do not contain a root SKILL.md', async () => {
    const configHome = await mkdtemp(join(tmpdir(), 'duckhive-clawhub-'))
    const archive = zipSync({
      'README.md': new TextEncoder().encode('# Not a DuckHive skill\n'),
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
        return new Response(archive as unknown as BodyInit)
      }) as unknown as typeof fetch,
    })

    await expect(installClawHubSkill('calendar')).rejects.toThrow(
      /missing root SKILL\.md/,
    )
    await expect(stat(join(configHome, 'skills', 'calendar'))).rejects.toThrow()
  })

  test('refuses to download a malware-blocked skill', async () => {
    let callCount = 0
    setClawHubSkillServiceTestDeps({
      fetchImpl: (async () => {
        callCount += 1
        return new Response(
          JSON.stringify({
            skill: {
              slug: 'malware',
              displayName: 'Malware',
              summary: 'Blocked skill',
            },
            latestVersion: {
              version: '9.9.9',
            },
            moderation: {
              verdict: 'malicious',
              isSuspicious: true,
              isMalwareBlocked: true,
              reasonCodes: ['malware'],
              summary: 'Blocked by registry moderation',
            },
          }),
        )
      }) as unknown as typeof fetch,
    })

    await expect(installClawHubSkill('malware')).rejects.toThrow(
      /registry moderation verdict is malicious/,
    )
    expect(callCount).toBe(1)
  })
})
