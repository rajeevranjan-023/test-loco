import mongoose from 'mongoose'

const requirementSchema = new mongoose.Schema(
  {
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },

    category: { type: String, required: true, trim: true },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },

    imageUrl: { type: String, default: '' },

    status: { type: String, enum: ['open', 'closed'], default: 'open' },

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
