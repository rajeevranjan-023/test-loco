import mongoose from 'mongoose'

const studyMemberSchema = new mongoose.Schema(
  {
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyCenter', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    memberCode: { type: String, required: true },          // STU001 …
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    className: { type: String, default: '', trim: true },  // "10th", "UPSC" … optional
    joinedAt: { type: Date, default: Date.now },
    notes: { type: String, default: '', maxlength: 500 },
    inactive: { type: Boolean, default: false },
    leftAt: { type: Date, default: null },                 // set when the member leaves (seat released); history is kept
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // linked Loco account, if the member has one
  },
  { timestamps: true }
)
studyMemberSchema.index({ centerId: 1, customerId: 1 }, { unique: true })
studyMemberSchema.index({ centerId: 1, memberCode: 1 }, { unique: true })
export default mongoose.model('StudyMember', studyMemberSchema)
