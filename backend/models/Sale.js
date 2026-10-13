import mongoose from 'mongoose'

const saleSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, enum: ['kg', 'liter', 'unit'], default: 'unit' },
    priceAtSale: { type: Number, required: true }, // snapshot, in case price changes later
    costAtSale: { type: Number, required: true },
    costBreakdown: { type: [new mongoose.Schema({ batchId: { type: mongoose.Schema.Types.ObjectId, default: null }, qty: { type: Number, required: true }, costPrice: { type: Number, required: true } }, { _id: false })], default: [] },
    channel: { type: String, enum: ['online', 'offline'], default: 'offline' },
    customerName: { type: String, default: '' },
    billId: { type: String, index: true, default: null },
    cancelled: { type: Boolean, default: false }, // line belongs to a cancelled order → excluded from analytics
  },
  { timestamps: true }
)

saleSchema.virtual('revenue').get(function revenue() {
  return this.priceAtSale * this.quantity
})

saleSchema.virtual('profit').get(function profit() {
  return (this.priceAtSale - this.costAtSale) * this.quantity
})

saleSchema.set('toJSON', { virtuals: true })

export default mongoose.model('Sale', saleSchema)
