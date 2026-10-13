import mongoose from 'mongoose'

const serviceItemSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // the seller account (shop or service provider)
    kind: { type: String, enum: ['service', 'labour'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    rate: { type: Number, default: 0, min: 0 },
    pricing: { type: String, enum: ['fixed', 'per_unit', 'hourly', 'custom'], default: 'fixed' },
    unit: { type: String, default: '', trim: true, maxlength: 12 },
    active: { type: Boolean, default: true },
    usedCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
)
serviceItemSchema.index({ shopId: 1, kind: 1, name: 1 })
export default mongoose.model('ServiceItem', serviceItemSchema)
