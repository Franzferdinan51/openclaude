import { afterEach, describe, expect, mock, test } from 'bun:test'
import { call, setSkillTestDeps } from './skill-impl.js'

afterEach(() => {
  setSkillTestDeps(null)
})

describe('/skill command', () => {
  test('shows terminal and REPL usage in help output', async () => {
    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Skill Workshop')
    expect(result.value).toContain('duckhive skill search <query>')
    expect(result.value).toContain('duckhive skill install <slug>')
    expect(result.value).toContain('/skill search <query>')
  })

  test('creates a scaffold skill from bare skill name input', async () => {
    const runSkillWorkshop = mock(async (input: any) => ({
      data: {
        success: true,
        action: 'pending',
        skill: input.skillName,
        path: '/tmp/skills/release-readiness/SKILL.md',
      },
    }))
    setSkillTestDeps({ runSkillWorkshop: runSkillWorkshop as never })

    const result = await call('"release readiness"', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(runSkillWorkshop).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        skillName: 'release readiness',
      }),
      expect.anything(),
      undefined,
      undefined,
    )
    expect(result.value).toContain('Skill created')
    expect(result.value).toContain('release readiness')
  })

  test('preserves escaped quotes in local skill names', async () => {
    const runSkillWorkshop = mock(async (input: any) => ({
      data: {
        success: true,
        action: 'pending',
        skill: input.skillName,
        path: '/tmp/skills/release-readiness/SKILL.md',
      },
    }))
    setSkillTestDeps({ runSkillWorkshop: runSkillWorkshop as never })

    const result = await call('"release \\"readiness\\""', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(runSkillWorkshop).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        skillName: 'release "readiness"',
      }),
      expect.anything(),
      undefined,
      undefined,
    )
    expect(result.value).toContain('release "readiness"')
  })

  test('rejects unterminated skill names before creating skills', async () => {
    const runSkillWorkshop = mock(async () => ({
      data: {
        success: true,
        action: 'pending',
      },
    }))
    setSkillTestDeps({ runSkillWorkshop: runSkillWorkshop as never })

    const result = await call('"release readiness', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Unterminated quoted string in /skill arguments.')
    expect(result.value).toContain('Skill Workshop')
    expect(runSkillWorkshop).not.toHaveBeenCalled()
  })

  test('lists saved skills', async () => {
    setSkillTestDeps({
      runSkillWorkshop: (async () => ({
        data: {
          success: true,
          action: 'list',
          skills: ['release-readiness', 'incident-triage'],
        },
      })) as never,
    })

    const result = await call('list', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Saved skills')
    expect(result.value).toContain('release-readiness')
    expect(result.value).toContain('incident-triage')
  })

  test('searches ClawHub skills', async () => {
    const searchClawHubSkills = mock(async () => [
      {
        slug: 'calendar',
        displayName: 'Calendar',
        summary: 'Manage calendars',
        ownerHandle: 'openclaw',
      },
    ])
    setSkillTestDeps({
      searchClawHubSkills: searchClawHubSkills as never,
    })

    const result = await call('search "calendar"', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('ClawHub search: calendar')
    expect(result.value).toContain('calendar (Calendar)')
    expect(result.value).toContain('Manage calendars')
    expect(searchClawHubSkills).toHaveBeenCalledWith('calendar')
  })

  test('preserves escaped quotes in ClawHub search queries', async () => {
    const searchClawHubSkills = mock(async () => [])
    setSkillTestDeps({ searchClawHubSkills: searchClawHubSkills as never })

    const result = await call('search "calendar \\"sync\\""', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(searchClawHubSkills).toHaveBeenCalledWith('calendar "sync"')
    expect(result.value).toContain('No skills found for: calendar "sync"')
  })

  test('rejects unterminated ClawHub search queries before network calls', async () => {
    const searchClawHubSkills = mock(async () => [])
    setSkillTestDeps({ searchClawHubSkills: searchClawHubSkills as never })

    const result = await call('search "calendar sync', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Unterminated quoted string in /skill arguments.')
    expect(searchClawHubSkills).not.toHaveBeenCalled()
  })

  test('inspects a ClawHub skill', async () => {
    setSkillTestDeps({
      inspectClawHubSkill: (async () => ({
        slug: 'calendar',
        displayName: 'Calendar',
        summary: 'Manage calendars',
        latestVersion: '1.0.0',
        changelog: 'Initial release',
        ownerHandle: 'openclaw',
        ownerDisplayName: 'OpenClaw',
        metadata: null,
        moderation: {
          verdict: 'suspicious',
          isSuspicious: true,
          isMalwareBlocked: false,
          reasonCodes: ['network-access'],
          summary: 'Uses network APIs',
        },
      })) as never,
    })

    const result = await call('inspect calendar', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('ClawHub skill: calendar')
    expect(result.value).toContain('Latest version: 1.0.0')
    expect(result.value).toContain('Moderation: suspicious')
    expect(result.value).toContain('Moderation summary: Uses network APIs')
    expect(result.value).toContain('Reason codes: network-access')
    expect(result.value).toContain('Initial release')
  })

  test('installs a ClawHub skill', async () => {
    setSkillTestDeps({
      installClawHubSkill: (async () => ({
        skillPath: '/tmp/skills/calendar/SKILL.md',
        version: '1.0.0',
      })) as never,
    })

    const result = await call('install calendar', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('ClawHub install complete')
    expect(result.value).toContain('calendar')
    expect(result.value).toContain('/tmp/skills/calendar/SKILL.md')
  })

  test('reads an existing skill', async () => {
    setSkillTestDeps({
      runSkillWorkshop: (async () => ({
        data: {
          success: true,
          action: 'read',
          content: '# Release Readiness\n\nChecklist',
        },
      })) as never,
    })

    const result = await call('read release-readiness', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Skill: release-readiness')
    expect(result.value).toContain('# Release Readiness')
  })

  test('deletes a skill', async () => {
    const runSkillWorkshop = mock(async () => ({
      data: {
        success: true,
        action: 'delete',
      },
    }))
    setSkillTestDeps({ runSkillWorkshop: runSkillWorkshop as never })

    const result = await call('delete old-skill', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Skill deleted: old-skill')
  })

  test('runs auto-capture for repeated memory topics', async () => {
    const runAutoCapture = mock(async () => ({
      topicsScanned: 4,
      eligibleTopics: [
        { topic: 'goal-command-workflow', slug: 'goal-command-workflow', count: 3 },
      ],
      skippedExisting: [],
      created: [
        { topic: 'goal-command-workflow', slug: 'goal-command-workflow', count: 3 },
      ],
      errors: [],
      throttled: false,
    }))
    setSkillTestDeps({ runAutoCapture: runAutoCapture as never })

    const result = await call('--capture', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(runAutoCapture).toHaveBeenCalled()
    expect(result.value).toContain('Skill auto-capture scan complete')
    expect(result.value).toContain('Created: 1')
    expect(result.value).toContain('goal-command-workflow')
  })
})
