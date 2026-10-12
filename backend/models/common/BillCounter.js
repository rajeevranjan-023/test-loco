import mongoose from 'mongoose'

// One document per shop per calendar day. Resetting "daily" simply means a new
// date => a new document, so there is no cron job and no manual reset.
//
//   shopId  – owner shop
//   date    – "YYYY-MM-DD" in the business timezone (see BILL_TZ in utils/billId.js)
//   series  – current letter, A → B → … (derived atomically, see generateBillId)
//   count   – current 4-digit counter inside the series (A starts at 101, others at 1)
//   issued  – how many IDs have been handed out today; this is the single value that is
//             incremented atomically, series/count are derived from it in the same update.
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
