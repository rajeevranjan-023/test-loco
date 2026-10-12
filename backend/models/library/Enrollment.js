import mongoose from 'mongoose'

// A member enrolled in a course. Created when a Course Fee line is billed (Billing is the only payment path).
const enrollmentSchema = new mongoose.Schema(
  {
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyCenter', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyMember', required: true, index: true },
    billId: { type: String, default: null },
    enrolledAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['enrolled', 'completed', 'dropped'], default: 'enrolled' },
  },
  { timestamps: true }
)
enrollmentSchema.index({ centerId: 1, courseId: 1, memberId: 1 }, { unique: true })
export default mongoose.model('Enrollment', enrollmentSchema)
