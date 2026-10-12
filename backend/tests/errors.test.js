// Centralized error handling — real Express app + the REAL errorHandler / requestId / notFound / protect / requireOwner / rateLimit /
// multer / Mongoose / MongoDB-driver error classes. No database is needed (nothing here reads or writes data).
//   node tests/errors.test.js
import assert from 'node:assert/strict'

// Safety first: this file never connects to anything. Point the URI at a closed local port before anything can read .env.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'
process.env.LOG_IN_TEST = 'true' // the logger is silent under NODE_ENV=test unless asked; these tests inspect what it prints
process.env.RATE_LIMIT_IN_TEST = 'true'
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never_connected'
delete process.env.RENDER; delete process.env.VERCEL

const { default: express } = await import('express')
const { default: mongoose } = await import('mongoose')
const { MongoServerError, MongoNetworkError } = await import('mongodb')
const { default: jwt } = await import('jsonwebtoken')
const { requestId, notFound, errorHandler, classifyError } = await import('../middleware/errorHandler.js')
const { asyncHandler } = await import('../utils/asyncHandler.js')
const { protect, requireOwner } = await import('../middleware/auth.js')
const { rateLimit } = await import('../middleware/rateLimit.js')
const { upload } = await import('../middleware/upload.js')
const { default: User } = await import('../models/common/User.js')
const { default: RevokedToken } = await import('../models/RevokedToken.js')
const { applyLedger } = await import('../utils/common/ledger.js')
const { logger, redactText, redactUrl, redactObject } = await import('../utils/logger.js')
const { installProcessHandlers } = await import('../utils/processHandlers.js')

// ── tiny harness ───────────────────────────────────────────────────────────────────────────────────────────────────
let failures = 0, passed = 0
const t = async (name, fn) => { try { await fn(); passed++; console.log('✅', name) } catch (e) { failures++; console.log('❌', name, '\n    ', String(e.message).split('\n')[0]) } }

const withEnv = async (vars, fn) => {
  const old = {}; for (const k of Object.keys(vars)) { old[k] = process.env[k]; vars[k] === undefined ? delete process.env[k] : (process.env[k] = vars[k]) }
  try { return await fn() } finally { for (const [k, v] of Object.entries(old)) v === undefined ? delete process.env[k] : (process.env[k] = v) }
}
const PROD = { NODE_ENV: 'production', LOG_IN_TEST: undefined }

// capture everything written through console.* while fn runs
async function captured(fn) {
  const lines = [], orig = { log: console.log, warn: console.warn, error: console.error }
  for (const k of Object.keys(orig)) console[k] = (...a) => lines.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
  try { await fn() } finally { Object.assign(console, orig) }
  return lines.join('\n')
}

const mini = (setup) => { const a = express(); a.use(requestId); a.use(express.json()); setup(a); a.use(notFound); a.use(errorHandler); return a }
async function serve(app, fn) {
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)) })
  const base = `http://127.0.0.1:${server.address().port}`
  try { return await fn(async (method, path, { body, token, headers = {}, raw } = {}) => {
    const res = await fetch(base + path, { method, headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) })
    let data = null; try { data = await res.json() } catch { /* not JSON */ }
    return { status: res.status, data, headers: res.headers }
  }) } finally { await new Promise((r) => server.close(r)) }
}
const SECRETS = ['SuperSecret123', 'mongodb://admin', 'eyJhbGciOiJIUzI1NiJ9', 'Bearer abc', 'stack', 'node_modules', '/home/claude']

