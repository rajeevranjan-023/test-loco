import mongoose from 'mongoose'

// Who sits on which seat, and in which time slot. A row is ACTIVE while releasedAt is null.
// Membership expiry never touches this collection — only an explicit release does (owner, or the member leaving
// through a confirmed request). Released rows stay forever as seat history.
const slotSub = new mongoose.Schema({ start: String, end: String, label: String, fullDay: Boolean }, { _id: false })
const assignmentSchema = new mongoose.Schema(
  {
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyCenter', required: true, index: true },
    seatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true, index: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyMember', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
    slot: { type: slotSub, required: true },
    startedAt: { type: Date, default: Date.now },
    releasedAt: { type: Date, default: null },
    releasedBy: { type: String, enum: ['owner', 'member', 'reassigned', null], default: null },
    releaseNote: { type: String, default: '', maxlength: 200 },
    releaseRequestedAt: { type: Date, default: null }, // the member asked to leave; the owner confirms by releasing
  },
  { timestamps: true }
)
assignmentSchema.index({ centerId: 1, seatId: 1, releasedAt: 1 })
export default mongoose.model('SeatAssignment', assignmentSchema)
