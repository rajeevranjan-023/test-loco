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

router.post('/', optionalAuth, createRequirement)

router.get('/mine', protect, listMyRequirements)
router.patch('/:requirementId/close', protect, closeRequirement)

router.get('/inbox', protect, requireSeller, listInboxRequirements)
router.patch('/:requirementId/respond', protect, requireSeller, respondToRequirement)

export default router
