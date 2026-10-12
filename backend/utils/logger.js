// Server-side diagnostics with secret redaction. This is NOT a second logging system: it is a thin wrapper around console
// (which is what the app already used everywhere) that guarantees nothing sensitive reaches the log.
//
//   redactText(s)   – scrubs connection strings, bearer tokens, JWTs, "password=…" style pairs, API keys
//   redactUrl(u)    – keeps the path, masks sensitive query values (OAuth `code`/`state`, reset `token`, …)
//   redactObject(o) – deep copy where sensitive keys (password, token, authorization, cookie, …) are masked
//   logger.error/warn/info(tag, message, meta) – one line, always redacted
//
// In NODE_ENV=test the logger is silent unless LOG_IN_TEST=true (the previous error handler behaved the same way).
import { redactUri } from '../seed/guard.js' // the existing connection-string redactor — reused, not re-implemented

export const REDACTED = '[REDACTED]'

const SENSITIVE_KEY = /(pass(word|wd)?|pwd|secret|token|authorization|cookie|api[-_]?key|credential|jwt|signature|private[-_]?key|connection[-_]?string|mongo.*uri|db[-_]?uri|(^|[-_.])uri$|^otp$)/i
const isSensitiveKey = (k) => SENSITIVE_KEY.test(String(k))

const TEXT_RULES = [
  [/mongodb(?:\+srv)?:\/\/[^\s'"`)<>]+/gi, 'mongodb://[REDACTED]'],        // whole connection string (credentials + hosts)
  [/cloudinary:\/\/[^\s'"`)<>]+/gi, 'cloudinary://[REDACTED]'],
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:'"`]+:[^\s/@'"`]+@/gi, '$1***@'],     // user:pass@ in any other URL
  [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[REDACTED_JWT]'],
  [/(["']?(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|client_secret)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&}\]]+)/gi, `$1${REDACTED}`],
  [/\bapi_key\s+\S+/gi, 'api_key [REDACTED]'],                              // Cloudinary: "Invalid api_key 1234567890"
]

export function redactText(value) {
  let s = typeof value === 'string' ? value : value == null ? '' : String(value)
  s = redactUri(s)
  for (const [re, to] of TEXT_RULES) s = s.replace(re, to)
  return s
}

const SENSITIVE_QUERY = /([?&](?:token|code|state|ticket|password|secret|key|api_key|access_token|id_token|refresh_token|nonce|signature)=)[^&#]*/gi
export const redactUrl = (url) => redactText(String(url || '').replace(SENSITIVE_QUERY, `$1${REDACTED}`))

export function redactObject(value, depth = 4, seen = new WeakSet()) {
  if (value == null) return value
  if (typeof value === 'string') return redactText(value)
  if (typeof value !== 'object') return value
  if (value instanceof Error) return { name: value.name, message: redactText(value.message), code: value.code, stack: redactText(value.stack) }
  if (seen.has(value)) return '[Circular]'
  if (depth <= 0) return '[Truncated]'
  seen.add(value)
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactObject(v, depth - 1, seen))
  const out = {}
  for (const [k, v] of Object.entries(value)) out[k] = isSensitiveKey(k) ? REDACTED : redactObject(v, depth - 1, seen)
  return out
}

const silent = () => process.env.NODE_ENV === 'test' && process.env.LOG_IN_TEST !== 'true'
function emit(level, tag, message, meta) {
  if (silent()) return
  const line = `[${tag}] ${redactText(message)}`
  if (meta === undefined) console[level](line)
  else console[level](line, redactObject(meta))
}

export const logger = {
  error: (tag, message, meta) => emit('error', tag, message, meta),
  warn: (tag, message, meta) => emit('warn', tag, message, meta),
  info: (tag, message, meta) => emit('log', tag, message, meta),
}

// Same message at most once per `everyMs` — keeps an outage (every request failing the same way) from flooding the log.
const lastSeen = new Map()
export function logThrottled(level, key, everyMs, tag, message, meta) {
  const now = Date.now()
  if (now - (lastSeen.get(key) || 0) < everyMs) return false
  lastSeen.set(key, now)
  logger[level](tag, message, meta)
  return true
}