// ── 1. unexpected backend exception ────────────────────────────────────────────────────────────────────────────────
await t('unexpected exception (production): 500, generic message, code, requestId — no stack, no secret, no driver text', async () => {
  const app = mini((a) => a.get('/boom', asyncHandler(async () => { throw new Error('connect failed mongodb://admin:SuperSecret123@cluster0.abcde.mongodb.net/loco at /home/claude/loco/repo/backend/x.js') })))
  await withEnv(PROD, () => serve(app, async (req) => {
    const out = await captured(async () => {
      const r = await req('GET', '/boom')
      assert.equal(r.status, 500); assert.equal(r.data.code, 'INTERNAL_ERROR'); assert.equal(r.data.message, 'Something went wrong. Please try again.')
      assert.ok(r.data.requestId && r.headers.get('x-request-id') === r.data.requestId, 'request id in body and header')
      assert.equal(r.data.stack, undefined)
      const body = JSON.stringify(r.data); for (const s of ['SuperSecret123', 'mongodb', 'cluster0', '/home/claude', 'x.js']) assert.ok(!body.includes(s), `response leaked ${s}`)
    })
    assert.match(out, /\[error\] GET \/boom → 500/, 'the failure IS logged on the server')
    assert.ok(!out.includes('SuperSecret123') && !out.includes('mongodb://admin'), 'server log is redacted too')
  }))
})
await t('unexpected exception (development): keeps a useful message + redacted stack for the developer', async () => {
  const app = mini((a) => a.get('/boom', asyncHandler(async () => { throw new Error('bad thing with password=SuperSecret123') })))
  await withEnv({ NODE_ENV: 'development', LOG_IN_TEST: undefined }, () => serve(app, async (req) => {
    await captured(async () => {
      const r = await req('GET', '/boom')
      assert.equal(r.status, 500); assert.match(r.data.message, /bad thing/); assert.ok(typeof r.data.stack === 'string')
      assert.ok(!JSON.stringify(r.data).includes('SuperSecret123'), 'secret redacted even in development')
    })
  }))
})
await t('a thrown value that is not an Error (string / null) still yields a clean JSON 500', async () => {
  const app = mini((a) => { a.get('/s', (req, res, next) => next('plain string failure')); a.get('/n', (req, res, next) => next(null)) })
  await withEnv(PROD, () => serve(app, async (req) => { await captured(async () => { const r = await req('GET', '/s'); assert.equal(r.status, 500); assert.equal(r.data.code, 'INTERNAL_ERROR') }) }))
})
await t('async route failures reach the central handler (asyncHandler) and a previously set 2xx status never leaks into an error', async () => {
  const app = mini((a) => a.get('/x', asyncHandler(async (req, res) => { res.status(201); await Promise.resolve(); throw new Error('late failure') })))
  await withEnv(PROD, () => serve(app, async (req) => { await captured(async () => { const r = await req('GET', '/x'); assert.equal(r.status, 500, 'status comes from the error, not from res.statusCode'); assert.equal(r.data.code, 'INTERNAL_ERROR') }) }))
})
await t('no duplicate response: if headers were already sent the handler delegates instead of writing twice', async () => {
  let delegated = false
  const res = { headersSent: true, set() {}, status() { throw new Error('must not write a second response') }, json() { throw new Error('must not write a second response') } }
  await withEnv(PROD, () => captured(async () => errorHandler(new Error('x'), { method: 'GET', originalUrl: '/x', id: 'r1' }, res, () => { delegated = true })))
  assert.ok(delegated)
})

