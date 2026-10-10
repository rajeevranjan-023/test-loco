import Bill from '../models/Bill.js'
import Sale from '../models/Sale.js'
import Product from '../models/Product.js'
import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import Message from '../models/Message.js'
import { buildInsights } from '../utils/insights.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// GET /api/seller/insights?days=30&channel=both|online|offline
export const getInsights = asyncHandler(async (req, res) => {
  if (req.sellerType !== 'shop') return res.status(400).json({ message: 'Analytics is available for shops.' })
  const shop = req.sellerAccount
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 90)
  const channel = ['online', 'offline'].includes(req.query.channel) ? req.query.channel : 'both'
  const q = { shopId: shop._id, createdAt: { $gte: new Date(Date.now() - Math.max(2 * days, 300) * 864e5) } }
  if (channel !== 'both') q.channel = channel
  const qb = { ...q, orderStatus: { $ne: 'Cancelled' } }, qs = { ...q, cancelled: { $ne: true } } // cancelled orders don't count

  const [bills, sales, products, adds, owing, people, messages] = await Promise.all([
    Bill.find(qb).lean(), Sale.find(qs).lean(), Product.find({ shopId: shop._id, listed: { $ne: false } }).lean(),
    UdharHistory.find({ shopId: shop._id, type: 'udhar', date: q.createdAt }).select('amount date').lean(),
    Udhar.find({ shopId: shop._id, totalAmount: { $gt: 0 } }).select('totalAmount').lean(),
    Bill.aggregate([{ $match: { shopId: shop._id, customerName: { $ne: '' }, orderStatus: { $ne: 'Cancelled' } } }, { $group: { _id: '$customerName', first: { $min: '$createdAt' }, last: { $max: '$createdAt' } } }]),
    Message.find({ shopId: shop._id, direction: 'in' }).sort({ createdAt: -1 }).limit(5).lean(),
  ])
  res.json({ shop: { name: shop.shopName }, channel, ...buildInsights({ shop, bills, sales, products, credits: adds.map((a) => ({ amount: a.amount, createdAt: a.date })), udharTotal: owing.reduce((s, u) => s + u.totalAmount, 0), people, messages, days }) })
})
