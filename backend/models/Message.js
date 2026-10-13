import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    direction: { type: String, enum: ['in', 'out'], required: true }, // in = from customer, out = from shop
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)
export default mongoose.model('Message', messageSchema)
