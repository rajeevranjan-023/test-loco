// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//  OTP MODULE — the ONLY place in the backend that knows how a verification code is made, sent, stored or checked.
//
//  The registration flow talks to it through four calls and nothing else:
//      requestOtp({ purpose, subject, phone })   → create + send a code (also used for "resend")
//      verifyOtp({ purpose, subject, phone, code })
//      isOtpVerified({ purpose, subject, phone }) → server-side proof that this subject verified this phone
//      cancelOtp({ purpose, subject })
//  To change the mechanism later (new SMS vendor, WhatsApp, voice…) edit THIS file only: add a provider below or change
//  `generateCode`. Controllers, routes and the frontend never see a code, a provider name, or the dev value.
//
//  MODES
//    production      real random code (OTP_LENGTH digits, default 6) sent through OTP_SMS_PROVIDER.
//    dev-fixed       a fixed development code, so the flow can be tested without an SMS account.
//                    Needs OTP_DEV_FIXED=true. It is REFUSED — the server will not start — when NODE_ENV=production
//                    (or RENDER=true / VERCEL=1), so it can never be switched on by accident in a live deployment.
//    (neither)       requestOtp fails with a clear configuration error instead of silently doing something unsafe.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto'
import OtpChallenge from '../models/OtpChallenge.js'
import { isProduction, safeEqual } from './authHelpers.js'

// The development-only code. Intentionally defined here and nowhere else in the project.
const DEV_FIXED_CODE = '1435'

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d }
export const otpConfig = () => ({
  ttlSeconds: num(process.env.OTP_TTL_SECONDS, 300),
  length: num(process.env.OTP_LENGTH, 6),
  maxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),
  resendCooldownSeconds: num(process.env.OTP_RESEND_COOLDOWN_SECONDS, 30),
  maxSendsPerHour: num(process.env.OTP_MAX_SENDS_PER_HOUR, 5),
  provider: (process.env.OTP_SMS_PROVIDER || '').toLowerCase(),
})

export const isDevFixedRequested = () => String(process.env.OTP_DEV_FIXED || '').toLowerCase() === 'true'
export const isDevFixedActive = () => isDevFixedRequested() && !isProduction()
export const otpMode = () => (isDevFixedActive() ? 'dev-fixed' : 'production')

export class OtpError extends Error {
  constructor(code, message, extra = {}) { super(message); this.name = 'OtpError'; this.code = code; Object.assign(this, extra) }
}

// Call once at server start. Throws (→ process exits) if the configuration is unsafe or unusable.
export function assertOtpConfig() {
  if (isDevFixedRequested() && isProduction()) {
    throw new Error('OTP_DEV_FIXED=true is not allowed in production. Remove it and configure OTP_SMS_PROVIDER.')
  }
  if (isProduction() && !SMS_PROVIDERS[otpConfig().provider]) {
    throw new Error(`Production needs a working OTP_SMS_PROVIDER (one of: ${Object.keys(SMS_PROVIDERS).join(', ')}).`)
  }
  if (isProduction()) SMS_PROVIDERS[otpConfig().provider].assertConfigured()
}

// ── SMS providers ─────────────────────────────────────────────────────────────────────────────────────────────────
// A provider is { assertConfigured(), send(toE164, text) }. Add another vendor by adding an entry here.
const SMS_PROVIDERS = {
  twilio: {
    assertConfigured() {
      for (const k of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']) if (!process.env[k]) throw new Error(`${k} is required for OTP_SMS_PROVIDER=twilio`)
      if (!process.env.TWILIO_FROM && !process.env.TWILIO_MESSAGING_SERVICE_SID) throw new Error('TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID is required for OTP_SMS_PROVIDER=twilio')
    },
    async send(to, text) {
      this.assertConfigured()
      const sid = process.env.TWILIO_ACCOUNT_SID
      const body = new URLSearchParams({ To: to, Body: text })
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) body.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID)
      else body.set('From', process.env.TWILIO_FROM)
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) throw new Error(`Twilio responded ${res.status}`) // never include the message body (it holds the code)
    },
  },
}
// Test hook: lets a test plug in a fake provider without network access.
export const __registerProvider = (name, impl) => { SMS_PROVIDERS[name] = impl }

