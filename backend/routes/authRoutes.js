import express from 'express'
import { register, login, getMe, updateMe, updateLocation } from '../controllers/authController.js'
import { googleStart, googleCallback, googleExchange, googleLink } from '../controllers/googleAuthController.js'
import {
  requireRegistration, startEmailRegistration, getRegistrationSession, submitPersonalInfo, resendOtp, verifyRegistrationOtp,
  changePhone, checkRegistrationUsername, uploadRegistrationAvatar, completeRegistration,
} from '../controllers/registrationController.js'
import { updateOnboarding, forgotPassword, resetPassword } from '../controllers/accountController.js'
import { protect } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = express.Router()
const MIN = 60 * 1000

// ── existing session endpoints ────────────────────────────────────────────────────────────────────────────────────────
router.post('/register', register)   // legacy; disabled outside tests unless ALLOW_LEGACY_REGISTER=true (see authController)
router.post('/login', rateLimit({ name: 'login', windowMs: 15 * MIN, max: 20, message: 'Too many login attempts. Try again in a few minutes.' }), login)
router.get('/me', protect, getMe)
router.patch('/me', protect, updateMe)
router.patch('/location', protect, updateLocation)

// ── Google (official OAuth 2.0 authorization-code flow, verified on the server) ───────────────────────────────────────
router.get('/google/start', rateLimit({ name: 'g-start', windowMs: 5 * MIN, max: 30 }), googleStart)
router.get('/google/callback', googleCallback)
router.post('/google/exchange', rateLimit({ name: 'g-ex', windowMs: 5 * MIN, max: 30 }), googleExchange)
router.post('/google/link', rateLimit({ name: 'g-link', windowMs: 15 * MIN, max: 10 }), googleLink)

// ── registration (state is kept on the server; the browser holds only an opaque token) ────────────────────────────────
router.post('/register/email/start', rateLimit({ name: 'reg-email', windowMs: 15 * MIN, max: 15 }), startEmailRegistration)
router.get('/register/session', requireRegistration, getRegistrationSession)
router.post('/register/personal', rateLimit({ name: 'reg-personal', windowMs: 15 * MIN, max: 30 }), requireRegistration, submitPersonalInfo)
router.post('/register/otp/resend', rateLimit({ name: 'otp-resend', windowMs: 15 * MIN, max: 10 }), requireRegistration, resendOtp)
router.post('/register/otp/verify', rateLimit({ name: 'otp-verify', windowMs: 15 * MIN, max: 30 }), requireRegistration, verifyRegistrationOtp)
router.post('/register/otp/change-phone', requireRegistration, changePhone)
router.get('/register/check-username', rateLimit({ name: 'reg-uname', windowMs: MIN, max: 40 }), requireRegistration, checkRegistrationUsername)
router.post('/register/avatar', rateLimit({ name: 'reg-avatar', windowMs: 15 * MIN, max: 10 }), requireRegistration,
  (req, res, next) => upload.single('file')(req, res, (err) => (err ? res.status(400).json({ message: err.message || 'Upload failed.' }) : next())), uploadRegistrationAvatar)
router.post('/register/complete', rateLimit({ name: 'reg-complete', windowMs: 15 * MIN, max: 20 }), requireRegistration, completeRegistration)

// ── after signup (authenticated) ──────────────────────────────────────────────────────────────────────────────────────
router.patch('/onboarding', protect, updateOnboarding)

// ── password reset ────────────────────────────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', rateLimit({ name: 'forgot', windowMs: 60 * MIN, max: 8 }), forgotPassword)
router.post('/reset-password', rateLimit({ name: 'reset', windowMs: 15 * MIN, max: 10 }), resetPassword)

export default router
