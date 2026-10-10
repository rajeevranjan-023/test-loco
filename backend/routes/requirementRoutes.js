import express from 'express'
import {
  createRequirement,
  listMyRequirements,
  listInboxRequirements,
  respondToRequirement,
  closeRequirement,
} from '../controllers/requirementController.js'
import { protect, optionalAuth, requireSeller } from '../middleware/auth.js'

const router = express.Router()

// Post a new requirement — works for guests and logged-in buyers alike.
router.post('/', optionalAuth, createRequirement)

// Buyer's own posted requirements.
router.get('/mine', protect, listMyRequirements)
router.patch('/:requirementId/close', protect, closeRequirement)

// Seller/service-provider inbox — requirements matching their category.
router.get('/inbox', protect, requireSeller, listInboxRequirements)
router.patch('/:requirementId/respond', protect, requireSeller, respondToRequirement)

export default router
