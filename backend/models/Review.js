import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema(
  {
    // Polymorphic target — a review belongs to either a Shop or a ServiceProvider.
    targetType: { type: String, enum: ['shop', 'service', 'study_center'], required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },

    // Single optional image, stored as a data URL / hosted URL string.
    imageUrl: { type: String, default: '' },
  },
  { timestamps: true }
)

// One review per user per target — editing is done via update, not duplicate posts.
reviewSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true })

export default mongoose.model('Review', reviewSchema)
