import mongoose from 'mongoose'

// One row per (purpose, subject). Owned by utils/otp.js — nothing else should read or write it.
// The code itself is never stored: only an HMAC of it. Rows disappear on their own after `expiresAt`.
const otpChallengeSchema = new mongoose.Schema(
  {
    purpose: { type: String, required: true },          // e.g. 'registration'
    subject: { type: String, required: true },          // e.g. the registration-session id
    phone: { type: String, required: true },            // E.164, the number the code was sent to
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    sendCount: { type: Number, default: 1 },
    sendWindowStart: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)
otpChallengeSchema.index({ purpose: 1, subject: 1 }, { unique: true })
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 }) // purge an hour after expiry

export default mongoose.model('OtpChallenge', otpChallengeSchema)