// ── 2. validation error ────────────────────────────────────────────────────────────────────────────────────────────
await t('Mongoose validation error: 400 VALIDATION_ERROR, per-field `errors`, no schema paths / echoed values', async () => {
  const Thing = mongoose.models.ErrTestThing || mongoose.model('ErrTestThing', new mongoose.Schema({
    name: { type: String, required: true },
    qty: { type: Number, min: 1 },
    kind: { type: String, enum: ['a', 'b'] },
    note: { type: String, maxlength: 5, validate: { validator: () => false, message: 'Note is not allowed.' } },
  }))
  const app = mini((a) => a.post('/things', asyncHandler(async (req, res) => { await new Thing(req.body).validate(); res.json({ ok: true }) })))
  await withEnv(PROD, () => serve(app, async (req) => {
    const r = await req('POST', '/things', { body: { qty: 0, kind: 'zzz', note: 'hello world' } })
    assert.equal(r.status, 400); assert.equal(r.data.code, 'VALIDATION_ERROR')
    assert.equal(r.data.errors.name, 'Name is required.'); assert.equal(r.data.errors.qty, 'Qty is too low.'); assert.equal(r.data.errors.kind, 'Kind has an invalid value.')
    assert.equal(r.data.message, 'Name is required. Qty is too low. Kind has an invalid value. Note is too long.', 'message keeps the existing single-string contract')
    const body = JSON.stringify(r.data); assert.ok(!/`|Path|Cast to|zzz|hello world/.test(body), 'no driver wording / echoed input (production: no stack either)')
    const cast = await req('POST', '/things', { body: { name: 'x', qty: 'abc' } })
    assert.equal(cast.status, 400); assert.equal(cast.data.errors.qty, 'Qty is not valid.'); assert.ok(!JSON.stringify(cast.data).includes('abc'))
  }))
})

// ── 3. duplicate record ────────────────────────────────────────────────────────────────────────────────────────────
await t('duplicate key: 409 DUPLICATE_RECORD, names only safe fields, never echoes values or internal index names', async () => {
  const dup = (keyPattern, keyValue) => new MongoServerError({ code: 11000, message: `E11000 duplicate key error collection: loco.users index: x dup key: ${JSON.stringify(keyValue)} mongodb://u:SuperSecret123@h`, keyPattern, keyValue })
  const app = mini((a) => {
    a.get('/email', (req, res, next) => next(dup({ email: 1 }, { email: 'a@b.co' })))
    a.get('/internal', (req, res, next) => next(dup({ billId: 1 }, { billId: 'BILL-9' })))
  })
  await withEnv(PROD, () => serve(app, async (req) => { await captured(async () => {
    const e = await req('GET', '/email')
    assert.equal(e.status, 409); assert.equal(e.data.code, 'DUPLICATE_RECORD'); assert.equal(e.data.message, 'An account with this email already exists.'); assert.deepEqual(e.data.errors, { email: 'An account with this email already exists.' })
    assert.ok(!JSON.stringify(e.data).includes('a@b.co'))
    const i = await req('GET', '/internal')
    assert.equal(i.status, 409); assert.equal(i.data.message, 'This record already exists.'); assert.ok(!JSON.stringify(i.data).match(/billId|BILL-9|SuperSecret/))
  }) }))
})
await t('invalid ObjectId (CastError): 400 INVALID_ID without echoing the value', async () => {
  const c = classifyError(new mongoose.Error.CastError('ObjectId', 'not-an-id<script>', '_id'), { prod: true })
  assert.equal(c.status, 400); assert.equal(c.code, 'INVALID_ID'); assert.ok(!c.message.includes('script'))
})

// ── 4. unauthorized / forbidden / not found / bad input ────────────────────────────────────────────────────────────
const users = { u1: { _id: 'u1', username: '@alice', role: 'consumer' } }
const revoked = new Set()
User.findById = async (id) => users[id] || null
RevokedToken.exists = async ({ hash }) => (revoked.has(hash) ? { _id: 1 } : null)
const good = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: '1h' })
const authApp = mini((a) => {
  a.get('/private', protect, (req, res) => res.json({ me: req.user.username }))
  a.get('/owner/:username', protect, requireOwner(), (req, res) => res.json({ ok: true }))
})
await t('unauthorized: no token / forged token / expired token → 401 with the existing message', async () => serve(authApp, async (req) => {
  const none = await req('GET', '/private'); assert.equal(none.status, 401); assert.match(none.data.message, /log in/i)
  const forged = await req('GET', '/private', { token: jwt.sign({ id: 'u1' }, 'wrong-secret') }); assert.equal(forged.status, 401); assert.equal(forged.data.code, 'SESSION_EXPIRED')
  const expired = await req('GET', '/private', { token: jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: -10 }) }); assert.equal(expired.status, 401)
  const ok = await req('GET', '/private', { token: good }); assert.equal(ok.status, 200); assert.equal(ok.data.me, '@alice')
}))
await t('forbidden: a logged-in user opening someone else\'s owner route → 403 (authorization checks untouched)', async () => serve(authApp, async (req) => {
  const r = await req('GET', '/owner/@bob', { token: good }); assert.equal(r.status, 403); assert.match(r.data.message, /owner/i)
  assert.equal((await req('GET', '/owner/@alice', { token: good })).status, 200)
}))
await t('a database failure while checking the token is 503 — NOT a 401 "session expired" (it used to log users out)', async () => serve(authApp, async (req) => {
  const orig = User.findById
  User.findById = async () => { throw new MongoNetworkError('connect ECONNREFUSED 10.0.0.5:27017') }
  try {
    let r; const log = await captured(async () => { r = await withEnv(PROD, () => req('GET', '/private', { token: good })) })
    assert.ok(log.includes('database unavailable'), 'the outage is logged (warn)')
    assert.equal(r.status, 503); assert.equal(r.data.code, 'DATABASE_UNAVAILABLE'); assert.ok(r.headers.get('retry-after'))
    assert.ok(!JSON.stringify(r.data).match(/ECONNREFUSED|10\.0\.0\.5|27017/), 'no host / port / driver text')
  } finally { User.findById = orig }
  assert.equal((await req('GET', '/private', { token: good })).status, 200, 'and it recovers: the same token works again')
}))
await t('a malformed id inside an otherwise valid token is still a 401 (not a 400/500)', async () => serve(authApp, async (req) => {
  const orig = User.findById; User.findById = async () => { throw new mongoose.Error.CastError('ObjectId', 'zzz', '_id') }
  try { assert.equal((await req('GET', '/private', { token: good })).status, 401) } finally { User.findById = orig }
}))
await t('not found: unknown API route → 404 JSON without echoing the requested path', async () => serve(mini(() => {}), async (req) => {
  const r = await req('GET', '/api/nope?x=<script>alert(1)</script>'); assert.equal(r.status, 404); assert.equal(r.data.code, 'ROUTE_NOT_FOUND'); assert.ok(!JSON.stringify(r.data).includes('script') && !JSON.stringify(r.data).includes('/api/nope'))
}))
await t('malformed JSON body → 400 INVALID_JSON (no parser internals)', async () => withEnv(PROD, () => serve(mini((a) => a.post('/j', (req, res) => res.json({ ok: 1 }))), async (req) => {
  const r = await req('POST', '/j', { raw: '{"a":', headers: { 'Content-Type': 'application/json' } })
  assert.equal(r.status, 400); assert.equal(r.data.code, 'INVALID_JSON'); assert.ok(!/Unexpected|position|JSON\.parse/.test(JSON.stringify(r.data)))
})))
await t('oversized JSON body → 413 PAYLOAD_TOO_LARGE', async () => serve(mini((a) => a.post('/j', (req, res) => res.json({ ok: 1 }))), async (req) => {
  const r = await req('POST', '/j', { body: { blob: 'x'.repeat(200_000) } }); assert.equal(r.status, 413); assert.equal(r.data.code, 'PAYLOAD_TOO_LARGE')
}))
await t('upload rejections: wrong file type → 400 UNSUPPORTED_FILE_TYPE; too large → 413 FILE_TOO_LARGE (multer errors never leak)', async () => {
  const app = mini((a) => a.post('/up', (req, res, next) => upload.single('file')(req, res, (e) => (e ? next(e) : next())), (req, res) => res.json({ ok: true })))
  await serve(app, async (req) => {
    const bad = new FormData(); bad.append('file', new Blob(['hello'], { type: 'text/plain' }), 'x.txt')
    const r1 = await req('POST', '/up', { raw: bad }); assert.equal(r1.status, 400); assert.equal(r1.data.code, 'UNSUPPORTED_FILE_TYPE'); assert.equal(r1.data.message, 'Only image or video files are allowed.')
    const big = new FormData(); big.append('file', new Blob([new Uint8Array(21 * 1024 * 1024)], { type: 'video/mp4' }), 'v.mp4')
    const r2 = await req('POST', '/up', { raw: big }); assert.equal(r2.status, 413); assert.equal(r2.data.code, 'FILE_TOO_LARGE')
  })
})
await t('deliberate domain errors keep their message + status (ledger "Amount must be greater than 0" was a generic 500 before)', async () => {
  const app = mini((a) => a.post('/ledger', asyncHandler(async (req, res) => { await applyLedger({ shopId: 's', customer: { _id: 'c' }, type: 'udhar', amount: 0 }); res.json({ ok: 1 }) })))
  await withEnv(PROD, () => serve(app, async (req) => { const r = await req('POST', '/ledger', { body: {} }); assert.equal(r.status, 400); assert.equal(r.data.message, 'Amount must be greater than 0.') }))
})