// ── code generation / hashing ─────────────────────────────────────────────────────────────────────────────────────
function generateCode() {
  if (isDevFixedActive()) return DEV_FIXED_CODE
  const len = otpConfig().length
  return crypto.randomInt(0, 10 ** len).toString().padStart(len, '0') // CSPRNG, uniform
}
const hashCode = (purpose, subject, phone, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev-only').update(`${purpose}|${subject}|${phone}|${code}`).digest('hex')

// How many digits the UI should render. Dev-fixed is 4 digits, real codes follow OTP_LENGTH — the frontend just asks.
export const codeLength = () => (isDevFixedActive() ? DEV_FIXED_CODE.length : otpConfig().length)

// ── public interface ──────────────────────────────────────────────────────────────────────────────────────────────
export async function requestOtp({ purpose, subject, phone }) {
  if (!purpose || !subject || !phone) throw new OtpError('BAD_REQUEST', 'purpose, subject and phone are required.')
  const cfg = otpConfig()
  const devFixed = isDevFixedActive()
  if (!devFixed && !SMS_PROVIDERS[cfg.provider]) {
    throw new OtpError('NOT_CONFIGURED', 'OTP delivery is not configured on the server. Set OTP_DEV_FIXED=true for local development or configure OTP_SMS_PROVIDER.')
  }

  const now = new Date()
  const existing = await OtpChallenge.findOne({ purpose, subject })
  let sendCount = 1; let sendWindowStart = now
  if (existing) {
    const since = (now - existing.lastSentAt) / 1000
    if (since < cfg.resendCooldownSeconds) {
      throw new OtpError('COOLDOWN', `Please wait ${Math.ceil(cfg.resendCooldownSeconds - since)}s before requesting another code.`, { retryAfter: Math.ceil(cfg.resendCooldownSeconds - since) })
    }
    const inWindow = now - existing.sendWindowStart < 3600 * 1000
    sendCount = inWindow ? existing.sendCount + 1 : 1
    sendWindowStart = inWindow ? existing.sendWindowStart : now
    if (sendCount > cfg.maxSendsPerHour) throw new OtpError('TOO_MANY_SENDS', 'Too many codes requested. Please try again later.', { retryAfter: 3600 })
  }

  const code = generateCode()
  const expiresAt = new Date(now.getTime() + cfg.ttlSeconds * 1000)
  await OtpChallenge.findOneAndUpdate(
    { purpose, subject },
    { $set: { phone, codeHash: hashCode(purpose, subject, phone, code), attempts: 0, maxAttempts: cfg.maxAttempts, sendCount, sendWindowStart, lastSentAt: now, verifiedAt: null, expiresAt } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  if (!devFixed) {
    try { await SMS_PROVIDERS[cfg.provider].send(phone, `${code} is your Loco verification code. It expires in ${Math.round(cfg.ttlSeconds / 60)} minutes. Do not share it.`) }
    catch (err) {
      await OtpChallenge.deleteOne({ purpose, subject })
      console.error('[otp] SMS delivery failed:', err.message) // message only — never the code or the number
      throw new OtpError('DELIVERY_FAILED', 'We could not send the verification code. Please try again.')
    }
  }
  return { expiresAt, resendAvailableAt: new Date(now.getTime() + cfg.resendCooldownSeconds * 1000), length: codeLength(), devMode: devFixed }
}

// → { ok: true } | { ok: false, reason: 'not_found' | 'expired' | 'locked' | 'invalid', attemptsLeft? }
export async function verifyOtp({ purpose, subject, phone, code }) {
  const now = new Date()
  const ch = await OtpChallenge.findOne({ purpose, subject })
  if (!ch || ch.phone !== phone) return { ok: false, reason: 'not_found' }
  if (ch.verifiedAt) return { ok: true }
  if (ch.expiresAt <= now) return { ok: false, reason: 'expired' }

  // Atomically count the attempt BEFORE comparing, so parallel guesses cannot exceed the limit.
  const counted = await OtpChallenge.findOneAndUpdate(
    { _id: ch._id, verifiedAt: null, attempts: { $lt: ch.maxAttempts } },
    { $inc: { attempts: 1 } },
    { new: true }
  )
  if (!counted) return { ok: false, reason: 'locked' }

  const supplied = hashCode(purpose, subject, phone, String(code ?? '').trim())
  if (!safeEqual(supplied, counted.codeHash)) {
    const left = Math.max(0, counted.maxAttempts - counted.attempts)
    return { ok: false, reason: left === 0 ? 'locked' : 'invalid', attemptsLeft: left }
  }
  await OtpChallenge.updateOne({ _id: ch._id, verifiedAt: null }, { $set: { verifiedAt: now } })
  return { ok: true }
}

// The registration controller calls this right before it creates an account — a frontend "verified" flag is never consulted.
export async function isOtpVerified({ purpose, subject, phone, maxAgeMinutes = 30 }) {
  const ch = await OtpChallenge.findOne({ purpose, subject })
  if (!ch || !ch.verifiedAt || ch.phone !== phone) return false
  return Date.now() - ch.verifiedAt.getTime() <= maxAgeMinutes * 60 * 1000
}

export async function cancelOtp({ purpose, subject }) { await OtpChallenge.deleteOne({ purpose, subject }) }

export const OTP_FAILURE_MESSAGES = {
  not_found: 'No verification code is active. Request a new one.',
  expired: 'That code has expired. Request a new one.',
  locked: 'Too many incorrect attempts. Request a new code.',
  invalid: 'That code is not correct.',
}
