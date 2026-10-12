import mongoose from 'mongoose'

// One running udhar account per customer. totalAmount > 0 = customer owes the shop,
// totalAmount < 0 = customer has an advance/credit with the shop, 0 = cleared.
const udharSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    totalAmount: { type: Number, default: 0 },
    pinned: { type: Boolean, default: false },
    lastAddedAt: { type: Date, default: null },   // last time udhar was added
    pendingSince: { type: Date, default: null },  // when the balance last went above 0 → drives "Days Pending"
    clearedAt: { type: Date, default: null },     // when the balance last returned to <= 0
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
)
udharSchema.index({ shopId: 1, customerId: 1 }, { unique: true })
export default mongoose.model('Udhar', udharSchema)
