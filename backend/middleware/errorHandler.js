import crypto from 'node:crypto'
import { isProduction } from '../seed/guard.js' // one definition of "production" (NODE_ENV / RENDER / VERCEL) for the whole backend
import { logger, logThrottled, redactText, redactUrl } from '../utils/logger.js'
import { isDbUnavailableError } from '../utils/dbErrors.js'

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ONE error contract for the whole API. Every error response is JSON:
//   { message, code, errors?, retryAfter?, requestId, stack? }
//     message   – safe, user-readable text (this field already existed; clients that only read `message` keep working)
//     code      – stable machine-readable identifier (new, additive) e.g. VALIDATION_ERROR, DUPLICATE_RECORD, DATABASE_UNAVAILABLE
//     errors    – { field: message } for validation / duplicate-key failures (additive)
//     retryAfter– seconds, for 429 / 503 (also sent as the Retry-After header)
//     requestId – quote this to support; the same id is on the server log line (additive)
//     stack     – NON-production only, secrets redacted (production never includes it)
// Controllers keep using the existing conventions: `throw` (asyncHandler forwards it here) or answer directly with
// res.status(4xx).json({ message }); deliberate, user-facing failures may also be thrown as Object.assign(new Error(msg), { status, expose: true }).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const requestId = (req, res, next) => {
  const inbound = String(req.headers['x-request-id'] || '')
  req.id = /^[A-Za-z0-9._-]{8,64}$/.test(inbound) ? inbound : crypto.randomUUID()
  res.set('X-Request-Id', req.id)
  next()
}

