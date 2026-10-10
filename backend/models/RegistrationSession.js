import mongoose from 'mongoose'

// Server-side registration progress. The browser only ever holds an opaque random token (stored here hashed);
// every "verified" fact (Google identity, OTP, phone) lives on the backend and is re-checked before the account is created.
const registrationSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    kind: { type: String, enum: ['google', 'email'], required: true },
    googleId: { type: String, default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    picture: { type: String, default: '' },
    step: { type: String, enum: ['personal', 'otp', 'credentials', 'done'], default: 'personal' },
    profile: {
      fullName: String,
      phone: String,          // 10-digit national number
      phoneE164: String,
      dob: Date,
      gender: String,
      city: String,
      state: String,
      country: String,
      avatarUrl: String,
    },
    completing: { type: Boolean, default: false },       // in-flight guard for the final submit
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    next: { type: String, default: '/' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)
registrationSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
registrationSessionSchema.index({ googleId: 1 }, { sparse: true })
registrationSessionSchema.index({ email: 1 })

export default mongoose.model('RegistrationSession', registrationSessionSchema)
