import { extname, isAbsolute, join } from 'path'

export type ExportFormat = 'text' | 'markdown' | 'json'

export function normalizeExportFormat(value: string): ExportFormat | null {
  switch (value.toLowerCase().trim()) {
    case 'text':
    case 'txt':
      return 'text'
    case 'markdown':
    case 'md':
      return 'markdown'
    case 'json':
      return 'json'
    default:
      return null
  }
}

export function inferExportFormatFromFilename(filename: string): ExportFormat | null {
  const ext = extname(filename)
  if (!ext || ext === '.') return null
  return normalizeExportFormat(ext.slice(1))
}

export function extensionForExportFormat(format: ExportFormat): '.txt' | '.md' | '.json' {
  switch (format) {
    case 'text':
      return '.txt'
    case 'markdown':
      return '.md'
    case 'json':
      return '.json'
  }
}

export function ensureExportFilenameExtension(
  filename: string,
  format: ExportFormat,
  { preserveMarkdownExtension = false }: { preserveMarkdownExtension?: boolean } = {},
): string {
  const currentExt = extname(filename)
  if (format === 'markdown' && preserveMarkdownExtension && currentExt.toLowerCase() === '.markdown') {
    return filename
  }

  const base = currentExt
    ? filename.slice(0, currentExt === '.' ? -1 : -currentExt.length)
    : filename
  return base + extensionForExportFormat(format)
}

export function resolveExportFilepath(cwd: string, filename: string): string {
  return isAbsolute(filename) ? filename : join(cwd, filename)
}

const SUPPORTED_FORMATS = 'Supported formats: text, markdown, json.'

function tokenizeExportArgs(args: string): {
  tokens: Array<{ value: string; quoted: boolean }>
  error?: string
} {
  const tokens: Array<{ value: string; quoted: boolean }> = []
  let current = ''
  let quote: '"' | "'" | null = null
  let tokenStarted = false
  let tokenQuoted = false

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!

    if (quote) {
      if (ch === quote) {
        quote = null
        continue
      }
      if (quote === '"' && ch === '\\' && i + 1 < args.length) {
        const next = args[i + 1]!
        if (next === '"' || next === '\\') {
          current += next
          i += 1
          continue
        }
      }
      current += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      tokenStarted = true
      tokenQuoted = true
      continue
    }

    if (/\s/.test(ch)) {
      if (tokenStarted) {
        tokens.push({ value: current, quoted: tokenQuoted })
        current = ''
        tokenStarted = false
        tokenQuoted = false
      }
      continue
    }

    current += ch
    tokenStarted = true
  }

  if (quote) {
    return { tokens, error: 'Unterminated quoted string in /export arguments.' }
  }
  if (tokenStarted) {
    tokens.push({ value: current, quoted: tokenQuoted })
  }
  return { tokens }
}

export function parseExportArgs(args: string): {
  filename?: string
  format?: ExportFormat
  error?: string
} {
  const tokenized = tokenizeExportArgs(args)
  if (tokenized.error) return { error: tokenized.error }

  let format: ExportFormat | undefined
  let error: string | undefined
  const filenameTokens: string[] = []

  for (let i = 0; i < tokenized.tokens.length; i++) {
    const token = tokenized.tokens[i]!
    if (!token.quoted && token.value === '--') {
      filenameTokens.push(...tokenized.tokens.slice(i + 1).map(t => t.value))
      break
    }

    if (!token.quoted && (token.value === '--format' || token.value === '-f')) {
      const value = tokenized.tokens[++i]?.value
      if (!value) {
        error = `Missing value for ${token.value}. ${SUPPORTED_FORMATS}`
        break
      }
      const normalized = normalizeExportFormat(value)
      if (!normalized) {
        error = `Unsupported export format: ${value}. ${SUPPORTED_FORMATS}`
        break
      }
      format = normalized
      continue
    }

    if (!token.quoted && token.value.startsWith('-') && token.value !== '-') {
      error = `Unsupported export option: ${token.value}. Supported options: --format, -f.`
      break
    }

    filenameTokens.push(token.value)
  }

  const filename = filenameTokens.length > 0 ? filenameTokens.join(' ') : undefined
  return error ? { filename, format, error } : { filename, format }
}
