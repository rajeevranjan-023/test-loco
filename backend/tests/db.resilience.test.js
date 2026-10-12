// Database failure handling against the REAL Mongoose / MongoDB driver and the REAL app (server.js, connectDB, guard, health).
// No MongoDB installation and no real database is involved:
//   • "unavailable" = a closed local port → the driver produces its genuine server-selection errors;
//   • "available, then lost, then back" = tests/_support/fakeMongo.js, a minimal wire-protocol stand-in on 127.0.0.1 that lets the
//     real driver connect, notice the loss and reconnect. It stores nothing and nothing here writes data.
//   node tests/db.resilience.test.js
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'
process.env.LOG_IN_TEST = 'true'
// A deliberately credential-looking URI on a closed port: the password must never appear in any log or response.
process.env.MONGODB_URI = 'mongodb://admin:SuperSecret123@127.0.0.1:1/never_connected'
process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS = '400'
process.env.MONGO_CONNECT_TIMEOUT_MS = '400'
process.env.MONGO_HEARTBEAT_MS = '500'
delete process.env.RENDER; delete process.env.VERCEL

const { default: mongoose } = await import('mongoose')
mongoose.set('autoIndex', false); mongoose.set('autoCreate', false); mongoose.set('bufferTimeoutMS', 300)
const { default: express } = await import('express')
const { default: app } = await import('../server.js')
const { connectDB, isDbReady, dbConnectOptions } = await import('../config/db.js')
const { requestId, notFound, errorHandler } = await import('../middleware/errorHandler.js')
const { asyncHandler } = await import('../utils/asyncHandler.js')
const { default: User } = await import('../models/common/User.js')
const { startFakeMongo } = await import('./_support/fakeMongo.js')

const inProduction = async (fn) => { const o = process.env.NODE_ENV, l = process.env.LOG_IN_TEST; process.env.NODE_ENV = 'production'; delete process.env.LOG_IN_TEST; try { return await fn() } finally { process.env.NODE_ENV = o; process.env.LOG_IN_TEST = l } }
let failures = 0, passed = 0
const t = async (name, fn) => { try { await fn(); passed++; console.log('✅', name) } catch (e) { failures++; console.log('❌', name, '\n    ', String(e.message).split('\n')[0]) } }
async function captured(fn) {
  const lines = [], orig = { log: console.log, warn: console.warn, error: console.error }
  for (const k of Object.keys(orig)) console[k] = (...a) => lines.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
  try { await fn() } finally { Object.assign(console, orig) }
  return lines.join('\n')
}
async function serve(a, fn) {
  const server = await new Promise((r) => { const s = a.listen(0, '127.0.0.1', () => r(s)) }), base = `http://127.0.0.1:${server.address().port}`
  try { return await fn(async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body })
    let data = null; try { data = await res.json() } catch { /* */ }
    return { status: res.status, data, headers: res.headers }
  }) } finally { await new Promise((r) => server.close(r)) }
}
const until = async (cond, ms, label) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error(`timed out waiting for: ${label}`); await new Promise((r) => setTimeout(r, 50)) } return Date.now() - t0 }
const LEAK = /SuperSecret123|admin:|127\.0\.0\.1|ECONNREFUSED|MongoServerSelection|MongooseServerSelection|MongoNetwork|buffering|never_connected|:27017|:1\b/

// ── connection options ─────────────────────────────────────────────────────────────────────────────────────────────
await t('connection waits are bounded (no 30 s defaults) and overridable', () => {
  assert.deepEqual(dbConnectOptions({}), { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 10000 })
  assert.equal(dbConnectOptions({ MONGO_SERVER_SELECTION_TIMEOUT_MS: '2500', MONGO_HEARTBEAT_MS: '1000' }).serverSelectionTimeoutMS, 2500)
  assert.equal(dbConnectOptions({ MONGO_HEARTBEAT_MS: '1000' }).heartbeatFrequencyMS, 1000)
  assert.equal(dbConnectOptions({ MONGO_HEARTBEAT_MS: 'abc' }).heartbeatFrequencyMS, undefined, 'garbage falls back to the driver default')
})

// ── 1. MongoDB unavailable during startup ──────────────────────────────────────────────────────────────────────────
await t('startup with MongoDB unavailable: fails within the bounded wait, logs a REDACTED reason, never prints the password', async () => {
  const t0 = Date.now(); let err
  const out = await captured(async () => { err = await connectDB({ exitOnFail: false }).then(() => null, (e) => e) })
  assert.ok(err, 'connectDB rejects'); assert.match(err.name, /ServerSelection|Network/); assert.ok(Date.now() - t0 < 4000, `bounded (took ${Date.now() - t0} ms, driver default would be 30000)`)
  assert.match(out, /MongoDB connection error at startup/); assert.ok(!out.includes('SuperSecret123') && !out.includes('admin:'), 'credentials never logged')
  assert.equal(isDbReady(), false)
})
await t('startup behaviour is unchanged by default: a failed first connection still exits the process with code 1', async () => {
  const realExit = process.exit; let code = null
  process.exit = (c) => { code = c; throw new Error('__exit__') }
  try { await captured(async () => { await assert.rejects(connectDB(), /__exit__/) }) } finally { process.exit = realExit }
  assert.equal(code, 1)
})

