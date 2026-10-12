import User from '../models/User.js'
import RegistrationSession from '../models/RegistrationSession.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { generateToken } from '../utils/generateToken.js'
import { assertUsernameAvailable, normalizeUsername } from '../utils/username.js'
import {
  EMAIL_RE, GENDERS, maskPhone, normalizeIndianMobile, parseDob, randomToken, sha256, validatePassword,
} from '../utils/authHelpers.js'
import { requestOtp, verifyOtp, isOtpVerified, cancelOtp, codeLength, isDevFixedActive, otpConfig, OtpError, OTP_FAILURE_MESSAGES } from '../utils/otp.js'
import { isCloudinaryConfigured } from '../config/cloudinary.js'
import { streamUpload } from './mediaController.js'
import { logger } from '../utils/logger.js'

const PURPOSE = 'registration'
const REG_TTL_MS = 24 * 3600 * 1000
const AVATAR_HOSTS = ['res.cloudinary.com', 'lh3.googleusercontent.com']

// ── guard: loads the registration session from the opaque header token ────────────────────────────────────────────────
export const requireRegistration = asyncHandler(async (req, res, next) => {
  const token = req.headers['x-registration-token']
  if (!token) return res.status(401).json({ message: 'Your signup session has expired. Please start again.', code: 'REG_EXPIRED' })
  const session = await RegistrationSession.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } })
  if (!session) return res.status(401).json({ message: 'Your signup session has expired. Please start again.', code: 'REG_EXPIRED' })
  req.reg = session
  next()
})

const view = (s) => ({
  kind: s.kind,
  email: s.email,
  emailVerified: s.emailVerified,
  step: s.userId ? 'done' : s.step,
  profile: {
    fullName: s.profile?.fullName || '', phone: s.profile?.phone || '',
    dob: s.profile?.dob ? s.profile.dob.toISOString().slice(0, 10) : '',
    gender: s.profile?.gender || '', city: s.profile?.city || '', state: s.profile?.state || '',
    country: s.profile?.country || 'India', avatarUrl: s.profile?.avatarUrl || s.picture || '',
  },
  phoneMasked: maskPhone(s.profile?.phoneE164),
  otp: { length: codeLength(), devMode: isDevFixedActive(), ttlSeconds: otpConfig().ttlSeconds },
  next: s.next,
})

const sendOtpError = (res, err) => {
  if (!(err instanceof OtpError)) throw err
  const status = err.code === 'COOLDOWN' || err.code === 'TOO_MANY_SENDS' ? 429 : err.code === 'NOT_CONFIGURED' ? 503 : err.code === 'DELIVERY_FAILED' ? 502 : 400
  return res.status(status).json({ message: err.message, code: err.code, retryAfter: err.retryAfter })
}

// POST /api/auth/register/email/start { email } — "Sign up with Email" (no Google)
export const startEmailRegistration = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
  if (await User.findOne({ email }).select('_id')) return res.status(409).json({ message: 'An account with this email already exists. Please log in.', code: 'EMAIL_EXISTS' })
  const token = randomToken(32)
  // A fresh session each time — an email-only session is never resumable by someone who merely knows the address.
  await RegistrationSession.create({ tokenHash: sha256(token), kind: 'email', email, emailVerified: false, profile: { country: 'India' }, next: '/', expiresAt: new Date(Date.now() + REG_TTL_MS) })
  res.status(201).json({ registrationToken: token })
})

// GET /api/auth/register/session
export const getRegistrationSession = asyncHandler(async (req, res) => res.json(view(req.reg)))

