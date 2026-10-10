import mongoose from 'mongoose'

// One membership PERIOD. A renewal creates a NEW row pointing back at the one it extends — old rows are never edited
// or deleted, so a member's full history survives renewals and seat releases.
const slotSub = new mongoose.Schema({ start: String, end: String, label: String, fullDay: Boolean }, { _id: false })
const membershipSchema = new mongoose.Schema(
  {
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyCenter', required: true, index: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyMember', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    planKey: { type: String, default: '' },
    planName: { type: String, required: true },
    months: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },    // plan price
    discount: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },    // as paid on the bill that created it (later instalments live in the udhar ledger)
    pending: { type: Number, default: 0, min: 0 },       // unpaid at billing time (the live balance is the member's ledger account)
    billId: { type: String, default: null },
    seatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', default: null },
    slot: { type: slotSub, default: null },
    kind: { type: String, enum: ['new', 'renewal'], default: 'new' },
    renewsId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  },
  { timestamps: true }
)
membershipSchema.index({ centerId: 1, memberId: 1, endDate: -1 })
export default mongoose.model('Membership', membershipSchema)
