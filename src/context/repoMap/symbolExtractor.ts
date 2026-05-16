// @ts-nocheck
import { readFileSync } from 'fs'
import { join } from 'path'
import { getLanguageForFile } from './gitFiles.js'
import { createParser, loadLanguage, loadQuery } from './parser.js'
import type { FileTags, Tag } from './types.js'

function buildFallbackTags(
  source: string,
  filePath: string,
  language: 'typescript' | 'javascript' | 'python',
): FileTags {
  const tags: Tag[] = []
  const seen = new Set<string>()
  const lines = source.split('\n')

  const addTag = (
    kind: 'def' | 'ref',
    name: string,
    lineIndex: number,
    subKind?: string,
  ) => {
    const key = `${kind}:${name}:${lineIndex}`
    if (!name || seen.has(key)) return
    seen.add(key)
    tags.push({
      kind,
      name,
      line: lineIndex + 1,
      signature: lines[lineIndex]?.trimEnd() ?? '',
      subKind,
    })
  }

  const definitionMatchers =
    language === 'python'
      ? [
          { regex: /^\s*def\s+([A-Za-z_]\w*)\s*\(/, subKind: 'function' },
          { regex: /^\s*class\s+([A-Za-z_]\w*)\b/, subKind: 'class' },
        ]
      : [
          {
            regex: /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
            subKind: 'function',
          },
          {
            regex: /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
            subKind: 'function',
          },
          {
            regex: /^\s*export\s+class\s+([A-Za-z_$][\w$]*)\b/,
            subKind: 'class',
          },
          {
            regex: /^\s*class\s+([A-Za-z_$][\w$]*)\b/,
            subKind: 'class',
          },
          {
            regex: /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)\b/,
            subKind: 'interface',
          },
          {
            regex: /^\s*export\s+type\s+([A-Za-z_$][\w$]*)\b/,
            subKind: 'type',
          },
          {
            regex:
              /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/,
            subKind: 'variable',
          },
        ]

  const importMatchers =
    language === 'python'
      ? [
          /^\s*from\s+[\w.]+\s+import\s+(.+)$/,
          /^\s*import\s+(.+)$/,
        ]
      : [
          /^\s*import\s+type\s+\{([^}]+)\}\s+from\b/,
          /^\s*import\s+\{([^}]+)\}\s+from\b/,
          /^\s*import\s+([A-Za-z_$][\w$]*)\s+from\b/,
        ]

  for (const [lineIndex, line] of lines.entries()) {
    for (const matcher of definitionMatchers) {
      const match = line.match(matcher.regex)
      if (match?.[1]) {
        addTag('def', match[1], lineIndex, matcher.subKind)
      }
    }

    for (const regex of importMatchers) {
      const match = line.match(regex)
      if (!match?.[1]) continue

      const names = match[1]
        .split(',')
        .map(part => part.trim())
        .map(part => part.replace(/^type\s+/, ''))
        .map(part => part.replace(/\s+as\s+.+$/, ''))
        .map(part => part.replace(/^\{|\}$/g, ''))
        .filter(Boolean)

      for (const name of names) {
        addTag('ref', name, lineIndex, 'import')
      }
    }

    const callRegex = /\b([A-Za-z_$][\w$]*)\s*\(/g
    for (const match of line.matchAll(callRegex)) {
      const name = match[1]
      if (!name || ['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
        continue
      }
      addTag('ref', name, lineIndex, 'call')
    }
  }

  return { path: filePath, tags }
}

/**
 * Extract definition and reference tags from a single source file.
 * Returns null if the file can't be parsed (unsupported language, parse error, etc).
 */
export async function extractTags(
  filePath: string,
  root: string,
): Promise<FileTags | null> {
  const language = getLanguageForFile(filePath)
  if (!language) return null

  const absolutePath = join(root, filePath)
  let source: string
  try {
    source = readFileSync(absolutePath, 'utf-8')
  } catch {
    return null
  }

  const lines = source.split('\n')

  const parser = await createParser(language)
  if (!parser) {
    return buildFallbackTags(source, filePath, language)
  }

  const querySource = loadQuery(language)
  if (!querySource) {
    parser.delete()
    return buildFallbackTags(source, filePath, language)
  }

  try {
    const tree = parser.parse(source) as {
      rootNode: unknown
    }

    const lang = await loadLanguage(language)
    if (!lang) {
      parser.delete()
      return null
    }

    // Use the non-deprecated Query constructor
    const { Query } = await import('web-tree-sitter')
    const query = new Query(lang, querySource) as {
      matches(rootNode: unknown): Array<{
        pattern: number
        captures: Array<{
          name: string
          node: {
            text: string
            startPosition: { row: number; column: number }
            endPosition: { row: number; column: number }
          }
        }>
      }>
    }

    const matches = query.matches(tree.rootNode)
    const tags: Tag[] = []
    const seen = new Set<string>() // dedup by kind+name+line

    for (const match of matches) {
      let name: string | null = null
      let kind: 'def' | 'ref' | null = null
      let subKind: string | undefined
      let lineRow = 0

      for (const capture of match.captures) {
        const captureName = capture.name

        // Name captures: name.definition.X or name.reference.X
        if (captureName.startsWith('name.definition.')) {
          name = capture.node.text
          kind = 'def'
          subKind = captureName.slice('name.definition.'.length)
          lineRow = capture.node.startPosition.row
        } else if (captureName.startsWith('name.reference.')) {
          name = capture.node.text
          kind = 'ref'
          subKind = captureName.slice('name.reference.'.length)
          lineRow = capture.node.startPosition.row
        }
      }

      if (name && kind) {
        const key = `${kind}:${name}:${lineRow}`
        if (!seen.has(key)) {
          seen.add(key)
          const line = lineRow + 1 // convert 0-based to 1-based
          const signature = lines[lineRow]?.trimEnd() ?? ''
          tags.push({ kind, name, line, signature, subKind })
        }
      }
    }

    parser.delete()
    return { path: filePath, tags }
  } catch {
    parser.delete()
    return buildFallbackTags(source, filePath, language)
  }
}