// POST /api/auth/register/personal
export const submitPersonalInfo = asyncHandler(async (req, res) => {
  const s = req.reg
  if (s.userId) return res.status(409).json({ message: 'This registration is already complete.' })
  const b = req.body || {}
  const errors = {}

  const fullName = String(b.fullName || '').trim().replace(/\s+/g, ' ')
  if (fullName.length < 2) errors.fullName = 'Enter your full name.'
  else if (fullName.length > 80) errors.fullName = 'Name is too long.'

  const phone = normalizeIndianMobile(b.phone)
  if (!phone) errors.phone = 'Enter a valid 10-digit Indian mobile number.'

  const dob = parseDob(b.dob)
  if (dob.error) errors.dob = dob.error

  const gender = String(b.gender || '').toLowerCase()
  if (gender && !GENDERS.includes(gender)) errors.gender = 'Choose a valid option.'

  const city = String(b.city || '').trim(); const state = String(b.state || '').trim(); const country = String(b.country || '').trim()
  if (!city || city.length > 80) errors.city = 'Select your city.'
  if (!state || state.length > 80) errors.state = 'Select your state.'
  if (country !== 'India') errors.country = 'Loco is currently available in India only.'

  let avatarUrl = s.profile?.avatarUrl || s.picture || ''
  if (b.avatarUrl !== undefined) {
    avatarUrl = ''
    if (b.avatarUrl) {
      try { const u = new URL(String(b.avatarUrl)); if (u.protocol === 'https:' && AVATAR_HOSTS.includes(u.hostname) && String(b.avatarUrl).length < 600) avatarUrl = u.toString() }
      catch { /* ignored → no avatar */ }
      if (!avatarUrl) errors.avatarUrl = 'That profile picture is not allowed.'
    }
  }
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please fix the highlighted fields.', errors })

  // Identity policy: one account per verified mobile number.
  if (await User.findOne({ phoneE164: phone.e164 }).select('_id')) {
    return res.status(409).json({ message: 'This mobile number is already registered. Please log in instead.', errors: { phone: 'Already registered.' }, code: 'PHONE_EXISTS' })
  }

  const phoneChanged = s.profile?.phoneE164 !== phone.e164
  s.profile = { fullName, phone: phone.national, phoneE164: phone.e164, dob: dob.date, gender, city, state, country, avatarUrl }
  if (phoneChanged) await cancelOtp({ purpose: PURPOSE, subject: String(s._id) })

  // Same number already verified in this session → no need to ask again.
  if (!phoneChanged && (await isOtpVerified({ purpose: PURPOSE, subject: String(s._id), phone: phone.e164 }))) {
    s.step = 'credentials'; await s.save()
    return res.json({ ...view(s) })
  }
  try {
    const sent = await requestOtp({ purpose: PURPOSE, subject: String(s._id), phone: phone.e164 })
    s.step = 'otp'; await s.save()
    res.json({ ...view(s), otp: { length: sent.length, devMode: sent.devMode, expiresAt: sent.expiresAt, resendAvailableAt: sent.resendAvailableAt, ttlSeconds: otpConfig().ttlSeconds } })
  } catch (err) { await s.save(); return sendOtpError(res, err) }
})

// POST /api/auth/register/otp/resend
export const resendOtp = asyncHandler(async (req, res) => {
  const s = req.reg
  if (!s.profile?.phoneE164 || s.step === 'personal') return res.status(400).json({ message: 'Enter your personal details first.' })
  try {
    const sent = await requestOtp({ purpose: PURPOSE, subject: String(s._id), phone: s.profile.phoneE164 })
    s.step = 'otp'; await s.save()
    res.json({ otp: { length: sent.length, devMode: sent.devMode, expiresAt: sent.expiresAt, resendAvailableAt: sent.resendAvailableAt } })
  } catch (err) { return sendOtpError(res, err) }
})

// POST /api/auth/register/otp/verify { code }
export const verifyRegistrationOtp = asyncHandler(async (req, res) => {
  const s = req.reg
  if (!s.profile?.phoneE164) return res.status(400).json({ message: 'Enter your mobile number first.' })
  const code = String(req.body.code ?? '').trim()
  if (!/^\d{3,10}$/.test(code)) return res.status(400).json({ message: 'Enter the verification code.' })
  const r = await verifyOtp({ purpose: PURPOSE, subject: String(s._id), phone: s.profile.phoneE164, code })
  if (!r.ok) return res.status(r.reason === 'locked' ? 429 : 400).json({ message: OTP_FAILURE_MESSAGES[r.reason], reason: r.reason, attemptsLeft: r.attemptsLeft })
  s.step = 'credentials'; await s.save()
  res.json(view(s))
})

// POST /api/auth/register/otp/change-phone → back to the personal-information step
export const changePhone = asyncHandler(async (req, res) => {
  const s = req.reg
  await cancelOtp({ purpose: PURPOSE, subject: String(s._id) })
  s.step = 'personal'; await s.save()
  res.json(view(s))
})

// GET /api/auth/register/check-username?username=
export const checkRegistrationUsername = asyncHandler(async (req, res) => {
  const r = await assertUsernameAvailable(req.query.username)
  res.json({ available: r.ok, message: r.ok ? null : r.error })
})

