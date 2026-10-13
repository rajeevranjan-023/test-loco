import mongoose from 'mongoose'

const seatSchema = new mongoose.Schema(
  {
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyCenter', required: true, index: true },
    name: { type: String, required: true, trim: true }, // A1 · 12 · 101 · Cabin-3 — whatever naming the owner chose
    zone: { type: String, default: '' },                // zone key
    type: { type: String, default: 'regular' },         // seat type key
    disabled: { type: Boolean, default: false },        // "Unavailable" (gray)
    note: { type: String, default: '', maxlength: 200 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)
seatSchema.index({ centerId: 1, name: 1 }, { unique: true })
export default mongoose.model('Seat', seatSchema)
