// Signup / OTP / Google-login / protected-access integration test (real HTTP + a Mongo-compatible DB):
//   MONGODB_URI=mongodb://127.0.0.1:27018/loco_auth node tests/auth.int.test.js
// Google's servers can't be reached from CI, so ONLY `googleOAuth.exchangeCode` is stubbed; state, CSRF cookie, tickets,
// linking, registration, OTP and sessions all run for real.
import assert from 'node:assert/strict'
import 'dotenv/config'
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'test-secret'
process.env.OTP_DEV_FIXED = 'true'; process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'; process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
process.env.API_PUBLIC_URL = 'http://localhost:5000'
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/loco_auth'

const { default: mongoose } = await import('mongoose')
mongoose.set('autoIndex', false) // indexes are built below so TTL can be skipped on FerretDB (it lacks TTL indexes; real MongoDB has them)
const { default: app } = await import('../server.js')
const { connectDB } = await import('../config/db.js')
const { default: User } = await import('../models/User.js')
const { default: Shop } = await import('../models/Shop.js')
const { default: RegistrationSession } = await import('../models/RegistrationSession.js')
const { googleOAuth } = await import('../utils/googleOAuth.js')
const otp = await import('../utils/otp.js')
const { safeNext, normalizeIndianMobile, validatePassword } = await import('../utils/authHelpers.js')
{ const { assertDisposableDb } = await import('./_safeDb.js'); assertDisposableDb(process.env.MONGODB_URI, 'auth.int') } // never drop a non-local database
await connectDB(); await mongoose.connection.dropDatabase()
// Build every declared index (unique / sparse / compound) for real — only the TTL option is dropped for FerretDB.
for (const M of Object.values(mongoose.models)) {
  for (const [fields, opts] of M.schema.indexes()) {
    const o = { ...opts }; delete o.expireAfterSeconds; delete o.background
    try { await M.collection.createIndex(fields, o) } catch (e) { console.log(`ℹ️  index skipped on ${M.modelName} ${JSON.stringify(fields)}: ${e.message}`) }
  }
}

