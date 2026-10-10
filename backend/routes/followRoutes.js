import express from 'express'
import { toggleFollow, listFollowers, listFollowing } from '../controllers/followController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.post('/', protect, toggleFollow)
router.get('/followers', listFollowers)
router.get('/following/:userId', listFollowing)

export default router