const DEFAULTS = {
  400: ['BAD_REQUEST', 'The request could not be processed. Please check your input and try again.'],
  401: ['UNAUTHORIZED', 'Please log in to continue.'],
  403: ['FORBIDDEN', "You don't have permission to do that."],
  404: ['NOT_FOUND', "We couldn't find what you were looking for."],
  405: ['METHOD_NOT_ALLOWED', 'That action is not supported here.'],
  408: ['REQUEST_TIMEOUT', 'The request took too long. Please try again.'],
  409: ['CONFLICT', 'This conflicts with existing data. Please refresh and try again.'],
  413: ['PAYLOAD_TOO_LARGE', 'That request is too large.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'That type of content is not supported.'],
  422: ['VALIDATION_ERROR', 'Some of the information provided is not valid.'],
  429: ['RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.'],
  500: ['INTERNAL_ERROR', 'Something went wrong. Please try again.'],
  502: ['BAD_GATEWAY', 'A service we depend on failed. Please try again.'],
  503: ['SERVICE_UNAVAILABLE', 'The service is temporarily unavailable. Please try again in a moment.'],
  504: ['GATEWAY_TIMEOUT', 'The request took too long. Please try again.'],
}
const fallbackFor = (status) => DEFAULTS[status] || (status >= 500 ? DEFAULTS[500] : DEFAULTS[400])

export const DB_UNAVAILABLE = {
  status: 503,
  code: 'DATABASE_UNAVAILABLE',
  message: 'We are having trouble reaching our database. Please try again in a moment.',
  retryAfter: 5,
}

export function notFound(req, res) {
  // No echo of the requested path (it is user-controlled input).
  res.status(404).json({ message: "We couldn't find what you were looking for.", code: 'ROUTE_NOT_FOUND', requestId: req.id })
}

// ── field labels / friendly validation text ─────────────────────────────────────────────────────────────────────────
const label = (path) => {
  const last = String(path || 'This field').split('.').pop().replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return last ? last[0].toUpperCase() + last.slice(1) : 'This field'
}
// Mongoose's built-in messages quote the path/value ("Path `price` (`abc`) …", "Cast to Number failed for value …").
// Those are technical and echo input, so they are rewritten. Messages written by our own schemas pass through untouched.
const isDriverStyle = (m) => /`[^`]+`|^Cast to |failed for value/.test(String(m))
function friendlyValidation(e) {
  if (!isDriverStyle(e.message)) return String(e.message)
  const L = label(e.path)
  switch (e.kind) {
    case 'required': return `${L} is required.`
    case 'minlength': return `${L} is too short.`
    case 'maxlength': return `${L} is too long.`
    case 'min': return `${L} is too low.`
    case 'max': return `${L} is too high.`
    case 'enum': return `${L} has an invalid value.`
    default: return `${L} is not valid.`
  }
}

// Only these unique-index fields may be named to the user; anything else (billId, tokenHash, compound indexes…) stays internal.
const DUPLICATE_FIELDS = {
  email: ['email', 'An account with this email already exists.'],
  username: ['username', 'That username is already taken.'],
  phone: ['phone', 'An account with this phone number already exists.'],
  phoneE164: ['phone', 'An account with this phone number already exists.'],
  googleId: ['googleId', 'This Google account is already linked to another account.'],
}

// ── classification (pure: no req/res) ───────────────────────────────────────────────────────────────────────────────
export function classifyError(input, { prod = isProduction() } = {}) {
  const err = input instanceof Error ? input : Object.assign(new Error(typeof input === 'string' ? input : input?.message || 'Unknown error'), { name: input?.name || 'Error' })
  const out = (status, message, code, extra = {}) => ({ status, message, code, ...extra })

  // 1. Infrastructure: the database is unreachable → 503 now, not 401/500 and not a 30 s hang.
  if (isDbUnavailableError(err)) return out(DB_UNAVAILABLE.status, DB_UNAVAILABLE.message, DB_UNAVAILABLE.code, { retryAfter: DB_UNAVAILABLE.retryAfter, level: 'warn', dbDown: true })

  // 2. Request-shape problems raised by Express / body-parser / multer (before any controller ran).
  if (err.type === 'entity.parse.failed') return out(400, 'The request body is not valid JSON.', 'INVALID_JSON')
  if (err.type === 'entity.too.large') return out(413, 'That request is too large.', 'PAYLOAD_TOO_LARGE')
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return out(413, 'That file is too large. Images can be up to 5 MB and videos up to 20 MB.', 'FILE_TOO_LARGE')
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return out(400, 'That upload was not expected here.', 'UNEXPECTED_FILE')
    return out(400, 'That upload could not be accepted.', 'UPLOAD_REJECTED')
  }

  // 3. Authentication problems thrown outside the auth middleware.
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError') {
    return out(401, 'Your session has expired. Please log in again.', 'SESSION_EXPIRED')
  }

  // 4. Data problems.
  if (err.name === 'VersionError') return out(409, 'This item was changed by another request. Please try again.', 'CONFLICT')
  if (err.name === 'ValidationError' && err.errors) {
    const errors = {}
    for (const [path, e] of Object.entries(err.errors)) errors[path] = friendlyValidation(e)
    const message = [...new Set(Object.values(errors))].join(' ') || fallbackFor(400)[1] // each entry is a full sentence
    return out(400, message, 'VALIDATION_ERROR', { errors })
  }
  if (err.code === 11000 || err.code === 11001) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0]
    const known = DUPLICATE_FIELDS[field]
    return out(409, known ? known[1] : 'This record already exists.', 'DUPLICATE_RECORD', known ? { errors: { [known[0]]: known[1] } } : {})
  }
  if (err.name === 'CastError') return out(400, 'That identifier is not valid.', 'INVALID_ID') // never echoes the offending value

  // 5. Deliberate, user-facing errors from our own code (existing convention: { status, expose: true }).
  const own = err.status ?? err.statusCode
  if (err.expose === true && Number.isInteger(own) && own >= 400 && own < 600) {
    const code = typeof err.code === 'string' && /^[A-Z0-9_]{3,40}$/.test(err.code) ? err.code : fallbackFor(own)[0]
    return out(own, String(err.message || fallbackFor(own)[1]), code, { ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}), ...(own >= 500 ? { level: 'error' } : {}) })
  }

  // 6. Library errors that carry an HTTP status but were not meant for the user (e.g. "Failed to decode param"): safe text by status.
  if (Number.isInteger(own) && own >= 400 && own < 600) {
    const [code, message] = fallbackFor(own)
    return out(own, message, code, own >= 500 ? { level: 'error' } : {})
  }

  // 7. Anything else is a bug or an unexpected failure.
  const [code, generic] = DEFAULTS[500]
  return out(500, prod ? generic : redactText(err.message) || generic, code, { level: 'error' }) // dev keeps the (redacted) real message for diagnostics
}

// ── the Express error middleware ────────────────────────────────────────────────────────────────────────────────────
export function errorHandler(err, req, res, next) {
  const prod = isProduction()
  const c = classifyError(err, { prod })

  const where = `${req.method} ${redactUrl(req.originalUrl)} → ${c.status}`
  const meta = { requestId: req.id, errorCode: c.code, name: err?.name, userId: req.user?._id ? String(req.user._id) : undefined }
  if (c.dbDown) logThrottled('warn', 'db-unavailable', 10_000, 'db', `${where}: database unavailable (${redactText(err?.message)})`, meta)
  else if (c.level === 'error') logger.error('error', `${where}: ${redactText(err?.message)}`, { ...meta, stack: redactText(err?.stack) }) // full detail stays in the server log

  // A response is already on its way (streamed / timed out / answered twice): never try to write a second one.
  if (res.headersSent) return next(err)

  if (c.retryAfter) res.set('Retry-After', String(c.retryAfter))
  res.status(c.status).json({
    message: c.message,
    code: c.code,
    ...(c.errors ? { errors: c.errors } : {}),
    ...(c.retryAfter ? { retryAfter: c.retryAfter } : {}),
    requestId: req.id,
    stack: prod ? undefined : redactText(err?.stack),
  })
}
