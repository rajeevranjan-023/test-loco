import mongoose from 'mongoose'

const offerSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    title: { type: String, required: true, trim: true },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    appliesTo: { type: String, default: 'All products', trim: true }, // category or product name
    validUntil: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)
export default mongoose.model('Offer', offerSchema)
