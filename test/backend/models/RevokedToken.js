import mongoose from 'mongoose'

const revokedTokenSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
)
export default mongoose.model('RevokedToken', revokedTokenSchema)
