import express from 'express'
import { getHome, suggest, categoryAdmin, cityAdmin, promoAdmin, setShopFlags } from '../controllers/homeController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// Public
router.get('/home', getHome)
router.get('/home/suggest', suggest)

// Admin only — manage what the homepage shows
const adminOnly = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required.' })
router.use('/admin/home', protect, adminOnly)

for (const [path, c] of [['categories', categoryAdmin], ['cities', cityAdmin], ['promos', promoAdmin]]) {
  router.get(`/admin/home/${path}`, c.list)
  router.post(`/admin/home/${path}`, c.create)
  router.put(`/admin/home/${path}/:id`, c.update)
  router.delete(`/admin/home/${path}/:id`, c.remove)
}
router.patch('/admin/home/shops/:id', setShopFlags)

export default router
