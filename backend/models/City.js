import mongoose from 'mongoose'

// "Explore by Location" tile. `name` is matched (case-insensitively) against
// Shop.location.district and ServiceProvider.areas.district.
const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    state: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model('City', citySchema)
