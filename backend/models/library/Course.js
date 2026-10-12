import mongoose from 'mongoose'

const courseSchema = new mongoose.Schema(
  {
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyCenter', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', maxlength: 500 },
    duration: { type: String, default: '', trim: true }, // "3 Months", "40 hours" …
    fee: { type: Number, required: true, min: 0 },
    instructor: { type: String, default: '', trim: true },
    capacity: { type: Number, default: 0, min: 0 },      // 0 = no limit
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
)
courseSchema.index({ centerId: 1, name: 1 }, { unique: true })
export default mongoose.model('Course', courseSchema)
