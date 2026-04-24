import { describe, expect, test } from 'bun:test'

import {
  hasMiniMaxCliAuth,
  parseMiniMaxSearchOutput,
  resolveMiniMaxCliBinary,
} from './minimaxCli.js'

describe('MiniMax CLI search provider', () => {
  test('parses mmx JSON search results', () => {
    const hits = parseMiniMaxSearchOutput(JSON.stringify({
      results: [
        {
          title: 'MiniMax CLI',
          url: 'https://github.com/MiniMax-AI/cli',
          content: 'Official MiniMax CLI',
          source: 'github.com',
        },
      ],
    }))

    expect(hits).toEqual([
      {
        title: 'MiniMax CLI',
        url: 'https://github.com/MiniMax-AI/cli',
        description: 'Official MiniMax CLI',
        source: 'github.com',
      },
    ])
  })

  test('detects configured auth from MiniMax env', () => {
    expect(hasMiniMaxCliAuth({ MINIMAX_API_KEY: 'sk-test' })).toBe(true)
    expect(hasMiniMaxCliAuth({ MINIMAX_OAUTH_TOKEN: 'token-test' })).toBe(true)
  })

  test('uses explicit MMX_BIN before searching PATH', () => {
    expect(resolveMiniMaxCliBinary({ MMX_BIN: '/tmp/mmx-test' })).toBe('/tmp/mmx-test')
  })
})
