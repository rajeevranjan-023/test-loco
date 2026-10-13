import express from 'express'
import { protect } from '../middleware/auth.js'
import { mySeats, requestRelease } from '../controllers/studyController.js'
const router = express.Router()
router.get('/my-seats', protect, mySeats)
router.post('/release-request', protect, requestRelease)
export default router
