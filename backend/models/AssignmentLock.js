import mongoose from 'mongoose'

// A short-lived lock held ONLY while a seat assignment is checked and written (utils/studyService.js#withAssignmentLocks).
// The UNIQUE index on `key` is what makes it safe: of several simultaneous requests, the database lets exactly one insert succeed —
// the same technique BillCounter uses for first-bill-of-the-day. A crashed request's lock expires by itself: the next request for that key reclaims it.
const lockSchema = new mongoose.Schema(
  { key: { type: String, required: true }, token: { type: String, required: true }, expiresAt: { type: Date, required: true } },
  { versionKey: false }
)
lockSchema.index({ key: 1 }, { unique: true })

export default mongoose.model('AssignmentLock', lockSchema)
