import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import AuthTicket from '../models/AuthTicket.js'
import RegistrationSession from '../models/RegistrationSession.js'
import { googleOAuth } from '../utils/googleOAuth.js'
import { generateToken } from '../utils/generateToken.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { clientOrigin, isProduction, maskEmail, randomToken, safeEqual, safeNext, sha256 } from '../utils/authHelpers.js'

const COOKIE = 'lf_oauth_csrf'
const REG_TTL_MS = 24 * 3600 * 1000
const TICKET_TTL_MS = 5 * 60 * 1000

const readCookie = (req, name) => {
  const m = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`))
  return m ? decodeURIComponent(m.slice(name.length + 1)) : ''
}
const failTo = (res, code, next) => res.redirect(`${clientOrigin()}/login?error=${encodeURIComponent(code)}${next ? `&next=${encodeURIComponent(next)}` : ''}`)

// GET /api/auth/google/start?next=/shop/x
// A top-level browser navigation. Sets a CSRF cookie, signs the state, sends the user to Google's consent/account chooser.
export const googleStart = (req, res) => {
  const next = safeNext(req.query.next)
  if (!googleOAuth.isConfigured()) return failTo(res, 'google_not_configured', next)
  const csrf = randomToken(16)
  const nonce = randomToken(16)
  const state = jwt.sign({ c: csrf, n: nonce, next }, process.env.JWT_SECRET, { expiresIn: '10m' })
  res.cookie(COOKIE, csrf, { httpOnly: true, sameSite: 'lax', secure: isProduction(), maxAge: 10 * 60 * 1000, path: '/api/auth/google' })
  res.redirect(googleOAuth.buildAuthUrl({ state, nonce }))
}

// GET /api/auth/google/callback?code=…&state=…   (Google redirects the browser here)
export const googleCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query
  let payload
  try { payload = jwt.verify(String(state || ''), process.env.JWT_SECRET) } catch { return failTo(res, 'invalid_state') }
  res.clearCookie(COOKIE, { path: '/api/auth/google' })
  const cookie = readCookie(req, COOKIE)
  if (!cookie || !safeEqual(cookie, payload.c)) return failTo(res, 'invalid_state', payload.next)   // login-CSRF guard
  if (error) return failTo(res, error === 'access_denied' ? 'google_cancelled' : 'google_failed', payload.next)
  if (!code) return failTo(res, 'google_failed', payload.next)

  let g
  try { g = await googleOAuth.exchangeCode(String(code), payload.n) }
  catch (err) { console.error('[google] token verification failed:', err.message); return failTo(res, 'google_failed', payload.next) }
  if (!g.sub || !g.email) return failTo(res, 'google_failed', payload.next)
  if (!g.emailVerified) return failTo(res, 'google_email_unverified', payload.next)

  const next = safeNext(payload.next)
  const google = { sub: g.sub, email: g.email, name: g.name, picture: g.picture }
  let kind = 'register'; let userId = null

  const byGoogle = await User.findOne({ googleId: g.sub })
  if (byGoogle) { kind = 'login'; userId = byGoogle._id }
  else {
    const byEmail = await User.findOne({ email: g.email })
    if (byEmail) {
      if (byEmail.googleId) return failTo(res, 'email_linked_to_other_google', next)   // same email, different Google identity: refuse
      kind = 'link'; userId = byEmail._id                                               // needs proof of ownership (password) — never auto-merged
    }
  }

  const ticket = randomToken(32)
  await AuthTicket.create({ tokenHash: sha256(ticket), kind, userId, google, next, expiresAt: new Date(Date.now() + TICKET_TTL_MS) })
  res.redirect(`${clientOrigin()}/auth/callback?ticket=${encodeURIComponent(ticket)}`)
})

// POST /api/auth/google/exchange { ticket }
// login    → single-use; returns the session token.
// register → single-use; creates (or resumes) the server-side registration session and returns its token.
// link     → NOT consumed; the SPA must prove ownership of the existing account via /google/link.
export const googleExchange = asyncHandler(async (req, res) => {
  const raw = String(req.body.ticket || '')
  if (!raw) return res.status(400).json({ message: 'Missing ticket.' })
  const hash = sha256(raw)
  const t = await AuthTicket.findOne({ tokenHash: hash, usedAt: null, expiresAt: { $gt: new Date() } })
  if (!t) return res.status(400).json({ message: 'This sign-in link has expired. Please try again.' })

  if (t.kind === 'link') {
    return res.json({ status: 'link_required', maskedEmail: maskEmail(t.google.email), email: t.google.email, next: t.next })
  }

  // Atomic claim → a ticket can never be redeemed twice.
  const claimed = await AuthTicket.findOneAndUpdate({ _id: t._id, usedAt: null }, { $set: { usedAt: new Date() } })
  if (!claimed) return res.status(400).json({ message: 'This sign-in link has already been used.' })

  if (t.kind === 'login') {
    const user = await User.findById(t.userId)
    if (!user) return res.status(400).json({ message: 'Account not found.' })
    return res.json({ status: 'authenticated', token: generateToken(user._id), user: user.toSafeObject(), next: t.next })
  }

  // register — resume an unfinished session for this Google identity if one exists, otherwise start one.
  const token = randomToken(32)
  let session = await RegistrationSession.findOne({ googleId: t.google.sub, userId: null, expiresAt: { $gt: new Date() } })
  if (session) {
    session.tokenHash = sha256(token); session.next = t.next; session.expiresAt = new Date(Date.now() + REG_TTL_MS)
    await session.save()
  } else {
    session = await RegistrationSession.create({
      tokenHash: sha256(token), kind: 'google', googleId: t.google.sub, email: t.google.email, emailVerified: true,
      picture: t.google.picture || '', profile: { fullName: t.google.name || '', avatarUrl: t.google.picture || '' },
      next: t.next, expiresAt: new Date(Date.now() + REG_TTL_MS),
    })
  }
  res.json({ status: 'register', registrationToken: token, next: t.next })
})

// POST /api/auth/google/link { ticket, password }
// The Google email matches an existing password account. Verified Google ownership of the email is NOT enough to merge —
// the person must also know that account's password. Wrong guesses are capped per ticket.
export const googleLink = asyncHandler(async (req, res) => {
  const { ticket, password } = req.body
  if (!ticket || !password) return res.status(400).json({ message: 'Enter your Loco password to link Google.' })
  const t = await AuthTicket.findOne({ tokenHash: sha256(String(ticket)), kind: 'link', usedAt: null, expiresAt: { $gt: new Date() } })
  if (!t) return res.status(400).json({ message: 'This sign-in link has expired. Please start again.' })
  if (t.attempts >= 5) return res.status(429).json({ message: 'Too many incorrect attempts. Please start again.' })

  const user = await User.findById(t.userId).select('+password')
  const ok = user && (await user.comparePassword(String(password)))
  if (!ok) {
    await AuthTicket.updateOne({ _id: t._id }, { $inc: { attempts: 1 } })
    return res.status(401).json({ message: 'That password is not correct.' })
  }
  const claimed = await AuthTicket.findOneAndUpdate({ _id: t._id, usedAt: null }, { $set: { usedAt: new Date() } })
  if (!claimed) return res.status(400).json({ message: 'This sign-in link has already been used.' })

  try {
    user.googleId = t.google.sub
    user.emailVerified = true
    if (!user.avatarUrl && t.google.picture) user.avatarUrl = t.google.picture
    await user.save()
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'This Google account is already linked to another Loco account.' })
    throw err
  }
  const safe = await User.findById(user._id)
  res.json({ status: 'authenticated', token: generateToken(user._id), user: safe.toSafeObject(), next: t.next })
})
