import { disableKeepAlive, getProxyFetchOptions } from '../../utils/proxy.js'

const RETRYABLE_FETCH_ERROR_PATTERN =
  /socket connection was closed unexpectedly|ECONNRESET|EPIPE|socket hang up|Connection reset by peer|fetch failed/i

type HeadersLike = {
  entries: () => IterableIterator<[string, string]>
  get: (name: string) => string | null
  [Symbol.iterator]: () => IterableIterator<[string, string]>
}

function isHeadersLike(value: object): value is HeadersLike {
  if (typeof Headers !== 'undefined' && value instanceof Headers) {
    return true
  }
  const candidate = value as Partial<HeadersLike>
  return (
    typeof candidate.entries === 'function' &&
    typeof candidate.get === 'function' &&
    typeof candidate[Symbol.iterator] === 'function'
  )
}

function normalizeHeadersInitForFetch(
  headers: HeadersInit | undefined,
): HeadersInit | undefined {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers) || isHeadersLike(headers)) {
    return headers
  }
  if (Object.getOwnPropertySymbols(headers).length === 0) {
    return headers
  }

  const normalized = Object.create(null) as Record<string, string>
  const headerRecord = headers as Record<string, unknown>
  for (const key of Object.getOwnPropertyNames(headerRecord)) {
    normalized[key] = String(headerRecord[key])
  }
  return normalized
}

function normalizeRequestInitForFetch(init: RequestInit | undefined): RequestInit | undefined {
  if (!init?.headers) {
    return init
  }
  const headers = normalizeHeadersInitForFetch(init.headers)
  return headers === init.headers ? init : { ...init, headers }
}

export function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  if (error.name === 'AbortError') {
    return false
  }
  return RETRYABLE_FETCH_ERROR_PATTERN.test(error.message)
}

export async function fetchWithProxyRetry(
  input: string | URL | Request,
  init?: RequestInit,
  options?: { forAnthropicAPI?: boolean; maxAttempts?: number },
): Promise<Response> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 2)
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const normalizedInit = normalizeRequestInitForFetch(init)
      return await fetch(input, {
        ...normalizedInit,
        ...getProxyFetchOptions({
          forAnthropicAPI: options?.forAnthropicAPI,
        }),
      })
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts || !isRetryableFetchError(error)) {
        throw error
      }
      disableKeepAlive()
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Fetch failed without an error object')
}
