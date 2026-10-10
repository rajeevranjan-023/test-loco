import mongoose from 'mongoose'

const requirementSchema = new mongoose.Schema(
  {
    // Optional — a logged-out visitor can still post a requirement using just phone/email.
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },

    // Free-text category — matched (case-insensitively) against Shop.category
    // and ServiceProvider.workType so the requirement reaches the right inbox.
    category: { type: String, required: true, trim: true },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },

    // Single optional photo, stored as a data URL / hosted URL string.
    imageUrl: { type: String, default: '' },

    status: { type: String, enum: ['open', 'closed'], default: 'open' },

    // Sellers/providers who have responded (so we can show "Responded" state
    // and avoid double counting per seller in the inbox).
    responses: [
      {
        sellerType: { type: String, enum: ['shop', 'service'] },
        sellerId: { type: mongoose.Schema.Types.ObjectId },
        message: { type: String, default: '' },
        respondedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
)

requirementSchema.index({ category: 1, status: 1, createdAt: -1 })

export default mongoose.model('Requirement', requirementSchema)