// ── 5. rate limit ──────────────────────────────────────────────────────────────────────────────────────────────────
await t('rate limit: 429 RATE_LIMITED with Retry-After header and retryAfter in the body', async () => {
  const app = mini((a) => a.get('/limited', rateLimit({ windowMs: 60_000, max: 2, name: 'errtest' }), (req, res) => res.json({ ok: 1 })))
  await serve(app, async (req) => {
    assert.equal((await req('GET', '/limited')).status, 200); assert.equal((await req('GET', '/limited')).status, 200)
    const r = await req('GET', '/limited')
    assert.equal(r.status, 429); assert.equal(r.data.code, 'RATE_LIMITED'); assert.ok(r.data.retryAfter > 0 && r.data.retryAfter <= 60); assert.equal(r.headers.get('retry-after'), String(r.data.retryAfter))
    assert.match(r.data.message, /Too many requests/)
  })
})

// ── 6. a request that never finishes ───────────────────────────────────────────────────────────────────────────────
await t('a hanging handler is answered with 504 REQUEST_TIMEOUT instead of hanging forever', async () => {
  const { requestTimeout } = await import('../middleware/requestTimeout.js')
  let release; const gate = new Promise((r) => { release = r })
  const app = mini((a) => { a.use(requestTimeout({ ms: 150 })); a.get('/hang', asyncHandler(async (req, res) => { await gate; res.json({ late: true }) })) })
  await withEnv(PROD, () => serve(app, async (req) => {
    const out = await captured(async () => {
      const t0 = Date.now(); const r = await req('GET', '/hang')
      assert.equal(r.status, 504); assert.equal(r.data.code, 'REQUEST_TIMEOUT'); assert.ok(Date.now() - t0 < 2000)
      release(); await new Promise((r2) => setTimeout(r2, 100)) // the late write must not crash the process
    })
    assert.match(out, /exceeded 150 ms/)
  }))
})

