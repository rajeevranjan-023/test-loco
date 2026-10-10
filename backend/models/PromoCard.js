import mongoose from 'mongoose'

// Side promo card shown next to a homepage row ("Need a Shop?" …). One active card per section.
const promoCardSchema = new mongoose.Schema(
  {
    section: { type: String, enum: ['shops', 'services', 'libraries'], required: true, index: true },
    title: { type: String, required: true, trim: true },
    highlight: { type: String, default: '', trim: true },
    points: { type: [String], default: [] },
    ctaLabel: { type: String, default: 'Explore', trim: true },
    searchQuery: { type: String, default: '', trim: true }, // where the button / "View All" leads
    imageUrl: { type: String, default: '' },
    tone: { type: String, default: 'orange' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model('PromoCard', promoCardSchema)
