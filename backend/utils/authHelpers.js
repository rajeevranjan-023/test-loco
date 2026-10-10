import crypto from 'crypto'

// ── tokens ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')
export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')
export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// ── redirects ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Only same-site, absolute-path destinations are ever honoured ("/shop/x?y=1"). Anything else collapses to "/".
// Rejected: other origins, protocol-relative "//evil.com", "/\evil.com", "javascript:", control characters, very long values.
export function safeNext(raw, fallback = '/') {
  if (typeof raw !== 'string') return fallback
  const v = raw.trim()
  if (!v || v.length > 500) return fallback
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(v)) return fallback
  try {
    const u = new URL(v, 'http://loco.invalid')
    if (u.origin !== 'http://loco.invalid') return fallback
  } catch { return fallback }
  return v
}

// ── phone (India, +91) ────────────────────────────────────────────────────────────────────────────────────────────
// Accepts "9876543210", "+91 98765 43210", "09876543210", "919876543210" and returns { national, e164 } — or null.
export function normalizeIndianMobile(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  let d = String(raw).replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) { if (!d.startsWith('+91')) return null; d = d.slice(3) }
  else if (d.startsWith('0091')) d = d.slice(4)
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (!/^[6-9]\d{9}$/.test(d)) return null
  return { national: d, e164: `+91${d}` }
}
export const maskPhone = (e164) => (e164 ? `${e164.slice(0, 3)} ${'•'.repeat(5)} ${e164.slice(-3)}` : '')
export const maskEmail = (email) => {
  const [u, d] = String(email || '').split('@'); if (!d) return ''
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`
}

// ── password policy for NEW passwords ─────────────────────────────────────────────────────────────────────────────
// (The legacy schema only demanded 6+ characters; accounts that already exist are untouched.)
const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'iloveyou1', 'admin123', 'welcome1', 'abc12345', 'letmein123', 'loco12345'])
export function validatePassword(pw, { username = '', email = '' } = {}) {
  if (typeof pw !== 'string' || !pw) return 'Password is required.'
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (pw.length > 72) return 'Password can be at most 72 characters.'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use both letters and numbers.'
  const lower = pw.toLowerCase()
  if (COMMON.has(lower)) return 'That password is too common. Choose something harder to guess.'
  const bareUser = String(username).replace(/^@/, '').toLowerCase()
  if (bareUser.length >= 5 && lower.includes(bareUser)) return 'Your password should not contain your username.'
  const local = String(email).split('@')[0].toLowerCase()
  if (local.length >= 5 && lower.includes(local)) return 'Your password should not contain your email name.'
  return ''
}

// ── misc validation ───────────────────────────────────────────────────────────────────────────────────────────────
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const GENDERS = ['male', 'female', 'other']
export const ACCOUNT_TYPES = ['consumer', 'shop', 'service', 'study']
export const INTERESTS = ['shopping', 'services', 'study-centers', 'food-beverages', 'home-services', 'education', 'health-wellness', 'electronics', 'fashion', 'daily-needs', 'automotive', 'other']

export function parseDob(raw) {
  if (!raw) return { error: 'Date of birth is required.' }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return { error: 'Enter a valid date of birth.' }
  const now = new Date()
  if (d > now) return { error: 'Date of birth cannot be in the future.' }
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  if (age < 13) return { error: 'You must be at least 13 years old to use Loco.' }
  if (age > 120) return { error: 'Enter a valid date of birth.' }
  return { date: d }
}

export const isProduction = () => process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || process.env.VERCEL === '1'
export const clientOrigin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '')
