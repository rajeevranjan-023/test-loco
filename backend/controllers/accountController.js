import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ACCOUNT_TYPES, INTERESTS, EMAIL_RE, clientOrigin, randomToken, sha256, validatePassword } from '../utils/authHelpers.js'
import { normalizeUsername } from '../utils/username.js'
import { sendMail } from '../utils/mailer.js'
import { logger } from '../utils/logger.js'

const BUSINESS_TYPES = ['shop', 'service', 'study']
const STEPS = ['account-type', 'business', 'interests', 'location', 'done']
const round2 = (n) => Math.round(n * 100) / 100  // ≈1.1 km — enough for "nearby", deliberately not a precise position

// PATCH /api/auth/onboarding  (protected) — post-signup preferences. Never creates a business record by itself.
export const updateOnboarding = asyncHandler(async (req, res) => {
  const u = req.user
  const { accountTypes, interests, step, completed, city, state, coarseLocation } = req.body || {}

  if (accountTypes !== undefined) {
    if (!Array.isArray(accountTypes) || accountTypes.some((t) => !ACCOUNT_TYPES.includes(t))) return res.status(400).json({ message: 'Unknown account type.' })
    let types = [...new Set(accountTypes)]
    const biz = types.filter((t) => BUSINESS_TYPES.includes(t))
    if (biz.length > 1) return res.status(400).json({ message: 'An account can run one business for now. Choose one business type.' })
    if (u.role === 'seller') {                                   // an existing business can't be un-chosen from here
      const current = (u.accountTypes || []).filter((t) => BUSINESS_TYPES.includes(t))
      const kept = current.length ? current : [u.sellerType === 'service' ? 'service' : 'shop']
      types = [...new Set([...types.filter((t) => !BUSINESS_TYPES.includes(t)), ...kept])]
    }
    if (!types.length) types = ['consumer']
    if (!types.includes('consumer') && !types.some((t) => BUSINESS_TYPES.includes(t))) types.push('consumer')
    u.accountTypes = types
  }
  if (interests !== undefined) {
    if (!Array.isArray(interests) || interests.some((i) => !INTERESTS.includes(i))) return res.status(400).json({ message: 'Unknown interest.' })
    u.interests = [...new Set(interests)]
  }
  if (city !== undefined || state !== undefined) {
    if (city !== undefined) u.address.city = String(city).trim().slice(0, 80)
    if (state !== undefined) u.address.state = String(state).trim().slice(0, 80)
  }
  if (coarseLocation !== undefined && coarseLocation !== null) {
    const { lat, lng } = coarseLocation
    if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ message: 'Invalid location.' })
    u.location = { lat: round2(lat), lng: round2(lng), updatedAt: new Date() }
  }
  if (step !== undefined) {
    if (!STEPS.includes(step)) return res.status(400).json({ message: 'Unknown onboarding step.' })
    u.onboarding = { ...(u.onboarding?.toObject?.() || u.onboarding || {}), step }
  }
  if (completed !== undefined) u.onboarding = { ...(u.onboarding?.toObject?.() || u.onboarding || {}), completed: !!completed }
  await u.save()
  res.json({ user: u.toSafeObject() })
})

// POST /api/auth/forgot-password { identifier }  — always answers the same way, so it can't be used to discover accounts.
export const forgotPassword = asyncHandler(async (req, res) => {
  const idf = String(req.body.identifier ?? req.body.email ?? '').trim()
  const generic = { message: 'If an account exists for that email or username, a reset link has been sent.' }
  if (!idf) return res.status(400).json({ message: 'Enter your email or username.' })
  const user = await User.findOne(EMAIL_RE.test(idf) ? { email: idf.toLowerCase() } : { username: normalizeUsername(idf) })
  if (user) {
    const token = randomToken(32)
    user.passwordResetHash = sha256(token)
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000)
    await user.save()
    const link = `${clientOrigin()}/reset-password?token=${encodeURIComponent(token)}`
    try { await sendMail({ to: user.email, subject: 'Reset your Loco password', text: `Hi ${user.name.split(' ')[0]},\n\nUse this link to choose a new password (valid for 30 minutes):\n${link}\n\nIf you did not ask for this, you can ignore this email.` }) }
    catch (err) { logger.error('forgot-password', `mail failed: ${err.message}`) }
  }
  res.json(generic)
})

// POST /api/auth/reset-password { token, password, confirmPassword }
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, confirmPassword } = req.body || {}
  if (!token) return res.status(400).json({ message: 'This reset link is invalid or has expired.' })
  const user = await User.findOne({ passwordResetHash: sha256(String(token)), passwordResetExpires: { $gt: new Date() } }).select('+password +passwordResetHash +passwordResetExpires')
  if (!user) return res.status(400).json({ message: 'This reset link is invalid or has expired.' })
  const err = validatePassword(password, { username: user.username, email: user.email })
  if (err) return res.status(400).json({ message: err })
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' })
  user.password = password
  user.passwordResetHash = undefined; user.passwordResetExpires = undefined
  await user.save()
  res.json({ message: 'Password updated. You can log in now.' })
})
