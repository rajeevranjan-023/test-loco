import mongoose from 'mongoose'

const creditSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, default: null },
    paid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export default mongoose.model('Credit', creditSchema)