// ── 2. while the database is unavailable ───────────────────────────────────────────────────────────────────────────
await t('readiness is truthful: /api/health and /api/health/ready are 503 while the DB is down; /api/health/live stays 200', async () => serve(app, async (req) => {
  const h = await req('GET', '/api/health'); assert.equal(h.status, 503); assert.deepEqual(h.data, { status: 'unavailable', database: 'down' }); assert.ok(h.headers.get('retry-after'))
  assert.equal((await req('GET', '/api/health/ready')).status, 503)
  const live = await req('GET', '/api/health/live'); assert.equal(live.status, 200); assert.equal(live.data.status, 'ok')
  assert.ok(!LEAK.test(JSON.stringify(h.data)))
}))
await t('requests while the DB is down get an immediate, safe 503 (no 10–30 s hang, no host / driver text)', async () => serve(app, async (req) => {
  const out = await captured(async () => {
    for (const [m, p, b] of [['GET', '/api/shops'], ['GET', '/api/home'], ['POST', '/api/auth/login', JSON.stringify({ identifier: 'a@b.co', password: 'SuperSecret123' })], ['GET', '/api/seller/products']]) {
      const t0 = Date.now(); const r = await req(m, p, b)
      assert.equal(r.status, 503, `${m} ${p}`); assert.equal(r.data.code, 'DATABASE_UNAVAILABLE'); assert.ok(Date.now() - t0 < 500, `${m} ${p} answered in ${Date.now() - t0} ms`)
      assert.ok(r.headers.get('retry-after')); assert.ok(r.data.requestId); assert.ok(!LEAK.test(JSON.stringify(r.data)), `leak in ${p}`)
    }
  })
  assert.ok(!out.includes('SuperSecret123'), 'the attempted login password is not logged')
}))
await t('requests that do not need the DB are still answered properly while it is down (malformed JSON → 400, not 503)', async () => serve(app, async (req) => {
  const r = await req('POST', '/api/auth/login', '{"broken":'); assert.equal(r.status, 400); assert.equal(r.data.code, 'INVALID_JSON')
}))
await t('a query that slips past the guard (DB drops mid-request) fails with a real driver timeout → mapped to 503, bounded, and a write is attempted exactly once (no automatic retry)', async () => {
  let writeAttempts = 0
  const mini = express(); mini.use(requestId); mini.use(express.json())
  mini.get('/read', asyncHandler(async (req, res) => res.json(await User.findOne({}))))
  mini.post('/write', asyncHandler(async (req, res) => { writeAttempts++; res.json(await User.collection.insertOne({ probe: 1 })) }))
  mini.use(notFound); mini.use(errorHandler)
  await inProduction(() => serve(mini, async (req) => { await captured(async () => {
    for (const [m, p] of [['GET', '/read'], ['POST', '/write']]) {
      const t0 = Date.now(); const r = await req(m, p, m === 'POST' ? '{}' : undefined)
      assert.equal(r.status, 503, `${m} ${p} → ${r.status} ${JSON.stringify(r.data)}`); assert.equal(r.data.code, 'DATABASE_UNAVAILABLE'); assert.ok(Date.now() - t0 < 3000); assert.ok(!LEAK.test(JSON.stringify(r.data)))
    }
  }) }))
  assert.equal(writeAttempts, 1, 'the server never replays a write on its own')
})

// ── 3. real disconnect → recovery ──────────────────────────────────────────────────────────────────────────────────
await t('DATABASE LOST AND RECOVERED (real driver): ready → lost (503 everywhere, quickly) → restored (serving again), with accurate logs and no leaks', async () => {
  let fake = await startFakeMongo(); const port = fake.port
  process.env.MONGODB_URI = fake.uri('lifecycle')
  const log = await captured(async () => {
    await serve(app, async (req) => {
      await connectDB({ exitOnFail: false })
      assert.equal(isDbReady(), true, 'connected')
      const up = await req('GET', '/api/health'); assert.equal(up.status, 200); assert.deepEqual(up.data, { status: 'ok', database: 'up' })
      const pass = await req('GET', '/api/definitely-missing'); assert.equal(pass.status, 404, 'with the DB up the guard lets the request through (normal 404)'); assert.equal(pass.data.code, 'ROUTE_NOT_FOUND')

      await fake.stop() // ← the database goes away
      const detected = await until(() => !isDbReady(), 6000, 'the loss to be detected')
      assert.ok(detected < 3000, `loss detected in ${detected} ms`)
      const down = await req('GET', '/api/health'); assert.equal(down.status, 503); assert.equal(down.data.database, 'down')
      const refused = await req('GET', '/api/shops'); assert.equal(refused.status, 503); assert.equal(refused.data.code, 'DATABASE_UNAVAILABLE'); assert.ok(!LEAK.test(JSON.stringify(refused.data)))
      assert.equal((await req('GET', '/api/health/live')).status, 200, 'the process itself is still alive')

      fake = await startFakeMongo(port) // ← and comes back on the same address
      const recovered = await until(isDbReady, 10000, 'the connection to recover')
      assert.ok(recovered < 8000, `recovered in ${recovered} ms`)
      const back = await req('GET', '/api/health'); assert.equal(back.status, 200); assert.equal(back.data.database, 'up')
      assert.equal((await req('GET', '/api/definitely-missing')).status, 404, 'requests flow again without restarting the server')
    })
  })
  assert.match(log, /connection lost/i, 'the loss is logged (warn)'); assert.match(log, /restored|reconnected/i, 'the recovery is logged')
  assert.ok(!LEAK.test(log.replace(/MongoDB connected: [\w.:-]+/g, '')), 'no URI / credentials in the lifecycle log')
  await mongoose.disconnect(); await fake.stop()
})

console.log(`\n${passed} passed, ${failures} failed`)
process.exit(failures ? 1 : 0)
