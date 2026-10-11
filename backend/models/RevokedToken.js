import mongoose from 'mongoose'

// A session token that was logged out. Loco's sessions are stateless JWTs, so "logout" used to be client-only and a copied/stale
// token stayed valid until it expired. Logout now records the token here (by hash — the token itself is never stored); `protect`
// and `optionalAuth` refuse it from then on. Rows expire on their own when the token would have expired anyway.
const revokedTokenSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
)
export default mongoose.model('RevokedToken', revokedTokenSchema)
