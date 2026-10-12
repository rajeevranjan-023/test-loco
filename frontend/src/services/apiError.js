// The ONE place that turns a failed request into something a person can read.
//
// Every failure leaves services/api.js as an `ApiError`:
//   .message      always safe to show (never an Axios message, URL, stack, HTML page or driver text)
//   .kind         'offline' | 'network' | 'timeout' | 'unauthorized' | 'forbidden' | 'validation' | 'notFound' | 'conflict'
//                 | 'rateLimited' | 'unavailable' | 'server' | 'client' | 'canceled'
//   .status       HTTP status (0 when there was no response)             ┐ unchanged from before: existing callers
//   .data         the backend's JSON body, only when it IS a JSON object ┘ read .data.errors / .data.code / .retryAfter …
//   .fieldErrors  { field: message } – only plain, safe strings from the backend's `errors`
//   .retryable    true only when repeating the request cannot do harm (GET/HEAD) and the failure is transient
//   .retryAfter   seconds, from Retry-After / body (rate limits, outages)
//   .requestId    support reference printed by the backend
// Because `.message` is already safe, the ~100 places that render `err.message` keep working and become safe at once.

export const MESSAGES = {
  offline: "You appear to be offline. Check your internet connection and try again.",
  network: "We can't reach the server right now. Please check your connection and try again in a moment.",
  timeout: 'The request took too long. Please try again.',
  sessionExpired: 'Your session has expired. Please log in again.',
  unauthorized: 'Please check your details and try again.',
  forbidden: "You don't have permission to do that.",
  notFound: "We couldn't find what you were looking for.",
  validation: 'Some of the information you entered is not valid. Please check it and try again.',
  duplicate: 'That already exists. Please use a different value or log in.',
  conflict: 'This was changed by someone else. Please refresh and try again.',
  rateLimited: 'Too many requests. Please wait a moment and try again.',
  database: 'We are having trouble reaching our database. Please try again in a moment.',
  unavailable: 'The service is temporarily unavailable. Please try again in a moment.',
  server: 'Something went wrong on our side. Please try again.',
  tooLarge: 'That is too large to send. Please use a smaller file.',
  client: 'That request could not be completed. Please check your input and try again.',
  canceled: 'Request cancelled.',
  unexpected: 'Something unexpected happened. Please try again.',
}

// Text that must never be shown even if a backend (or a proxy) sends it.
const TECHNICAL = /(^|\s)([A-Za-z]:\\|\/(home|usr|var|app|opt|srv|node_modules|src)\/)|\n\s+at\s|<\/?[a-z][^>]*>|mongodb|mongoose|E11000|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|MongoServerError|Cast to |Request failed with status|Network Error|\b(Type|Reference|Syntax|Range)Error\b|localhost:\d+|:\/\/|\[object |\bundefined\b|\bnull\b|stack/i
export const isSafeMessage = (m) => typeof m === 'string' && m.trim().length > 0 && m.length <= 300 && !TECHNICAL.test(m)

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export class ApiError extends Error {
  constructor(message, props = {}) {
    super(message)
    this.name = 'ApiError'
    this.kind = 'client'; this.status = 0; this.data = null; this.fieldErrors = {}; this.retryable = false; this.retryAfter = 0; this.requestId = ''
    Object.assign(this, props)
  }
}

function safeFieldErrors(data) {
  const out = {}
  if (!isPlainObject(data?.errors)) return out
  for (const [k, v] of Object.entries(data.errors)) if (typeof k === 'string' && k.length <= 60 && isSafeMessage(v)) out[k] = v
  return out
}

function retryAfterOf(res) {
  const h = res?.headers
  const raw = (typeof h?.get === 'function' ? h.get('retry-after') : h?.['retry-after']) ?? res?.data?.retryAfter
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 && n < 86400 ? n : 0
}

const TRANSIENT = new Set(['offline', 'network', 'timeout', 'unavailable', 'server', 'rateLimited'])
const idempotent = (method) => ['get', 'head'].includes(String(method || 'get').toLowerCase())

// `err` is whatever axios rejected with. Returns an ApiError (never throws).
export function normalizeApiError(err, { fallback } = {}) {
  if (err instanceof ApiError) return err
  const config = err?.config || {}
  const res = err?.response
  const make = (kind, message, extra = {}) => new ApiError(message, { kind, retryable: TRANSIENT.has(kind) && idempotent(config.method), ...extra })

  // ── no answer from the server ──
  if (!res) {
    const text = String(err?.message || '')
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return make('offline', MESSAGES.offline)
    if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || /timeout/i.test(text)) return make('timeout', MESSAGES.timeout)
    if (err?.code || err?.request || /network/i.test(text)) return make('network', MESSAGES.network) // refused / DNS / CORS / dropped
    return make('client', fallback || MESSAGES.unexpected) // a plain JS error from our own code: never show its text
  }

  // ── the server answered ──
  const status = res.status
  const data = isPlainObject(res.data) ? res.data : null // an HTML error page from a proxy is never kept
  const backend = data && isSafeMessage(data.message) ? data.message : ''
  const base = { status, data, fieldErrors: safeFieldErrors(data), retryAfter: retryAfterOf(res), requestId: typeof data?.requestId === 'string' ? data.requestId.slice(0, 64) : '' }
  const authed = !!(config.requiresAuth || config.headers?.Authorization || config.headers?.get?.('Authorization'))

  if (status === 401) return make('unauthorized', authed ? MESSAGES.sessionExpired : backend || MESSAGES.unauthorized, base)
  if (status === 403) return make('forbidden', backend || MESSAGES.forbidden, base)
  if (status === 404) return make('notFound', backend || MESSAGES.notFound, base)
  if (status === 409) return make('conflict', backend || (data?.code === 'DUPLICATE_RECORD' ? MESSAGES.duplicate : MESSAGES.conflict), base)
  if (status === 413) return make('client', backend || MESSAGES.tooLarge, base)
  if (status === 429) {
    const wait = base.retryAfter
    return make('rateLimited', backend || (wait ? `Too many requests. Please wait ${wait} second${wait === 1 ? '' : 's'} and try again.` : MESSAGES.rateLimited), base)
  }
  if (status === 400 || status === 422) {
    const hasFields = Object.keys(base.fieldErrors).length > 0
    return make('validation', backend || (hasFields ? MESSAGES.validation : MESSAGES.client), base)
  }
  if (status >= 400 && status < 500) return make('client', backend || MESSAGES.client, base)

  // 5xx: standard wording by status/code. Only a 502/503 message that passes the safe-text filter is trusted (e.g. "uploads are
  // not configured yet — you can add a photo later"); a 500's text is never shown.
  if (data?.code === 'DATABASE_UNAVAILABLE') return make('unavailable', MESSAGES.database, base)
  if (status === 504 || data?.code === 'REQUEST_TIMEOUT') return make('timeout', data?.code === 'REQUEST_TIMEOUT' && backend ? backend : MESSAGES.timeout, base) // retryable only for GET (make() decides): a timed-out write may still have been saved
  if (status === 502 || status === 503) return make('unavailable', backend || MESSAGES.unavailable, base)
  return make('server', MESSAGES.server, base)
}

// For code that catches something that may not come from the API at all (image processing, JSON.parse, …).
export function userMessage(err, fallback = MESSAGES.unexpected) {
  if (err?.canceled) return ''
  return err instanceof ApiError || (typeof err?.kind === 'string' && isSafeMessage(err.message)) ? err.message : fallback
}
