import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    tone: { type: String, default: 'gray' },
    kind: { type: String, enum: ['shop', 'service', 'library', 'other'], default: 'other' },
    query: { type: String, default: '', trim: true }, // what the search page is opened with; defaults to name
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model('Category', categorySchema)