// ── 7. logging & redaction ─────────────────────────────────────────────────────────────────────────────────────────
await t('log redaction: passwords, tokens, auth headers, cookies, JWTs and database URIs never reach the log', async () => {
  const jwtLike = jwt.sign({ id: 'u1' }, 'whatever')
  const out = await captured(async () => {
    logger.error('t', `login failed password=SuperSecret123 header Authorization: Bearer ${jwtLike} uri mongodb+srv://admin:SuperSecret123@cluster0.x.mongodb.net/loco?retryWrites=true`, {
      password: 'SuperSecret123', token: jwtLike, authorization: `Bearer ${jwtLike}`, cookie: 'sid=SuperSecret123', MONGODB_URI: 'mongodb://admin:SuperSecret123@h/db',
      nested: { apiKey: 'k-SuperSecret123', note: 'api_key 9876543210 rejected' }, body: { password: 'SuperSecret123', city: 'Sagar' },
    })
  })
  assert.ok(!out.includes('SuperSecret123'), 'password / uri password leaked')
  assert.ok(!out.includes(jwtLike) && !out.includes('eyJ'), 'JWT leaked')
  assert.ok(!out.includes('9876543210') && !out.includes('cluster0'), 'api key / host leaked')
  assert.ok(out.includes('Sagar'), 'harmless fields are kept so the log stays useful')
})
await t('redactUrl masks OAuth code/state and reset tokens in query strings but keeps the path', () => {
  const u = redactUrl('/api/auth/google/callback?code=4%2F0AbCd&state=eyJhbGciOi.abc.def&next=/shop'); assert.ok(!u.includes('4%2F0AbCd') && !u.includes('eyJhbGciOi')); assert.ok(u.startsWith('/api/auth/google/callback'))
  assert.ok(!redactUrl('/reset-password?token=abc123def').includes('abc123def'))
})
await t('error logs never contain the request password / authorization even when the failure happens inside a login-like route', async () => {
  const app = mini((a) => a.post('/login', asyncHandler(async (req) => { throw new Error(`lookup failed for ${req.body.identifier} password=${req.body.password}`) })))
  await withEnv(PROD, () => serve(app, async (req) => {
    const out = await captured(async () => { await req('POST', '/login', { body: { identifier: 'a@b.co', password: 'SuperSecret123' }, headers: { Authorization: 'Bearer abc.def.ghi', Cookie: 'sid=SuperSecret123' } }) })
    assert.ok(out.length > 0, 'something was logged'); assert.ok(!out.includes('SuperSecret123')); assert.ok(!/Bearer abc/.test(out))
  }))
})
await t('log lines avoid personal data: only the user id is attached, never e-mail / phone / name', async () => {
  const app = mini((a) => a.get('/x', (req, res, next) => { req.user = { _id: 'u1', email: 'private@example.com', phone: '9876543210', name: 'Private Person' }; next() }, asyncHandler(async () => { throw new Error('kaboom') })))
  await withEnv(PROD, () => serve(app, async (req) => { const out = await captured(async () => { await req('GET', '/x') }); assert.ok(out.includes('u1')); assert.ok(!/private@example|9876543210|Private Person/.test(out)) }))
})

