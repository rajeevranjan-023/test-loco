import mongoose from 'mongoose'

const billCounterSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    date: { type: String, required: true },
    series: { type: String, default: 'A' },
    count: { type: Number, default: 100 },
    issued: { type: Number, default: 0 },
  },
  { versionKey: false }
)

// This unique index is what makes the first-bill-of-the-day upsert race-safe.
billCounterSchema.index({ shopId: 1, date: 1 }, { unique: true })

export default mongoose.model('BillCounter', billCounterSchema)