const server = app.listen(0); const base = `http://localhost:${server.address().port}`
const req = async (method, path, body, { token, reg, headers = {}, redirect = 'follow' } = {}) => {
  const r = await fetch(base + path, { method, redirect, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(reg ? { 'x-registration-token': reg } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
  let data = null; try { data = await r.json() } catch {}
  return { status: r.status, data, res: r }
}
const ok = (c, m) => { assert.ok(c, m); console.log('✅', m) }

// ── Google helper: runs start → callback (with a stubbed Google identity) and returns the ticket from the redirect ──
async function googleSignIn(identity, next = '/') {
  const s = await req('GET', `/api/auth/google/start?next=${encodeURIComponent(next)}`, null, { redirect: 'manual' })
  assert.equal(s.status, 302); const loc = new URL(s.res.headers.get('location'))
  const cookie = s.res.headers.get('set-cookie').split(';')[0]
  googleOAuth.exchangeCode = async (code, nonce) => { assert.equal(nonce, loc.searchParams.get('nonce')); return identity }
  const cb = await fetch(`${base}/api/auth/google/callback?code=abc&state=${encodeURIComponent(loc.searchParams.get('state'))}`, { redirect: 'manual', headers: { cookie } })
  return { start: s, loc, cb, cookie, ticket: new URL(cb.headers.get('location'), 'http://x').searchParams.get('ticket'), cbLoc: cb.headers.get('location') }
}
const G1 = { sub: 'g-111', email: 'rajeev@gmail.com', emailVerified: true, name: 'Rajeev Kumar', picture: 'https://lh3.googleusercontent.com/a/x' }

// ───────────────────────── public vs protected (backend enforces) ─────────────────────────
for (const [m, p] of [['GET', '/api/auth/me'], ['PATCH', '/api/auth/onboarding'], ['POST', '/api/follow'], ['POST', '/api/seller/start'], ['GET', '/api/seller/products'], ['POST', '/api/seller/sales'], ['GET', '/api/seller/dashboard'], ['POST', '/api/media/upload']]) {
  const r = await req(m, p, m === 'GET' ? null : {}); assert.equal(r.status, 401, `${m} ${p} -> ${r.status}`)
}
ok(true, 'protected API routes (me, onboarding, follow, seller start/products/sales/dashboard, media upload) return 401 without a token')
ok((await req('GET', '/api/shops')).status === 200 && (await req('GET', '/api/home')).status !== 401 && (await req('GET', '/api/search?q=a')).status !== 401, 'public listings, home and search need no login')
ok((await req('POST', '/api/auth/register/personal', {})).status === 401 && (await req('POST', '/api/auth/register/complete', {})).status === 401, 'registration steps refuse requests without a registration token')
ok((await req('POST', '/api/auth/register/personal', {}, { reg: 'forged-token' })).status === 401, 'a forged registration token is refused')
{ // CORS permission is not authorization: an allowed-origin preflight succeeds, yet the real request is still token-checked.
  const pf = await req('OPTIONS', '/api/auth/register/session', null, { headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-registration-token' } })
  ok(pf.status === 204 && /x-registration-token/i.test(pf.res.headers.get('access-control-allow-headers') || ''), 'preflight with x-registration-token is allowed for the frontend origin')
  const noTok = await req('GET', '/api/auth/register/session', null, { headers: { Origin: 'http://localhost:5173' } })
  ok(noTok.status === 401 && noTok.data.code === 'REG_EXPIRED', 'allowed origin without a registration token is still 401 (CORS is not authorization)')
  ok((await req('GET', '/api/auth/register/session', null, { reg: 'forged-token', headers: { Origin: 'http://localhost:5173' } })).status === 401, 'allowed origin with a forged registration token is still 401')
}

// ───────────────────────── safe redirects ─────────────────────────
ok(safeNext('/shop/abc?x=1') === '/shop/abc?x=1' && safeNext('//evil.com') === '/' && safeNext('https://evil.com') === '/' && safeNext('/\\evil.com') === '/' && safeNext('javascript:alert(1)') === '/' && safeNext('/a\nb') === '/' && safeNext(undefined) === '/', 'safeNext allows internal paths only (rejects //host, https://, backslash, javascript:, control chars)')
{ const g = await googleSignIn(G1, 'https://evil.com/steal'); ok(g.start.status === 302, 'start ok'); const t = await req('POST', '/api/auth/google/exchange', { ticket: g.ticket }); ok(t.data.next === '/', 'external next URL passed to Google start is discarded → "/"') }

// ───────────────────────── Google OAuth plumbing ─────────────────────────
{
  const s = await req('GET', '/api/auth/google/start?next=/@raj236', null, { redirect: 'manual' })
  const loc = new URL(s.res.headers.get('location'))
  ok(loc.origin === 'https://accounts.google.com' && loc.searchParams.get('client_id') === process.env.GOOGLE_CLIENT_ID && loc.searchParams.get('response_type') === 'code' && loc.searchParams.get('redirect_uri') === 'http://localhost:5000/api/auth/google/callback' && /openid/.test(loc.searchParams.get('scope')) && loc.searchParams.get('prompt') === 'select_account' && loc.searchParams.get('nonce') && loc.searchParams.get('state'), 'start redirects to Google with client_id, code flow, scopes, account chooser, nonce, signed state')
  ok(/HttpOnly/i.test(s.res.headers.get('set-cookie')) && /SameSite=Lax/i.test(s.res.headers.get('set-cookie')), 'CSRF cookie is HttpOnly + SameSite=Lax')
  const bad = await fetch(`${base}/api/auth/google/callback?code=x&state=garbage`, { redirect: 'manual' }); ok(/error=invalid_state/.test(bad.headers.get('location')), 'tampered state is rejected')
  const noCookie = await fetch(`${base}/api/auth/google/callback?code=x&state=${encodeURIComponent(loc.searchParams.get('state'))}`, { redirect: 'manual' }); ok(/error=invalid_state/.test(noCookie.headers.get('location')), 'callback without the CSRF cookie is rejected (login-CSRF guard)')
  const denied = await fetch(`${base}/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(loc.searchParams.get('state'))}`, { redirect: 'manual', headers: { cookie: s.res.headers.get('set-cookie').split(';')[0] } }); ok(/error=google_cancelled/.test(denied.headers.get('location')), 'user cancelling at Google returns to login with a clear error')
  googleOAuth.exchangeCode = async () => { throw new Error('bad token') }
  const s2 = await req('GET', '/api/auth/google/start', null, { redirect: 'manual' }); const l2 = new URL(s2.res.headers.get('location'))
  const fail = await fetch(`${base}/api/auth/google/callback?code=x&state=${encodeURIComponent(l2.searchParams.get('state'))}`, { redirect: 'manual', headers: { cookie: s2.res.headers.get('set-cookie').split(';')[0] } }); ok(/error=google_failed/.test(fail.headers.get('location')), 'an ID token that fails verification never creates a session')
  const un = await googleSignIn({ ...G1, sub: 'g-unverified', email: 'unv@gmail.com', emailVerified: false }); ok(/error=google_email_unverified/.test(un.cbLoc), 'an unverified Google email is refused')
  ok((await User.countDocuments()) === 0, 'no user rows were created by any of the above')
}

// ───────────────────────── new Google user → full registration ─────────────────────────
let g = await googleSignIn(G1, '/@shopx236')
ok(/\/auth\/callback\?ticket=/.test(g.cbLoc) && !/token=|password/.test(g.cbLoc), 'callback redirects with a one-time ticket only (no session token in the URL)')
let ex = await req('POST', '/api/auth/google/exchange', { ticket: g.ticket })
ok(ex.status === 200 && ex.data.status === 'register' && ex.data.registrationToken && ex.data.next === '/@shopx236', 'new Google account → registration begins, intended destination preserved')
ok((await req('POST', '/api/auth/google/exchange', { ticket: g.ticket })).status === 400, 'a ticket can be redeemed only once')
const REG = ex.data.registrationToken
let sess = await req('GET', '/api/auth/register/session', null, { reg: REG })
ok(sess.data.email === 'rajeev@gmail.com' && sess.data.emailVerified === true && sess.data.profile.fullName === 'Rajeev Kumar' && sess.data.step === 'personal', 'session prefills name/email from Google; email is verified; step = personal')
ok(sess.data.otp.length === 4 && sess.data.otp.devMode === true && !JSON.stringify(sess.data).includes('1435'), 'API reports dev-mode + code length but never the code itself')

// validation
let p = await req('POST', '/api/auth/register/personal', { fullName: 'R', phone: '12345', dob: '2999-01-01', city: '', state: '', country: 'France' }, { reg: REG })
ok(p.status === 400 && p.data.errors.fullName && p.data.errors.phone && p.data.errors.dob && p.data.errors.city && p.data.errors.state && p.data.errors.country, 'backend validates every required personal field')
p = await req('POST', '/api/auth/register/personal', { fullName: 'Rajeev Kumar', phone: '9876543210', dob: '2015-01-01', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India' }, { reg: REG })
ok(p.status === 400 && p.data.errors.dob, 'under-13 date of birth is refused')
p = await req('POST', '/api/auth/register/personal', { fullName: 'Rajeev Kumar', phone: '9876543210', dob: '2004-03-15', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India', avatarUrl: 'https://evil.example/x.png' }, { reg: REG })
ok(p.status === 400 && p.data.errors.avatarUrl, 'arbitrary avatar URLs are refused')
ok(JSON.stringify(normalizeIndianMobile('+91 98765-43210')) === JSON.stringify({ national: '9876543210', e164: '+919876543210' }) && normalizeIndianMobile('09876543210')?.national === '9876543210' && normalizeIndianMobile('5876543210') === null, 'mobile numbers normalise consistently (+91 / 0 / spaces) and reject invalid ones')

// cannot skip OTP
let c = await req('POST', '/api/auth/register/complete', { username: '@rajeev236', password: 'Sup3rSecret', confirmPassword: 'Sup3rSecret' }, { reg: REG })
ok(c.status === 400 || c.status === 403, 'cannot create the account before the personal step')
const personal = { fullName: 'Rajeev Kumar', phone: '+91 98765 43210', dob: '2004-03-15', gender: 'male', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India' }
p = await req('POST', '/api/auth/register/personal', personal, { reg: REG })
ok(p.status === 200 && p.data.step === 'otp' && p.data.phoneMasked, 'valid personal info → OTP step; masked number shown')
c = await req('POST', '/api/auth/register/complete', { username: '@rajeev236', password: 'Sup3rSecret', confirmPassword: 'Sup3rSecret' }, { reg: REG })
ok(c.status === 403 && c.data.code === 'OTP_REQUIRED', 'complete is refused until the backend has verified the OTP (a frontend flag is irrelevant)')
const forged = await req('POST', '/api/auth/register/complete', { username: '@rajeev236', password: 'Sup3rSecret', confirmPassword: 'Sup3rSecret', otpVerified: true, phoneVerified: true, step: 'credentials' }, { reg: REG })
ok(forged.status === 403, 'client-supplied "otpVerified/step" fields are ignored')

// OTP behaviour
let v = await req('POST', '/api/auth/register/otp/verify', { code: '0000' }, { reg: REG })
ok(v.status === 400 && v.data.reason === 'invalid' && v.data.attemptsLeft === 4, 'wrong OTP is rejected by the backend and attempts are counted')
let rs = await req('POST', '/api/auth/register/otp/resend', {}, { reg: REG })
ok(rs.status === 429 && rs.data.code === 'COOLDOWN', 'resend is rate-limited by a cooldown')
for (let i = 0; i < 4; i++) v = await req('POST', '/api/auth/register/otp/verify', { code: '9999' }, { reg: REG })
ok(v.status === 429 && v.data.reason === 'locked', 'OTP locks after 5 wrong attempts')
v = await req('POST', '/api/auth/register/otp/verify', { code: '1435' }, { reg: REG })
ok(v.status === 429 && v.data.reason === 'locked', 'even the correct code is refused while locked')
// let the cooldown pass, then resend (shorten cooldown for the test)
process.env.OTP_RESEND_COOLDOWN_SECONDS = '0.05'; await new Promise((r) => setTimeout(r, 120))
rs = await req('POST', '/api/auth/register/otp/resend', {}, { reg: REG })
ok(rs.status === 200 && rs.data.otp.length === 4, 'resend after the cooldown issues a fresh code and clears the lock')
process.env.OTP_RESEND_COOLDOWN_SECONDS = '30'
v = await req('POST', '/api/auth/register/otp/verify', { code: '1435' }, { reg: REG })
ok(v.status === 200 && v.data.step === 'credentials', 'dev-mode OTP is validated on the backend and unlocks the credentials step')

// credentials
const u = (username, password, confirmPassword = password) => req('POST', '/api/auth/register/complete', { username, password, confirmPassword }, { reg: REG })
ok((await u('rajeev', 'Sup3rSecret')).data.errors.username, 'username must follow the app policy (needs 3+ digits)')
ok((await u('@rajeev236', 'short1')).data.errors.password, 'password under 8 chars refused')
ok((await u('@rajeev236', 'onlyletters')).data.errors.password, 'password needs a number')
ok((await u('@rajeev236', 'password123')).data.errors.password, 'common password refused')
ok((await u('@rajeev236', 'rajeev236Aa')).data.errors.password, 'password containing the username refused')
ok((await u('@rajeev236', 'Sup3rSecret', 'Different1')).data.errors.confirmPassword, 'confirmation mismatch refused')
const dummyUser = await User.create({ name: 'Taken', email: 'taken@x.com', password: 'secret123', username: '@taken236' })
ok((await req('GET', '/api/auth/register/check-username?username=@taken236', null, { reg: REG })).data.available === false && (await req('GET', '/api/auth/register/check-username?username=fresh2364', null, { reg: REG })).data.available === true, 'username availability check: taken vs free')
ok((await u('@taken236', 'Sup3rSecret')).data.errors.username, 'taken username refused at submit')

// double submit
const [a, b] = await Promise.all([u('@rajeev236', 'Sup3rSecret'), u('@rajeev236', 'Sup3rSecret')])
const c3 = await u('@rajeev236', 'Sup3rSecret')
ok([a.status, b.status].includes(201) && c3.status === 200 && c3.data.replay === true, 'simultaneous + repeated submits succeed once (201) and replay safely (200)')
ok((await User.countDocuments({ email: 'rajeev@gmail.com' })) === 1 && (await User.countDocuments({ googleId: 'g-111' })) === 1 && (await User.countDocuments({ phoneE164: '+919876543210' })) === 1, 'exactly ONE account exists for that Google identity / email / mobile')
const created = await User.findOne({ email: 'rajeev@gmail.com' }).select('+password')
ok(created.password && created.password !== 'Sup3rSecret' && created.password.startsWith('$2'), 'password stored as a bcrypt hash')
ok(created.username === '@rajeev236' && created.phoneVerified && created.emailVerified && created.googleId === 'g-111' && created.address.city === 'Bhopal' && created.role === 'consumer' && created.onboarding.completed === false, 'account has username, verified phone/email, Google link, profile, consumer role, onboarding pending')
ok(!JSON.stringify(c3.data.user).includes('password') && !JSON.stringify(c3.data.user).includes('$2'), 'API never returns the password hash')
const TOKEN = a.data?.token || b.data?.token || c3.data.token
ok((await req('GET', '/api/auth/me', null, { token: TOKEN })).data.user.email === 'rajeev@gmail.com', 'new session token works on protected /me')
ok((await req('GET', '/api/seller/products', null, { token: TOKEN })).status === 403, 'a consumer cannot reach seller-only APIs (403)')

// second person, same phone → blocked
{
  const g2 = await googleSignIn({ sub: 'g-222', email: 'other@gmail.com', emailVerified: true, name: 'Other' }); const e2 = await req('POST', '/api/auth/google/exchange', { ticket: g2.ticket })
  const dup = await req('POST', '/api/auth/register/personal', { ...personal, fullName: 'Other Person' }, { reg: e2.data.registrationToken })
  ok(dup.status === 409 && dup.data.code === 'PHONE_EXISTS', 'a verified mobile number cannot be used by a second account')
}

// ───────────────────────── returning Google user ─────────────────────────
g = await googleSignIn(G1, '/@shopx236'); ex = await req('POST', '/api/auth/google/exchange', { ticket: g.ticket })
ok(ex.data.status === 'authenticated' && ex.data.token && ex.data.user.username === '@rajeev236' && ex.data.next === '/@shopx236', 'same Google account signs straight in (no repeated registration), original destination preserved')
ok((await User.countDocuments()) === 2, 'no duplicate user created on re-login')

// ───────────────────────── unfinished registration resumes ─────────────────────────
{
  const id = { sub: 'g-333', email: 'resume@gmail.com', emailVerified: true, name: 'Resume Me' }
  const e1 = await req('POST', '/api/auth/google/exchange', { ticket: (await googleSignIn(id)).ticket })
  await req('POST', '/api/auth/register/personal', { ...personal, phone: '9123456780', fullName: 'Resume Me' }, { reg: e1.data.registrationToken })
  const e2 = await req('POST', '/api/auth/google/exchange', { ticket: (await googleSignIn(id)).ticket })
  const s2 = await req('GET', '/api/auth/register/session', null, { reg: e2.data.registrationToken })
  ok(s2.data.step === 'otp' && s2.data.profile.phone === '9123456780' && (await RegistrationSession.countDocuments({ googleId: 'g-333' })) === 1, 'returning mid-registration resumes the same session (one session, saved progress)')
  ok((await req('GET', '/api/auth/register/session', null, { reg: e1.data.registrationToken })).status === 401, 'the old registration token stops working once resumed elsewhere')
}

// ───────────────────────── linking an existing password account ─────────────────────────
{
  await User.create({ name: 'Old Timer', email: 'oldtimer@gmail.com', password: 'legacy-pass', username: '@old2346' })
  const gl = await googleSignIn({ sub: 'g-444', email: 'oldtimer@gmail.com', emailVerified: true, name: 'Old Timer' }, '/search')
  const e = await req('POST', '/api/auth/google/exchange', { ticket: gl.ticket })
  ok(e.data.status === 'link_required' && e.data.maskedEmail.includes('•') && !e.data.token, 'Google email matches an existing account → NOT merged automatically; ownership proof required')
  ok((await User.findOne({ email: 'oldtimer@gmail.com' })).googleId === undefined, 'nothing linked yet')
  ok((await req('POST', '/api/auth/google/link', { ticket: gl.ticket, password: 'wrong' })).status === 401, 'wrong password cannot link')
  const l = await req('POST', '/api/auth/google/link', { ticket: gl.ticket, password: 'legacy-pass' })
  ok(l.data.status === 'authenticated' && l.data.token && l.data.next === '/search', 'correct password links Google and signs in')
  ok((await User.countDocuments({ email: 'oldtimer@gmail.com' })) === 1 && (await User.findOne({ email: 'oldtimer@gmail.com' })).googleId === 'g-444', 'still one account, now linked')
  ok((await req('POST', '/api/auth/google/link', { ticket: gl.ticket, password: 'legacy-pass' })).status === 400, 'link ticket is single-use')
  const gl2 = await googleSignIn({ sub: 'g-555', email: 'oldtimer@gmail.com', emailVerified: true, name: 'Impostor' })
  ok(/error=email_linked_to_other_google/.test(gl2.cbLoc), 'a different Google identity with the same email cannot take over a linked account')
}

// ───────────────────────── password login (username / email) ─────────────────────────
{
  const l1 = await req('POST', '/api/auth/login', { identifier: 'rajeev236', password: 'Sup3rSecret' }); const l2 = await req('POST', '/api/auth/login', { identifier: '@rajeev236', password: 'Sup3rSecret' })
  const l3 = await req('POST', '/api/auth/login', { identifier: 'RAJEEV@gmail.com', password: 'Sup3rSecret' }); const l4 = await req('POST', '/api/auth/login', { email: 'rajeev@gmail.com', password: 'Sup3rSecret' })
  ok([l1, l2, l3, l4].every((r) => r.status === 200 && r.data.token), 'login works with username (with/without @), email, and the legacy {email} body')
  ok((await req('POST', '/api/auth/login', { identifier: 'rajeev236', password: 'nope' })).status === 401 && (await req('POST', '/api/auth/login', { identifier: 'ghost999', password: 'nope' })).status === 401, 'wrong password / unknown user → 401')
}

// ───────────────────────── forgot / reset password ─────────────────────────
{
  const logs = []; const origLog = console.log; console.log = (...a) => logs.push(a.join(' '))
  const f = await req('POST', '/api/auth/forgot-password', { identifier: 'rajeev@gmail.com' }); const f2 = await req('POST', '/api/auth/forgot-password', { identifier: 'nobody@nowhere.com' })
  console.log = origLog
  ok(f.status === 200 && f2.status === 200 && f.data.message === f2.data.message, 'forgot-password answers identically for known and unknown accounts')
  const tok = (logs.join('\n').match(/reset-password\?token=([^\s]+)/) || [])[1]; ok(!!tok, 'dev mail transport produced a reset link')
  ok((await req('POST', '/api/auth/reset-password', { token: tok, password: 'weak', confirmPassword: 'weak' })).status === 400, 'reset enforces the password policy')
  ok((await req('POST', '/api/auth/reset-password', { token: tok, password: 'Brand-New9pw', confirmPassword: 'Brand-New9pw' })).status === 200, 'reset with a valid token works')
  ok((await req('POST', '/api/auth/reset-password', { token: tok, password: 'Another-New9pw', confirmPassword: 'Another-New9pw' })).status === 400, 'reset token is single-use')
  ok((await req('POST', '/api/auth/login', { identifier: 'rajeev236', password: 'Brand-New9pw' })).status === 200 && (await req('POST', '/api/auth/login', { identifier: 'rajeev236', password: 'Sup3rSecret' })).status === 401, 'old password stops working, new one works')
}

// ───────────────────────── onboarding: account types, interests, location, business ─────────────────────────
const T = (await req('POST', '/api/auth/login', { identifier: 'rajeev236', password: 'Brand-New9pw' })).data.token
{
  ok((await req('PATCH', '/api/auth/onboarding', { accountTypes: ['hacker'] }, { token: T })).status === 400, 'unknown account type refused')
  ok((await req('PATCH', '/api/auth/onboarding', { accountTypes: ['shop', 'service'] }, { token: T })).status === 400, 'two business types at once refused (architecture = one business per account)')
  ok((await req('PATCH', '/api/auth/onboarding', { interests: ['nonsense'] }, { token: T })).status === 400, 'unknown interest refused')
  let r = await req('PATCH', '/api/auth/onboarding', { accountTypes: ['consumer'], interests: ['shopping', 'education'], step: 'location', coarseLocation: { lat: 23.259933, lng: 77.412615 }, city: 'Bhopal' }, { token: T })
  ok(r.status === 200 && r.data.user.accountTypes[0] === 'consumer' && r.data.user.interests.length === 2 && r.data.user.location.lat === 23.26 && r.data.user.location.lng === 77.41, 'consumer choice + interests saved; location stored coarsely (2 dp ≈ 1 km)')
  ok((await Shop.countDocuments({ userId: dummyUser._id })) === 0 && (await Shop.countDocuments()) === 0, 'choosing Consumer creates no business records')
  r = await req('PATCH', '/api/auth/onboarding', { accountTypes: ['study'] }, { token: T }); ok(r.data.user.accountTypes.includes('study'), 'Study Center preference saved (no business record yet)')
  ok((await Shop.countDocuments()) === 0, 'still no business record until the setup form is submitted')
  r = await req('POST', '/api/seller/start', { sellerType: 'shop', shopName: 'Bright Study Center', category: 'Library', address: 'Bhopal, Madhya Pradesh', description: 'Peaceful study space' }, { token: T })
  ok(r.status === 201 && r.data.user.role === 'seller' && r.data.user.username === '@rajeev236' && r.data.account.category === 'Library', 'Study Center setup reuses the existing shop onboarding (category Library), keeps the account username, fills phone/owner from the verified profile')
  const shop = await Shop.findOne({ userId: created._id }); ok(shop && shop.phone === '9876543210' && shop.ownerName === 'Rajeev Kumar', 'business inherits verified phone & name')
  ok((await req('GET', '/api/seller/products', null, { token: T })).status === 200, 'seller-only APIs now open for this user')
  r = await req('PATCH', '/api/auth/onboarding', { accountTypes: ['consumer'], completed: true }, { token: T })
  ok(r.data.user.accountTypes.includes('study') && r.data.user.onboardingCompleted === true, 'an existing business type cannot be dropped via onboarding; completion flag saved')
}
{
  // Service provider path
  const id = { sub: 'g-666', email: 'plumb@gmail.com', emailVerified: true, name: 'Pappu Plumber' }
  const e = await req('POST', '/api/auth/google/exchange', { ticket: (await googleSignIn(id)).ticket }); const R = e.data.registrationToken
  await req('POST', '/api/auth/register/personal', { ...personal, phone: '9000000001', fullName: 'Pappu Plumber' }, { reg: R }); await req('POST', '/api/auth/register/otp/verify', { code: '1435' }, { reg: R })
  const cc = await req('POST', '/api/auth/register/complete', { username: '@pappu2346', password: 'Zebra-Quartz7', confirmPassword: 'Zebra-Quartz7' }, { reg: R })
  const tk = cc.data.token
  let r = await req('POST', '/api/seller/start', { sellerType: 'service', workType: 'Plumber', priceAmount: 300, description: 'Pipes' }, { token: tk })
  ok(r.status === 201 && r.data.user.sellerType === 'service', 'Service Provider setup works through the same common account (no separate auth system)')
  const sh = await req('POST', '/api/seller/start', { sellerType: 'shop', shopName: 'X', address: 'Y' }, { token: tk }); ok(sh.status === 409, 'a second business on the same account is refused')
}

// ───────────────────────── legacy endpoint gate ─────────────────────────
{
  process.env.NODE_ENV = 'development'
  const r = await req('POST', '/api/auth/register', { name: 'x', email: 'x@x.com', password: 'abcdef' }); ok(r.status === 410, 'legacy one-step /register (no OTP) is closed outside tests')
  process.env.ALLOW_LEGACY_REGISTER = 'true'; const r2 = await req('POST', '/api/auth/register', { name: 'x', email: 'x@x.com', password: 'abcdef' }); ok(r2.status === 201, '…and can be re-enabled explicitly with ALLOW_LEGACY_REGISTER=true')
  delete process.env.ALLOW_LEGACY_REGISTER; process.env.NODE_ENV = 'test'
}

// ───────────────────────── OTP module: production behaviour ─────────────────────────
{
  const saved = { ...process.env }
  // 1) fixed OTP can never be active in production
  process.env.NODE_ENV = 'production'; process.env.OTP_DEV_FIXED = 'true'
  ok(otp.isDevFixedActive() === false && otp.otpMode() === 'production', 'with NODE_ENV=production the fixed OTP is inactive even if OTP_DEV_FIXED=true')
  assert.throws(() => otp.assertOtpConfig(), /not allowed in production/); ok(true, 'server refuses to boot when OTP_DEV_FIXED=true in production')
  process.env.NODE_ENV = 'test'; process.env.RENDER = 'true'
  assert.throws(() => otp.assertOtpConfig(), /not allowed in production/); ok(true, '…and on Render (RENDER=true) even without NODE_ENV')
  delete process.env.RENDER
  // 2) production needs a provider
  process.env.NODE_ENV = 'production'; delete process.env.OTP_DEV_FIXED; delete process.env.OTP_SMS_PROVIDER
  assert.throws(() => otp.assertOtpConfig(), /OTP_SMS_PROVIDER/); ok(true, 'production without an SMS provider fails fast')
  // 3) real random code + fake provider
  const sent = []; otp.__registerProvider('fake', { assertConfigured() {}, async send(to, text) { sent.push({ to, text }) } })
  process.env.OTP_SMS_PROVIDER = 'fake'; otp.assertOtpConfig()
  const r = await otp.requestOtp({ purpose: 'registration', subject: 'prod-1', phone: '+919999900000' })
  const code = (sent[0].text.match(/^(\d{6}) /) || [])[1]
  ok(r.devMode === false && r.length === 6 && !!code && code !== '1435' && !JSON.stringify(r).includes(code), 'production: random 6-digit code is SMS-delivered; the return value never contains it')
  ok((await otp.verifyOtp({ purpose: 'registration', subject: 'prod-1', phone: '+919999900000', code: '1435' })).ok === false, 'production: 1435 is NOT accepted')
  ok((await otp.verifyOtp({ purpose: 'registration', subject: 'prod-1', phone: '+910000000000', code })).ok === false, 'a code is bound to the number it was sent to')
  ok((await otp.verifyOtp({ purpose: 'registration', subject: 'prod-1', phone: '+919999900000', code })).ok === true && await otp.isOtpVerified({ purpose: 'registration', subject: 'prod-1', phone: '+919999900000' }), 'production: the real code verifies')
  const stored = await mongoose.connection.collection('otpchallenges').findOne({ subject: 'prod-1' }); ok(!JSON.stringify(stored).includes(code), 'the code is never stored — only an HMAC')
  // expiry
  process.env.OTP_TTL_SECONDS = '0.05'; sent.length = 0
  await otp.requestOtp({ purpose: 'registration', subject: 'prod-2', phone: '+919999900001' }); await new Promise((r) => setTimeout(r, 120))
  ok((await otp.verifyOtp({ purpose: 'registration', subject: 'prod-2', phone: '+919999900001', code: sent[0].text.slice(0, 6) })).reason === 'expired', 'expired codes are refused')
  // delivery failure leaves nothing behind
  otp.__registerProvider('boom', { assertConfigured() {}, async send() { throw new Error('gateway down') } }); process.env.OTP_SMS_PROVIDER = 'boom'
  await assert.rejects(otp.requestOtp({ purpose: 'registration', subject: 'prod-3', phone: '+919999900002' }), /could not send/); ok(true, 'SMS delivery failure surfaces a clean error')
  // not configured and not dev → refuses (no silent fallback)
  process.env.NODE_ENV = 'test'; delete process.env.OTP_SMS_PROVIDER; delete process.env.OTP_DEV_FIXED
  await assert.rejects(otp.requestOtp({ purpose: 'registration', subject: 'x', phone: '+919999900003' }), /not configured/); ok(true, 'with neither dev mode nor a provider, OTP requests fail instead of silently using a fixed code')
  Object.keys(process.env).forEach((k) => { if (!(k in saved)) delete process.env[k] }); Object.assign(process.env, saved)
}

console.log('\nALL AUTH INTEGRATION CHECKS PASSED')
server.close(); await mongoose.disconnect(); process.exit(0)