// ── 8. process-level safety net ────────────────────────────────────────────────────────────────────────────────────
await t('unhandled promise rejections are logged (not silently ignored); uncaught exceptions are logged then exit(1)', async () => {
  const { EventEmitter } = await import('node:events'); const fake = new EventEmitter(); let exitCode = null
  installProcessHandlers(fake, { exit: (c) => { exitCode = c } })
  const out = await captured(async () => {
    fake.emit('unhandledRejection', new Error('forgotten promise token=SuperSecret123'))
    fake.emit('uncaughtException', new Error('sync throw'))
  })
  assert.match(out, /Unhandled promise rejection: forgotten promise/); assert.ok(!out.includes('SuperSecret123')); assert.match(out, /Uncaught exception/); assert.equal(exitCode, 1)
})

// ── 9. classification table (pure) ─────────────────────────────────────────────────────────────────────────────────
await t('classifyError: driver outage errors → 503, everything else is not mistaken for an outage', () => {
  const msg = (e) => classifyError(e, { prod: true })
  assert.equal(msg(new MongoNetworkError('x')).status, 503)
  assert.equal(msg(Object.assign(new Error('Operation `users.find()` buffering timed out after 10000ms'), { name: 'MongooseError' })).status, 503)
  assert.equal(msg(new MongoServerError({ code: 91, message: 'shutdown' })).status, 503)
  assert.equal(msg(Object.assign(new Error('connect ECONNREFUSED smtp.example.com:587'), { code: 'ECONNREFUSED' })).status, 500, 'a failing SMTP/Cloudinary call is not "the database is down"')
  assert.equal(msg(new MongoServerError({ code: 13, message: 'unauthorized' })).status, 500)
})

console.log(`\n${passed} passed, ${failures} failed`)
process.exit(failures ? 1 : 0)
