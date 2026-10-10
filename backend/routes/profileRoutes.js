import express from 'express'
import { getProfileByUsername, getShopProducts, getSimilarShops, getShopStats } from '../controllers/profileController.js'
import { optionalAuth } from '../middleware/auth.js'

const router = express.Router()
router.get('/:username', optionalAuth, getProfileByUsername)
router.get('/:username/products', optionalAuth, getShopProducts)
router.get('/:username/similar', getSimilarShops)
router.get('/:username/stats', optionalAuth, getShopStats)

export default router
