import User from '../models/common/User.js'
import jwt from 'jsonwebtoken'
import RevokedToken from '../models/RevokedToken.js'
import { tokenHash } from '../middleware/auth.js'
import Shop from '../models/shop/Shop.js'
import ServiceProvider from '../models/services/ServiceProvider.js'
import { findAccountByUser } from '../utils/accounts.js'
import { normalizeUsername, assertUsernameAvailable } from '../utils/username.js'
import { generateToken } from '../utils/generateToken.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { EMAIL_RE as LOGIN_EMAIL_RE } from '../utils/authHelpers.js'
// _________________________________________________________________________
// =========================================================================
// POST /api/auth/register
// Legacy one-step signup (name + email + password, no mobile/OTP). The website now uses the verified multi-step flow in
// registrationController.js, so this endpoint is switched off unless ALLOW_LEGACY_REGISTER=true (or NODE_ENV=test, which the
// existing integration tests rely on). Leaving it open would let anyone skip OTP verification.
export const register = asyncHandler(async (req, res) => { 
  if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_LEGACY_REGISTER !== 'true') {
    return res.status(410).json({ message: 'This signup method has been replaced. Please sign up at /signup.' })
  }
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are all required.' })
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists.' })
  }

  const user = await User.create({ name, email, password })

  res.status(201).json({
    user: user.toSafeObject(),
    token: generateToken(user._id), 
  })
})

// _________________________________________________________________________
// =========================================================================
// POST /api/auth/login
// Accepts { identifier } (email OR username, with or without "@") — or the legacy { email } field.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.3b0WZ0m0Hqz3q8m9s3xQeP1y1fMy' // equalises timing for unknown accounts
export const login = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier ?? req.body.email ?? '').trim()
  const { password } = req.body

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email or username and password are required.' })
  }

  const query = LOGIN_EMAIL_RE.test(identifier) ? { email: identifier.toLowerCase() } : { username: normalizeUsername(identifier) }
  const user = await User.findOne(query).select('+password')
  const valid = user ? await user.comparePassword(String(password)) : (await bcryptCompareDummy(String(password)), false)
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email/username or password.' })
  }

  res.json({
    user: user.toSafeObject(),
    token: generateToken(user._id),
  })
})
const bcryptCompareDummy = async (pw) => (await import('bcryptjs')).default.compare(pw, DUMMY_HASH)

// _________________________________________________________________________
// =========================================================================
// GET /api/auth/me  (protected)
export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeObject() })
})

// _________________________________________________________________________
// =========================================================================
// PATCH /api/auth/me  (protected) — the Edit Account endpoint, usable by
// ANY logged-in user (consumer or seller). A user can only ever edit their
// own record: it always operates on req.user (from the verified JWT), never
// on an id supplied in the request.
//
// Body (all optional): name, username, email, phone, bio, avatarUrl, bannerUrl
// For sellers, username/email/phone/name/bannerUrl are mirrored onto their
// Shop/ServiceProvider doc so the public profile page stays in sync.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[0-9][0-9\s\-()]{6,17}$/

export const updateMe = asyncHandler(async (req, res) => {
  const { name, username, email, phone, bio, avatarUrl, bannerUrl } = req.body
  const user = req.user

  // ---- Validation ----
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ message: 'Name cannot be empty.' })
  }

  if (email !== undefined) {
    const cleanEmail = String(email).trim().toLowerCase()
    if (!cleanEmail) return res.status(400).json({ message: 'Email cannot be empty.' })
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' })
    }
    if (cleanEmail !== user.email) {
      const emailTaken = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } })
      if (emailTaken) return res.status(400).json({ message: 'That email is already in use.' })
    }
  }

  if (phone !== undefined && String(phone).trim() && !PHONE_REGEX.test(String(phone).trim())) {
    return res.status(400).json({ message: 'Enter a valid phone number (7-15 digits, may start with +).' })
  }

  if (bio !== undefined && String(bio).length > 160) {
    return res.status(400).json({ message: 'Bio must be 160 characters or fewer.' })
  }

  let nextUsername = null
  if (username !== undefined && String(username).trim()) {
    if (normalizeUsername(username) !== user.username) {
      const check = await assertUsernameAvailable(username)
      if (!check.ok) return res.status(400).json({ message: check.error })
      nextUsername = check.username
    }
  }

  // ---- Apply to the User ----
  if (name !== undefined) user.name = String(name).trim()
  if (nextUsername) user.username = nextUsername
  if (email !== undefined) user.email = String(email).trim().toLowerCase()
  if (phone !== undefined) user.phone = String(phone).trim()
  if (bio !== undefined) user.bio = bio
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl
  if (bannerUrl !== undefined) user.bannerUrl = bannerUrl
  await user.save()

  // ---- Keep a seller's public listing in sync ----
  if (user.role === 'seller') {
    const listing = await findAccountByUser(user._id, user.sellerType)

    if (listing) {
      if (nextUsername) listing.username = user.username
      if (email !== undefined) listing.email = user.email
      if (phone !== undefined) listing.phone = user.phone
      if (name !== undefined) {
        if (user.sellerType === 'shop' || user.sellerType === 'study_center') listing.ownerName = user.name
        else listing.name = user.name
      }
      if (bannerUrl !== undefined) listing.bannerUrl = user.bannerUrl
      await listing.save()
    }
  }

  res.json({ user: user.toSafeObject() })
})

// _________________________________________________________________________
// =========================================================================
// PATCH /api/auth/location  (protected)
export const updateLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ message: 'lat and lng must both be numbers.' })
  }

  req.user.location = { lat, lng, updatedAt: new Date() }
  await req.user.save()

  res.json({ user: req.user.toSafeObject() })
})
// _________________________________________________________________________
// =========================================================================

// POST /api/auth/logout  (protected)
// Ends THIS session only (the token that made the request) — other devices stay logged in. The token is recorded as revoked, so
// a stale copy (another tab, bfcache, a copied header) can no longer authenticate, even before its 30-day expiry.
export const logout = asyncHandler(async (req, res) => {
  const token = String(req.headers.authorization || '').split(' ')[1]
  const exp = jwt.decode(token)?.exp
  await RevokedToken.updateOne({ hash: tokenHash(token) }, { $setOnInsert: { userId: req.user._id, expiresAt: new Date((exp || Math.floor(Date.now() / 1000) + 30 * 86400) * 1000) } }, { upsert: true })
  res.json({ ok: true })
})
