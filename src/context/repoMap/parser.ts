import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { pathToFileURL } from 'url'
import type { SupportedLanguage } from './types.js'

// Resolve project root in both source and bundled modes.
// In source (bun test/dev): import.meta.url is src/context/repoMap/parser.ts → go up 4 levels
// In bundle (node dist/cli.mjs): import.meta.url is dist/cli.mjs → go up 2 levels
const __filename = fileURLToPath(import.meta.url)
const __projectRoot = join(
  __filename,
  process.env.NODE_ENV === 'test' ? '../../../../' : '../../',
)

// web-tree-sitter types
type TreeSitterParser = {
  parse(input: string): { rootNode: unknown }
  setLanguage(lang: unknown): void
  delete(): void
}

type TreeSitterLanguage = {
  query(source: string): unknown
}

// The actual module exports { Parser, Language } as named exports
let ParserClass: (new () => TreeSitterParser) & {
  init(opts?: { locateFile?: (file: string) => string }): Promise<void>
} | null = null
let LanguageLoader: {
  load(path: string | Uint8Array): Promise<TreeSitterLanguage>
} | null = null

let initialized = false
const languageCache = new Map<SupportedLanguage, TreeSitterLanguage>()
const failedLanguages = new Set<SupportedLanguage>()
const queryCache = new Map<SupportedLanguage, string>()

function formatParserError(err: unknown): string {
  if (err instanceof Error) {
    const trimmed = err.message.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
    if (err.name && err.name !== 'Error') {
      return err.name
    }
    return 'unknown error'
  }

  if (typeof err === 'string' && err.trim().length > 0) {
    return err.trim()
  }

  return 'unknown error'
}

/** Resolve the path to the tree-sitter WASM file. */
function getTreeSitterWasmPath(): string {
  // Try require.resolve first (works in source mode with node_modules)
  try {
    return require.resolve('web-tree-sitter/web-tree-sitter.wasm')
  } catch {
    // Fallback: relative to project root
    return join(__projectRoot, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm')
  }
}

/** Resolve the path to a language WASM grammar file. */
function getLanguageWasmPath(language: SupportedLanguage): string {
  const wasmName = language === 'typescript' ? 'tree-sitter-typescript' :
    language === 'javascript' ? 'tree-sitter-javascript' :
      `tree-sitter-${language}`

  try {
    const wasmDir = resolve(
      require.resolve('tree-sitter-wasms/package.json'),
      '..',
      'out',
    )
    return join(wasmDir, `${wasmName}.wasm`)
  } catch {
    return join(__projectRoot, 'node_modules', 'tree-sitter-wasms', 'out', `${wasmName}.wasm`)
  }
}

/** Resolve the path to a tag query .scm file for the given language. */
function getQueryPath(language: SupportedLanguage): string {
  // Try source location first (works in both source and when queries are alongside the bundle)
  const sourcePath = join(__projectRoot, 'src', 'context', 'repoMap', 'queries', `${language}-tags.scm`)
  if (existsSync(sourcePath)) {
    return sourcePath
  }
  // Fallback: relative to this file (source mode)
  return join(fileURLToPath(import.meta.url), '..', 'queries', `${language}-tags.scm`)
}

/** Initialize the tree-sitter WASM module. */
export async function initParser(): Promise<void> {
  if (initialized) return

  try {
    const mod = await import('web-tree-sitter')
    ParserClass = mod.Parser as typeof ParserClass
    LanguageLoader = mod.Language as unknown as typeof LanguageLoader

    const wasmPath = getTreeSitterWasmPath()
    await ParserClass!.init({
      locateFile: () => pathToFileURL(wasmPath).toString(),
    })
    initialized = true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[repoMap] Failed to initialize tree-sitter:', err)
    throw err
  }
}

/** Load a language grammar. Cached after first load. */
export async function loadLanguage(language: SupportedLanguage): Promise<TreeSitterLanguage | null> {
  if (languageCache.has(language)) {
    return languageCache.get(language)!
  }
  if (failedLanguages.has(language)) {
    return null
  }

  if (!initialized) {
    await initParser()
  }

  try {
    const wasmPath = getLanguageWasmPath(language)
    const lang = await LanguageLoader!.load(wasmPath)
    languageCache.set(language, lang)
    return lang
  } catch (err) {
    failedLanguages.add(language)
    const errorMessage = formatParserError(err)
    const suffix =
      errorMessage === 'unknown error'
        ? ' Falling back to regex tag extraction.'
        : ` (${errorMessage}). Falling back to regex tag extraction.`
    // eslint-disable-next-line no-console
    console.warn(`[repoMap] Failed to load ${language} grammar.${suffix}`)
    return null
  }
}

/** Load the tag query for a language. Cached after first load. */
export function loadQuery(language: SupportedLanguage): string | null {
  if (queryCache.has(language)) {
    return queryCache.get(language)!
  }

  try {
    const queryPath = getQueryPath(language)
    const content = readFileSync(queryPath, 'utf-8')
    queryCache.set(language, content)
    return content
  } catch {
    return null
  }
}

/** Create a new parser instance with the given language set. */
export async function createParser(language: SupportedLanguage): Promise<TreeSitterParser | null> {
  if (!initialized) {
    await initParser()
  }

  const lang = await loadLanguage(language)
  if (!lang) return null

  try {
    const parser = new ParserClass!()
    parser.setLanguage(lang)
    return parser
  } catch {
    return null
  }
}

/** Clear all caches (useful for testing). */
export function clearParserCaches(): void {
  languageCache.clear()
  failedLanguages.clear()
  queryCache.clear()
  initialized = false
  ParserClass = null
  LanguageLoader = null
}
