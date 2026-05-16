import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

const originalWarn = console.warn

async function importFreshParserModule() {
  return import(`./parser.ts?parser-test=${Date.now()}-${Math.random()}`)
}

describe('repoMap parser fallback logging', () => {
  beforeEach(() => {
    console.warn = mock(() => {}) as typeof console.warn
  })

  afterEach(() => {
    console.warn = originalWarn
    mock.restore()
  })

  test('logs a concise warning and returns null when language loading fails with an error', async () => {
    const initMock = mock(async () => {})
    const loadMock = mock(async () => {
      throw new Error('')
    })

    mock.module('web-tree-sitter', () => ({
      Parser: {
        init: initMock,
      },
      Language: {
        load: loadMock,
      },
    }))

    const parserModule = await importFreshParserModule()
    parserModule.clearParserCaches()

    const result = await parserModule.loadLanguage('typescript')

    expect(result).toBeNull()
    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(
      '[repoMap] Failed to load typescript grammar. Falling back to regex tag extraction.',
    )
  })

  test('includes a trimmed error message in the warning when available', async () => {
    const initMock = mock(async () => {})
    const loadMock = mock(async () => {
      throw new Error(' incompatible wasm ')
    })

    mock.module('web-tree-sitter', () => ({
      Parser: {
        init: initMock,
      },
      Language: {
        load: loadMock,
      },
    }))

    const parserModule = await importFreshParserModule()
    parserModule.clearParserCaches()

    await parserModule.loadLanguage('typescript')

    expect(console.warn).toHaveBeenCalledWith(
      '[repoMap] Failed to load typescript grammar. (incompatible wasm). Falling back to regex tag extraction.',
    )
  })
})
