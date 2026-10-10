import mongoose from 'mongoose'

// A shop's saved customer — powers the billing screen's type-ahead (match by name OR mobile).
const customerSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    lastBillAt: { type: Date, default: null },
    globalUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlobalUser', default: null, index: true }, // same person across all shops
    usageCount: { type: Number, default: 0, min: 0 }, // bills made for this customer (starts from the global count when picked from the global list)
    creditBalance: { type: Number, default: 0, min: 0 }, // Advance Balance the shop holds for this customer (kept in sync by utils/ledger.js)
  },
  { timestamps: true }
)
customerSchema.index({ shopId: 1, name: 1 })
customerSchema.index({ shopId: 1, phone: 1 })
export default mongoose.model('Customer', customerSchema)
