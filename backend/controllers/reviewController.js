import mongoose from 'mongoose'
import Review from '../models/Review.js'
import Shop from '../models/shop/Shop.js'
import StudyCenter from '../models/library/StudyCenter.js'
import ServiceProvider from '../models/services/ServiceProvider.js'
import { asyncHandler } from '../utils/asyncHandler.js'

function getTargetModel(targetType) {
  return targetType === 'shop' ? Shop : targetType === 'study_center' ? StudyCenter : ServiceProvider
}

// Recomputes and stores the average rating + review count on the target
// document, so shop/service listings can keep showing a fast, denormalized
// rating without recalculating it on every page view.
async function syncTargetRating(targetType, targetId) {
  const stats = await Review.aggregate([
    { $match: { targetType, targetId: new mongoose.Types.ObjectId(targetId) } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])

  const Model = getTargetModel(targetType)
  const { avgRating = 0, count = 0 } = stats[0] || {}

  await Model.findByIdAndUpdate(targetId, {
    rating: count > 0 ? Math.round(avgRating * 10) / 10 : 4.5,
    reviewCount: count,
  })
}

// _________________________________________________________________________
// =========================================================================
// GET /api/reviews?targetType=shop&targetId=...  (public)
export const listReviews = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.query

  if (!['shop', 'service', 'study_center'].includes(targetType) || !targetId) {
    return res.status(400).json({ message: 'targetType (shop|service) and targetId are required.' })
  }

  const reviews = await Review.find({ targetType, targetId }).sort({ createdAt: -1 })

  const summary = reviews.reduce(
    (acc, r) => {
      acc.total += 1
      acc.sum += r.rating
      return acc
    },
    { total: 0, sum: 0 }
  )

  res.json({
    reviews,
    average: summary.total > 0 ? Math.round((summary.sum / summary.total) * 10) / 10 : 0,
    total: summary.total,
  })
})

// _________________________________________________________________________
// =========================================================================
// POST /api/reviews  (protected) — one review per user per target
export const createReview = asyncHandler(async (req, res) => {
  const { targetType, targetId, rating, comment, imageUrl } = req.body

  if (!['shop', 'service', 'study_center'].includes(targetType) || !targetId) {
    return res.status(400).json({ message: 'targetType (shop|service) and targetId are required.' })
  }
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'rating must be between 1 and 5.' })
  }
  if (!comment || !comment.trim()) {
    return res.status(400).json({ message: 'A short comment is required.' })
  }

  const Model = getTargetModel(targetType)
  const target = await Model.findById(targetId)
  if (!target) {
    return res.status(404).json({ message: 'This shop/service could not be found.' })
  }
  if (target.userId?.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: "You can't review your own listing." })
  }

  const existing = await Review.findOne({ targetType, targetId, userId: req.user._id })
  if (existing) {
    existing.rating = rating
    existing.comment = comment
    if (imageUrl !== undefined) existing.imageUrl = imageUrl
    await existing.save()
    await syncTargetRating(targetType, targetId)
    return res.json(existing)
  }

  const review = await Review.create({
    targetType,
    targetId,
    userId: req.user._id,
    userName: req.user.name,
    rating,
    comment,
    imageUrl: imageUrl || '',
  })

  await syncTargetRating(targetType, targetId)
  res.status(201).json(review)
})

// _________________________________________________________________________
// =========================================================================
// DELETE /api/reviews/:reviewId  (protected — author only)
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ _id: req.params.reviewId, userId: req.user._id })
  if (!review) {
    return res.status(404).json({ message: 'Review not found.' })
  }

  const { targetType, targetId } = review
  await review.deleteOne()
  await syncTargetRating(targetType, targetId)

  res.json({ message: 'Review deleted.' })
})
// _________________________________________________________________________
// =========================================================================
