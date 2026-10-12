import mongoose from 'mongoose'

// One identity per phone number, shared by every shop. Each shop's Customer row points here via globalUserId,
// so "Raj" at shop A and "Raju" at shop B are recognised as the same person.
//   names[].count = how many bills were made under that spelling; the highest count is the display name.
//   names[].key   = lowercase copy of the name, indexed so type-ahead is a fast prefix lookup.
const globalUserSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, match: /^\d{10}$/ },
    names: [{ _id: false, name: { type: String, trim: true, required: true }, key: { type: String, required: true }, count: { type: Number, default: 0, min: 0 } }],
  },
  { timestamps: true }
)
globalUserSchema.index({ 'names.key': 1 })
export default mongoose.model('GlobalUser', globalUserSchema)
