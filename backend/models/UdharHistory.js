import mongoose from 'mongoose'

// Immutable notebook line. type:
//   udhar   → udhar given (customer owes more)
//   payment → money received against udhar
//   credit  → Advance Balance entry: customer paid extra / deposited advance (delta < 0),
//             or advance consumed by a bill (delta > 0, paymentType 'advance')
const historySchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: { type: String, enum: ['udhar', 'payment', 'credit', 'adjustment'], required: true },
    amount: { type: Number, required: true, min: 0.01 }, // always positive
    delta: { type: Number, default: 0 },                 // signed effect on the customer's balance (+ owes more · − owes less / more advance)
    source: { type: String, enum: ['billing', 'manual'], default: 'manual' },
    billId: { type: String, default: null },
    items: [{ _id: false, name: String, qty: Number, price: Number }],
    paymentType: { type: String, default: 'cash' },
    note: { type: String, default: '', trim: true, maxlength: 300 },
    balanceAfter: { type: Number, default: 0 },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
)
historySchema.index({ shopId: 1, customerId: 1, date: 1 })
export default mongoose.model('UdharHistory', historySchema)
