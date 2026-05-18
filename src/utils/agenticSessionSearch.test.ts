import { expect, test } from 'bun:test'
import type { LogOption, SerializedMessage } from '../types/logs.js'
import { agenticSessionSearch } from './agenticSessionSearch.js'

function message(text: string): SerializedMessage {
  return {
    type: 'user',
    uuid: crypto.randomUUID(),
    parentUuid: null,
    timestamp: '2026-05-18T00:00:00.000Z',
    cwd: 'C:\\repo',
    userType: 'external',
    sessionId: crypto.randomUUID(),
    version: 'test',
    isSidechain: false,
    message: {
      role: 'user',
      content: text,
    },
  } as SerializedMessage
}

function log(overrides: Partial<LogOption>): LogOption {
  return {
    date: '2026-05-18T00-00-00-000Z',
    messages: [],
    value: 0,
    created: new Date('2026-05-18T00:00:00.000Z'),
    modified: new Date('2026-05-18T00:00:00.000Z'),
    firstPrompt: 'No prompt',
    messageCount: 0,
    isSidechain: false,
    ...overrides,
  }
}

test('agenticSessionSearch ranks deterministic metadata matches without a model call', async () => {
  const tagged = log({
    customTitle: 'Budget planning',
    tag: 'telegram',
    modified: new Date('2026-05-18T03:00:00.000Z'),
  })
  const title = log({
    customTitle: 'Telegram bot cleanup',
    modified: new Date('2026-05-18T04:00:00.000Z'),
  })
  const unrelated = log({
    customTitle: 'Provider routing',
    summary: 'OpenAI and MiniMax defaults',
    modified: new Date('2026-05-18T05:00:00.000Z'),
  })

  const results = await agenticSessionSearch('telegram', [
    unrelated,
    title,
    tagged,
  ])

  expect(results).toEqual([tagged, title])
})

test('agenticSessionSearch searches transcript excerpts and quoted phrases locally', async () => {
  const transcriptHit = log({
    customTitle: 'Runtime work',
    messages: [message('We fixed the "input freeze" by changing stdin mode.')],
  })
  const titleOnly = log({
    customTitle: 'Input planning without the key phrase',
    messages: [message('No matching phrase here.')],
  })

  const results = await agenticSessionSearch('"input freeze"', [
    titleOnly,
    transcriptHit,
  ])

  expect(results).toEqual([transcriptHit])
})

test('agenticSessionSearch treats OR syntax as broad literal recall', async () => {
  const android = log({ customTitle: 'Android screen control' })
  const telegram = log({ summary: 'Telegram channel adapter retries' })
  const unrelated = log({ customTitle: 'Budget cache report' })

  const results = await agenticSessionSearch('android OR telegram', [
    unrelated,
    telegram,
    android,
  ])

  expect(results).toEqual([android, telegram])
})
