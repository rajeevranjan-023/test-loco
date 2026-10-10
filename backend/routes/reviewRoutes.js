import express from 'express'
import { listReviews, createReview, deleteReview } from '../controllers/reviewController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.get('/', listReviews)
router.post('/', protect, createReview)
router.delete('/:reviewId', protect, deleteReview)

export default router