// POST /api/auth/register/avatar (multipart "file") — optional profile picture before the account exists
export const uploadRegistrationAvatar = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) return res.status(503).json({ message: 'Photo uploads are not configured yet. You can add a photo later.' })
  if (!req.file || !req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: 'Choose an image file.' })
  if (req.file.size > 5 * 1024 * 1024) return res.status(400).json({ message: 'Image must be 5 MB or smaller.' })
  try {
    const r = await streamUpload(req.file.buffer, { folder: 'servop/avatars', resource_type: 'image', transformation: [{ width: 600, height: 600, crop: 'limit', quality: 'auto:good' }] })
    res.status(201).json({ url: r.secure_url })
  } catch (err) { logger.error('register', `avatar upload failed: ${err.message}`); res.status(502).json({ message: 'Upload failed. You can add a photo later.' }) }
})

// POST /api/auth/register/complete { username, password, confirmPassword }
// Creates the account. Every "verified" fact is re-checked here on the server. Safe to call twice (idempotent).
export const completeRegistration = asyncHandler(async (req, res) => {
  let s = req.reg

  // Replay (double click / retry after a dropped response): hand back the same account instead of making another.
  if (s.userId) {
    const existing = await User.findById(s.userId)
    if (existing) return res.json({ token: generateToken(existing._id), user: existing.toSafeObject(), next: s.next, replay: true })
  }
  if (s.step !== 'credentials' && s.step !== 'otp') return res.status(400).json({ message: 'Complete the earlier steps first.' })
  if (!s.profile?.phoneE164 || !(await isOtpVerified({ purpose: PURPOSE, subject: String(s._id), phone: s.profile.phoneE164 }))) {
    return res.status(403).json({ message: 'Please verify your mobile number first.', code: 'OTP_REQUIRED' })
  }

  const { username, password, confirmPassword } = req.body || {}
  const errors = {}
  const uname = await assertUsernameAvailable(username)
  if (!uname.ok) errors.username = uname.error
  const pwErr = validatePassword(password, { username, email: s.email })
  if (pwErr) errors.password = pwErr
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please fix the highlighted fields.', errors })

  // Re-check identity uniqueness right before writing (the unique indexes below are the final backstop).
  if (await User.findOne({ email: s.email }).select('_id')) return res.status(409).json({ message: 'An account with this email already exists. Please log in.', code: 'EMAIL_EXISTS' })
  if (await User.findOne({ phoneE164: s.profile.phoneE164 }).select('_id')) return res.status(409).json({ message: 'This mobile number is already registered. Please log in instead.', code: 'PHONE_EXISTS' })

  // Only one in-flight completion per session.
  const claimed = await RegistrationSession.findOneAndUpdate({ _id: s._id, userId: null, completing: false }, { $set: { completing: true } }, { new: true })
  if (!claimed) {
    const fresh = await RegistrationSession.findById(s._id)
    if (fresh?.userId) { const u = await User.findById(fresh.userId); return res.json({ token: generateToken(u._id), user: u.toSafeObject(), next: fresh.next, replay: true }) }
    return res.status(409).json({ message: 'Your account is already being created. Please wait a moment.' })
  }
  s = claimed

  try {
    const p = s.profile
    const user = await User.create({
      name: p.fullName, email: s.email, emailVerified: !!s.emailVerified,
      googleId: s.googleId || undefined,
      username: uname.username, password,
      phone: p.phone, phoneE164: p.phoneE164, phoneVerified: true,
      dob: p.dob, gender: p.gender || '', address: { city: p.city, state: p.state, country: p.country },
      avatarUrl: p.avatarUrl || '',
      role: 'consumer', accountTypes: ['consumer'], onboarding: { completed: false, step: 'account-type' },
    })
    await RegistrationSession.updateOne({ _id: s._id }, { $set: { userId: user._id, step: 'done', completing: false, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } })
    await cancelOtp({ purpose: PURPOSE, subject: String(s._id) })
    res.status(201).json({ token: generateToken(user._id), user: user.toSafeObject(), next: s.next })
  } catch (err) {
    await RegistrationSession.updateOne({ _id: s._id }, { $set: { completing: false } })
    if (err.code === 11000) {
      const k = Object.keys(err.keyPattern || err.keyValue || {})[0]
      const map = { username: 'That username is already taken.', email: 'An account with this email already exists. Please log in.', phoneE164: 'This mobile number is already registered. Please log in instead.', googleId: 'This Google account is already registered. Please log in.' }
      return res.status(409).json({ message: map[k] || 'An account with these details already exists.', ...(k === 'username' ? { errors: { username: map.username } } : {}) })
    }
    throw err
  }
})
