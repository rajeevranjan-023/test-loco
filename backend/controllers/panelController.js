import Bill from '../models/common/Bill.js'
import Sale from '../models/common/Sale.js'
import Product from '../models/common/Product.js'
import Udhar from '../models/common/Udhar.js'
import Offer from '../models/shop/Offer.js'
import Message from '../models/shop/Message.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { payLabel } from '../utils/payLabel.js'
import { displayBillId } from '../utils/billId.js'
import { publicBusiness } from '../utils/businessSchema.js'
import { accountName, accountCode } from '../utils/accounts.js'
import { studyNotifications } from '../utils/library/studyReports.js'

const STATUSES = ['New', 'Preparing', 'Out for Delivery', 'Delivered']
const sid = (req) => req.sellerAccount._id
const shopOnly = (req, res) => (req.sellerType === 'shop' ? false : (res.status(403).json({ message: 'Shop accounts only.' }), true))
const shortId = (b) => displayBillId(b.billId)

// GET /api/seller/summary — shell data for every seller page (sidebar badges, bell, plan)
export const getSummary = asyncHandler(async (req, res) => {
  const shop = req.sellerAccount
  // the business schema (terms · navigation · modules · brand) rides along with the shell data — it decides what the whole dashboard looks like
  const business = publicBusiness(req.sellerType, shop)
  const code = accountCode(shop) || `#${String(shop.username).replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase()}${String(shop._id).slice(-3).toUpperCase()}`
  if (business.dashboard.provider === 'study') {
    return res.json({ shop: { name: accountName(shop), category: shop.category || 'Library', code, plan: 'Free' }, business, badges: {}, notifications: await studyNotifications(shop) })
  }
  const [open, products, credits, unread] = await Promise.all([
    Bill.countDocuments({ shopId: sid(req), orderStatus: { $ne: 'Delivered' } }),
    Product.find({ shopId: sid(req), listed: { $ne: false } }).select('name stock lowStockAt').lean(),
    Udhar.find({ shopId: sid(req), totalAmount: { $gt: 0 }, pendingSince: { $lt: new Date(Date.now() - 7 * 864e5) } }).select('_id').lean(),
    Message.countDocuments({ shopId: sid(req), direction: 'in', read: false }),
  ])
  const low = products.filter((p) => p.stock <= (p.lowStockAt ?? 10))
  const notifications = [
    ...(open ? [{ text: `${open} order${open > 1 ? 's' : ''} waiting to be fulfilled`, to: '/analytics/orders' }] : []),
    ...low.slice(0, 3).map((p) => ({ text: `${p.name} is low — only ${p.stock} left`, to: '/analytics/inventory' })),
    ...(credits.length ? [{ text: `${credits.length} udhar payment${credits.length > 1 ? 's' : ''} overdue`, to: '/analytics/udhar' }] : []),
    ...(unread ? [{ text: `${unread} unread customer message${unread > 1 ? 's' : ''}`, to: '/analytics/messages' }] : []),
  ]
  res.json({
    shop: { name: shop.shopName || shop.name, category: shop.category || shop.workType, code, plan: 'Free' }, business,
    badges: { orders: open, messages: unread }, notifications,
  })
})

// ---------- Orders (a Bill is an order) ----------
export const listOrders = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const q = { shopId: sid(req) }
  if (STATUSES.includes(req.query.status)) q.orderStatus = req.query.status
  const bills = await Bill.find(q).sort({ createdAt: -1 }).limit(200).lean()
  const counts = await Sale.aggregate([{ $match: { shopId: sid(req), billId: { $in: bills.map((b) => b.billId) } } }, { $group: { _id: '$billId', items: { $sum: '$quantity' } } }])
  const items = Object.fromEntries(counts.map((c) => [c._id, c.items]))
  res.json(bills.map((b) => ({
    billId: b.billId, id: shortId(b), customerName: b.customerName || 'Walk-in', channel: b.channel, items: items[b.billId] || 0,
    total: b.totalAmount, unpaid: b.unpaidAmount, payment: payLabel(b), status: b.orderStatus, createdAt: b.createdAt,
  })))
})

export const updateOrderStatus = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  if (!STATUSES.includes(req.body.status)) return res.status(400).json({ message: 'Invalid status.' })
  const bill = await Bill.findOneAndUpdate({ shopId: sid(req), billId: req.params.billId }, { orderStatus: req.body.status }, { new: true })
  if (!bill) return res.status(404).json({ message: 'Order not found.' })
  res.json({ billId: bill.billId, status: bill.orderStatus })
})

// ---------- Offers ----------
export const listOffers = asyncHandler(async (req, res) => { if (!shopOnly(req, res)) res.json(await Offer.find({ shopId: sid(req) }).sort({ createdAt: -1 })) })
export const createOffer = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const { title, discountPercent, appliesTo, validUntil } = req.body
  if (!title?.trim() || !(Number(discountPercent) > 0)) return res.status(400).json({ message: 'Title and a discount % are required.' })
  res.status(201).json(await Offer.create({ shopId: sid(req), title, discountPercent: Math.min(Number(discountPercent), 100), appliesTo: appliesTo || 'All products', validUntil: validUntil || null }))
})
export const updateOffer = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const { title, discountPercent, appliesTo, validUntil, active } = req.body
  const patch = Object.fromEntries(Object.entries({ title, discountPercent, appliesTo, validUntil, active }).filter(([, v]) => v !== undefined))
  const offer = await Offer.findOneAndUpdate({ _id: req.params.offerId, shopId: sid(req) }, patch, { new: true })
  offer ? res.json(offer) : res.status(404).json({ message: 'Offer not found.' })
})
export const deleteOffer = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const r = await Offer.deleteOne({ _id: req.params.offerId, shopId: sid(req) })
  r.deletedCount ? res.json({ ok: true }) : res.status(404).json({ message: 'Offer not found.' })
})

// ---------- Messages ----------
export const listConversations = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const rows = await Message.aggregate([{ $match: { shopId: sid(req) } }, { $sort: { createdAt: -1 } },
    { $group: { _id: '$customerName', last: { $first: '$text' }, at: { $first: '$createdAt' }, unread: { $sum: { $cond: [{ $and: [{ $eq: ['$direction', 'in'] }, { $eq: ['$read', false] }] }, 1, 0] } } } },
    { $sort: { at: -1 } }])
  res.json(rows.map((r) => ({ name: r._id, last: r.last, at: r.at, unread: r.unread })))
})
export const getThread = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const q = { shopId: sid(req), customerName: req.params.customerName }
  await Message.updateMany({ ...q, direction: 'in', read: false }, { read: true })
  res.json(await Message.find(q).sort({ createdAt: 1 }).limit(200))
})
export const sendMessage = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const { customerName, text } = req.body
  if (!customerName || !text?.trim()) return res.status(400).json({ message: 'Message text is required.' })
  res.status(201).json(await Message.create({ shopId: sid(req), customerName, text, direction: 'out', read: true }))
})
