import mongoose from 'mongoose'

const globalUserSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, match: /^\d{10}$/ },
    names: [{ _id: false, name: { type: String, trim: true, required: true }, key: { type: String, required: true }, count: { type: Number, default: 0, min: 0 } }],
  },
  { timestamps: true }
)
globalUserSchema.index({ 'names.key': 1 })
export default mongoose.model('GlobalUser', globalUserSchema)
