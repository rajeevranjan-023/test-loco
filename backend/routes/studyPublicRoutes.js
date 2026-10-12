import express from 'express'
import { protect } from '../middleware/auth.js'
import { mySeats, requestRelease } from '../controllers/library/studyController.js'
// A logged-in member's own view: their seats, and "Release My Seat" (a request — the owner confirms).
const router = express.Router()
router.get('/my-seats', protect, mySeats)
router.post('/release-request', protect, requestRelease)
export default router
