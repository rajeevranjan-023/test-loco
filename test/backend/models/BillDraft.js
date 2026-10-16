import mongoose from 'mongoose'

const draftSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    status: { type: String, enum: ['draft'], default: 'draft' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: '', trim: true },
    customerPhone: { type: String, default: '', trim: true },
    total: { type: Number, default: 0, min: 0 },
    itemCount: { type: Number, default: 0, min: 0 },
    state: { type: mongoose.Schema.Types.Mixed, default: {} }, // { items, method, recv, retMode, retCustom, notes }
  },
  { timestamps: true }
)
draftSchema.index({ shopId: 1, updatedAt: -1 })
export default mongoose.model('BillDraft', draftSchema)
