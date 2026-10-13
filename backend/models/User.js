import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    // ── Added by the new signup flow (all optional, so every existing account stays valid) ──
    googleId: { type: String, unique: true, sparse: true },     // Google 'sub' — the stable identity, never the email
    emailVerified: { type: Boolean, default: false },
    phoneE164: { type: String, unique: true, sparse: true },                   // +91XXXXXXXXXX, only set for OTP-verified numbers
    phoneVerified: { type: Boolean, default: false },
    dob: { type: Date, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    address: {
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    accountTypes: { type: [String], default: undefined },                      // subset of consumer | shop | service | study
    interests: { type: [String], default: undefined },
    // `completed === false` only for accounts created by the new flow and not yet finished; legacy docs have no value → treated as complete.
    onboarding: {
      completed: { type: Boolean, default: undefined },
      step: { type: String, default: undefined },
    },
    passwordResetHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    role: { type: String, enum: ['consumer', 'seller', 'admin'], default: 'consumer' },
    sellerType: { type: String, enum: ['shop', 'service', 'study_center', null], default: null },
    phone: { type: String, default: '', trim: true },
    bio: { type: String, default: '', maxlength: 160 },
    avatarUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    following: [
      {
        _id: false,
        targetType: { type: String, enum: ['shop', 'service', 'study_center'] },
        targetId: { type: mongoose.Schema.Types.ObjectId },
        followedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
)

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password)
}

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    username: this.username,
    role: this.role,
    sellerType: this.sellerType,
    phone: this.phone,
    bio: this.bio,
    avatarUrl: this.avatarUrl,
    bannerUrl: this.bannerUrl,
    followingCount: this.following?.length || 0,
    location: this.location,
    emailVerified: !!this.emailVerified,
    phoneVerified: !!this.phoneVerified,
    gender: this.gender || '',
    dob: this.dob || null,
    address: this.address || {},
    accountTypes: this.accountTypes || [],
    interests: this.interests || [],
    onboardingCompleted: this.onboarding?.completed !== false,
    onboardingStep: this.onboarding?.step || null,
    hasGoogle: !!this.googleId,
  }
}

export default mongoose.model('User', userSchema)

