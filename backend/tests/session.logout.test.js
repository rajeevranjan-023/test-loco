// Logout revocation (no database): a logged-out token is refused by protect / optionalAuth; other tokens of the same user are not.
// The Mongoose models are stubbed in memory; the REAL middleware and controller code runs.
import assert from 'node:assert/strict'
process.env.JWT_SECRET = 'test-secret'
const { default: jwt } = await import('jsonwebtoken')
const { default: User } = await import('../models/common/User.js')
const { default: RevokedToken } = await import('../models/RevokedToken.js')
const { protect, optionalAuth, tokenHash } = await import('../middleware/auth.js')
const { logout } = await import('../controllers/authController.js')
const { generateToken } = await import('../utils/generateToken.js')

const revoked = new Map(), users = { u1: { _id: 'u1', name: 'A' }, u2: { _id: 'u2', name: 'B' } }
User.findById = async (id) => users[id] || null
RevokedToken.exists = async ({ hash }) => (revoked.has(hash) ? { _id: 1 } : null)
RevokedToken.updateOne = async ({ hash }, update) => { if (!revoked.has(hash)) revoked.set(hash, update.$setOnInsert); return {} }

const res = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r }, json(b) { r.body = b; return r } }; return r }
const run = async (mw, token) => { const req = { headers: token ? { authorization: `Bearer ${token}` } : {} }, r = res(); let nexted = false; await mw(req, r, () => { nexted = true }); return { req, r, nexted } }
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('✅', name) }

const tokA1 = generateToken('u1'), tokA2 = jwt.sign({ id: 'u1', again: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' }), tokB = generateToken('u2')
await t('a valid token authenticates', async () => { const { req, nexted } = await run(protect, tokA1); assert.ok(nexted); assert.equal(req.user.name, 'A') })
await t('POST /logout revokes exactly that token (stored by hash, never the token itself)', async () => {
  const { r } = await run(async (req, rs, nx) => { req.user = users.u1; await logout(req, rs, nx) }, tokA1)
  assert.deepEqual(r.body, { ok: true }); assert.ok(revoked.has(tokenHash(tokA1))); assert.ok(![...revoked.keys()].some((k) => tokA1.includes(k)))
  assert.ok(+revoked.get(tokenHash(tokA1)).expiresAt > Date.now())
})
await t('the logged-out token is refused (401) — a stale tab / copied header cannot restore the session', async () => { const { r, nexted } = await run(protect, tokA1); assert.equal(r.code, 401); assert.ok(!nexted) })
await t('another session of the SAME user is untouched (logout is per session, not "log out everywhere")', async () => { const { nexted, req } = await run(protect, tokA2); assert.ok(nexted); assert.equal(req.user._id, 'u1') })
await t("a different user's token is untouched", async () => { const { nexted, req } = await run(protect, tokB); assert.ok(nexted); assert.equal(req.user.name, 'B') })
await t('optionalAuth treats a revoked token as a guest (public pages still load)', async () => { const { req, nexted } = await run(optionalAuth, tokA1); assert.ok(nexted); assert.equal(req.user, undefined) })
await t('no token / garbage token → 401 in protect', async () => { assert.equal((await run(protect, null)).r.code, 401); assert.equal((await run(protect, 'garbage')).r.code, 401) })
await t('logging out twice is harmless', async () => { await run(async (req, rs, nx) => { req.user = users.u1; await logout(req, rs, nx) }, tokA1); assert.equal([...revoked.keys()].length, 1) })
console.log(`\n${n} session/logout tests passed`); process.exit(0)
