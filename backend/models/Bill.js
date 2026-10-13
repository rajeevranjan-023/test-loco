import mongoose from 'mongoose'

// One line of a bill — a frozen snapshot (name, rate, cost) so history stays correct if the product/service changes later.
const lineSchema = new mongoose.Schema({
  type: { type: String, enum: ['product', 'service', 'material', 'labour', 'other', 'membership', 'course', 'book', 'fine', 'registration', 'seat'], required: true },
  refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Product (product/material) or ServiceItem (service/labour) when there is one
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 0 },
  unit: { type: String, default: '' },
  rate: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  pricing: { type: String, default: 'fixed' },
  description: { type: String, default: '' },
  charge: { type: String, enum: ['charged', 'included', 'internal'], default: 'charged' }, // included = inside a service price · internal = stock used, customer not charged
  discountType: { type: String, enum: ['fixed', 'percent'], default: 'fixed' },
  discountValue: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 }, // ₹ actually taken off this line
  cost: { type: Number, default: 0 }, // weighted FIFO cost per unit (product/material)
  costBreakdown: { type: [new mongoose.Schema({ batchId: { type: mongoose.Schema.Types.ObjectId, default: null }, qty: Number, costPrice: Number }, { _id: false })], default: undefined }, // exactly which batches were consumed
  meta: { type: mongoose.Schema.Types.Mixed, default: undefined }, // business-specific line details (study centre: plan, seat, slot, course …) — validated by the business schema hook
}, { _id: false })

const billSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    billId: { type: String, required: true }, // e.g. "261003A0101" (UI shows #261003A0101) — shared with the Sale line items it groups; unique PER SHOP (index below)
    fullId: { type: String, default: '' }, // internal/support id, e.g. "RAB50-20261003-A-0101"

    customerName: { type: String, default: '', trim: true },
    customerPhone: { type: String, default: '', trim: true },
    channel: { type: String, enum: ['online', 'offline'], default: 'offline' },

    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0 },
    unpaidAmount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], required: true },

    // If the unpaid remainder was pushed to the Udhar ledger, this points
    // at that Credit entry so the two stay traceable to each other.
    // Fulfilment state shown in the dashboard's Recent Orders (existing bills default to Delivered).
    paymentMethod: { type: String, enum: ['upi', 'cash', 'card', 'udhar'], default: 'cash' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    status: { type: String, enum: ['paid', 'udhar', 'advance'], default: 'paid' }, // settlement: paid · udhar (owes) · advance (customer paid extra)
    balanceAfter: { type: Number, default: null }, // customer's account balance right after this bill (+ owes · − advance)
    balanceBefore: { type: Number, default: null }, // …and right BEFORE it — a frozen snapshot so the printed "previous udhar" never changes (null on older bills; read-time fallback in billingController)
    cancelledAt: { type: Date, default: null },
    creditUsed: { type: Number, default: 0, min: 0 },    // customer's Advance Balance auto-deducted on this bill
    advanceAdded: { type: Number, default: 0, min: 0 },  // extra paid on this bill that went into Advance Balance
    // Extra revenue lines used by the Revenue / Profit breakdown charts
    receivedAmount: { type: Number, default: null }, // cash handed over by the customer
    returnedAmount: { type: Number, default: null }, // change given back by the seller
    notes: { type: String, default: '', trim: true, maxlength: 300 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    otherIncome: { type: Number, default: 0, min: 0 },
    orderStatus: { type: String, enum: ['New', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'], default: 'Delivered' },

    // ── Universal billing ──
    subtotal: { type: Number, default: undefined },   // before any discount / tax (undefined on pre-universal bills)
    discountType: { type: String, enum: ['fixed', 'percent'], default: undefined },  // the bill-level discount as entered
    discountValue: { type: Number, default: undefined },
    taxName: { type: String, default: undefined }, taxRate: { type: Number, default: undefined }, taxAmount: { type: Number, default: undefined },
    payments: { type: [new mongoose.Schema({ method: String, amount: Number, at: Date }, { _id: false })], default: undefined }, // what was paid AT billing time, per method (later instalments live in the ledger)
    transactionType: { type: String, enum: ['sale', 'service', 'labour', 'mixed', 'membership', 'course', 'book', 'fine'], default: 'sale' }, // derived from the lines
    items: { type: [lineSchema], default: undefined }, // absent on bills created before universal billing (those read from Sale)
    revenue: { type: new mongoose.Schema({ product: Number, material: Number, service: Number, labour: Number, other: Number, membership: Number, course: Number, book: Number, fine: Number, registration: Number, seat: Number }, { _id: false }), default: undefined }, // net of discount; sums to totalAmount
    cost: { type: new mongoose.Schema({ product: Number, material: Number }, { _id: false }), default: undefined },
    context: { type: [new mongoose.Schema({ key: String, label: String, value: String }, { _id: false })], default: undefined }, // optional vehicle / device / job ref …

    creditId: { type: mongoose.Schema.Types.ObjectId, ref: 'Credit', default: null },
  },
  { timestamps: true }
)

billSchema.index({ shopId: 1, billId: 1 }, { unique: true })

export default mongoose.model('Bill', billSchema)
