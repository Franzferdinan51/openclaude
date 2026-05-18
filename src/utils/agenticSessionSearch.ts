import type { LogOption, SerializedMessage } from '../types/logs.js'
import { count } from './array.js'
import { logForDebugging } from './debug.js'
import { getLogDisplayTitle, logError } from './log.js'
import { isLiteLog, loadFullLog } from './sessionStorage.js'

// Limits for transcript extraction
const MAX_TRANSCRIPT_CHARS = 2000 // Max chars of transcript per session
const MAX_MESSAGES_TO_SCAN = 100 // Max messages to scan from start/end
const MAX_SESSIONS_TO_SEARCH = 100 // Max sessions to send to the API

/**
 * Extracts searchable text content from a message.
 */
function extractMessageText(message: SerializedMessage): string {
  if (message.type !== 'user' && message.type !== 'assistant') {
    return ''
  }

  const content = 'message' in message ? message.message?.content : undefined
  if (!content) return ''

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (typeof block === 'string') return block
        if ('text' in block && typeof block.text === 'string') return block.text
        return ''
      })
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

/**
 * Extracts a truncated transcript from session messages.
 */
function extractTranscript(messages: SerializedMessage[]): string {
  if (messages.length === 0) return ''

  // Take messages from start and end to get context
  const messagesToScan =
    messages.length <= MAX_MESSAGES_TO_SCAN
      ? messages
      : [
          ...messages.slice(0, MAX_MESSAGES_TO_SCAN / 2),
          ...messages.slice(-MAX_MESSAGES_TO_SCAN / 2),
        ]

  const text = messagesToScan
    .map(extractMessageText)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > MAX_TRANSCRIPT_CHARS
    ? text.slice(0, MAX_TRANSCRIPT_CHARS) + '…'
    : text
}

/**
 * Splits user search text into literal terms without treating FTS-style
 * operators as required words. Quoted phrases remain searchable as a unit.
 */
function tokenizeQuery(query: string): string[] {
  const terms: string[] = []
  const pattern = /"([^"]+)"|(\S+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(query)) !== null) {
    const raw = (match[1] ?? match[2] ?? '')
      .replace(/^[()+-]+|[()+-]+$/g, '')
      .replace(/\*+$/g, '')
      .trim()
      .toLowerCase()
    if (!raw || raw === 'and' || raw === 'or' || raw === 'not') continue
    terms.push(raw)
  }

  return [...new Set(terms)]
}

function scoreText(text: string | undefined, terms: string[], weight: number): number {
  if (!text) return 0
  const lower = text.toLowerCase()
  let score = 0
  for (const term of terms) {
    if (lower.includes(term)) score += weight
  }
  return score
}

function scoreLog(log: LogOption, terms: string[], fullQuery: string): number {
  const title = getLogDisplayTitle(log)
  const transcript =
    log.messages && log.messages.length > 0 ? extractTranscript(log.messages) : ''
  const combined = [
    title,
    log.customTitle,
    log.tag,
    log.gitBranch,
    log.summary,
    log.firstPrompt,
    transcript,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = 0
  score += scoreText(log.tag, terms, 90)
  score += scoreText(log.customTitle, terms, 70)
  const titleDuplicatesKnownField =
    title === log.customTitle || title === log.summary || title === log.firstPrompt
  if (!titleDuplicatesKnownField) {
    score += scoreText(title, terms, 60)
  }
  score += scoreText(log.gitBranch, terms, 35)
  score += scoreText(log.summary, terms, 30)
  score += scoreText(log.firstPrompt, terms, 30)
  score += scoreText(transcript, terms, 12)

  if (fullQuery && combined.includes(fullQuery)) score += 50
  if (terms.length > 1 && terms.every(term => combined.includes(term))) {
    score += 25
  }

  return score
}

/**
 * Performs deterministic local session search over metadata and transcript
 * excerpts. This intentionally avoids an auxiliary model call: resume search
 * should stay fast, provider-free, and grounded in actual transcript text.
 */
export async function agenticSessionSearch(
  query: string,
  logs: LogOption[],
  signal?: AbortSignal,
): Promise<LogOption[]> {
  if (!query.trim() || logs.length === 0) {
    return []
  }

  const terms = tokenizeQuery(query)
  if (terms.length === 0) return []

  const logsToSearch = logs.slice(0, MAX_SESSIONS_TO_SEARCH)

  logForDebugging(
    `Agentic search: ${logsToSearch.length}/${logs.length} logs, query="${query}", ` +
      `terms=${terms.join('|')}, with messages: ${count(logsToSearch, l => l.messages?.length > 0)}`,
  )

  const logsWithTranscriptsPromises = logsToSearch.map(async log => {
    if (signal?.aborted) return log
    if (isLiteLog(log)) {
      try {
        return await loadFullLog(log)
      } catch (error) {
        logError(error as Error)
        // If loading fails, use the lite log (no transcript)
        return log
      }
    }
    return log
  })
  const logsWithTranscripts = await Promise.all(logsWithTranscriptsPromises)

  logForDebugging(
    `Agentic search: loaded ${count(logsWithTranscripts, l => l.messages?.length > 0)}/${logsToSearch.length} logs with transcripts`,
  )

  const fullQuery = query.trim().toLowerCase()
  const scored = logsWithTranscripts
    .map((log, index) => ({
      log,
      index,
      score: scoreLog(log, terms, fullQuery),
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const modified = b.log.modified.getTime() - a.log.modified.getTime()
      if (modified !== 0) return modified
      return a.index - b.index
    })

  logForDebugging(
    `Agentic search found ${scored.length} relevant sessions without auxiliary model calls`,
  )

  return scored.map(result => result.log)
}
