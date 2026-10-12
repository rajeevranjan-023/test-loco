import Shop from '../models/shop/Shop.js'
import ServiceProvider from '../models/services/ServiceProvider.js'
import StudyCenter from '../models/library/StudyCenter.js'
import { seatBoard } from '../utils/studyService.js'
import Product from '../models/common/Product.js'
import Bill from '../models/common/Bill.js'
import User from '../models/common/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { normalizeUsername } from '../utils/username.js'

const isOwnerOf = (req, shop) => !!req.user && String(req.user._id) === String(shop.userId)
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Shape of one product on the public profile. costPrice is for the owner only.
const productShape = (p, owner, mostSellingId) => ({
  id: p._id,
  name: p.name,
  category: p.category || 'Other',
  price: p.price,
  priceUnit: p.priceUnit,
  ...(owner ? { costPrice: p.costPrice } : {}),
  stock: p.stock,
  sold: p.sold,
  icon: p.icon,
  imageUrl: p.imageUrl,
  videoUrl: p.videoUrl,
  description: p.description,
  available: p.stock > 0,
  mostSelling: !!mostSellingId && p._id.toString() === mostSellingId && p.sold > 0,
})

// _________________________________________________________________________
// =========================================================================
// GET /api/profile/:username  (optionalAuth — so we can tell if the viewer follows this profile)
// ?lite=1 → skips the full product list (the shop page loads products through /:username/products instead).
export const getProfileByUsername = asyncHandler(async (req, res) => {
  const username = normalizeUsername(req.params.username)
  const lite = req.query.lite === '1'

  const shop = await Shop.findOne({ username })
  if (shop) {
    const [products, owner] = await Promise.all([
      Product.find({ shopId: shop._id, listed: { $ne: false } }).sort({ sold: -1 }),
      User.findById(shop.userId),
    ])
    const mostSellingId = products[0]?._id?.toString() || null

    // Category cards: "Dairy Products — 12 products"
    const catCount = new Map()
    products.forEach((p) => {
      const c = p.category || 'Other'
      catCount.set(c, (catCount.get(c) || 0) + 1)
    })
    const categories = [...catCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

    return res.json({
      ...shop.toPublicProfile(),
      bio: owner?.bio || '',
      ownerUserId: shop.userId,
      followingCount: owner?.following?.length || 0,
      isFollowing: req.user ? shop.followers.some((id) => id.toString() === req.user._id.toString()) : false,
      productCount: products.length,
      categories,
      ...(lite ? {} : { products: products.map((p) => productShape(p, isOwnerOf(req, shop), mostSellingId)) }),
    })
  }

  const center = await StudyCenter.findOne({ username })
  if (center) {
    const [owner, board] = await Promise.all([User.findById(center.userId), seatBoard(center)])
    const s = board.summary, plans = (center.config?.plans || []).filter((p) => p.active !== false)
    return res.json({
      ...center.toPublicProfile(), bio: owner?.bio || '', ownerUserId: center.userId, followingCount: owner?.following?.length || 0,
      isFollowing: req.user ? center.followers.some((id) => id.toString() === req.user._id.toString()) : false,
      seats: { total: s.total, available: s.empty + s.partial, partial: s.partial },           // public: availability only — never who sits where
      plans: plans.map((p) => ({ name: p.name, months: p.months, price: p.price })),
      timeSlots: (center.config?.timeSlots || []).map((t) => ({ label: t.label, start: t.start, end: t.end })),
    })
  }

  const provider = await ServiceProvider.findOne({ username })
  if (provider) {
    const owner = await User.findById(provider.userId)
    return res.json({
      ...provider.toPublicProfile(),
      bio: owner?.bio || '',
      ownerUserId: provider.userId,
      followingCount: owner?.following?.length || 0,
      isFollowing: req.user ? provider.followers.some((id) => id.toString() === req.user._id.toString()) : false,
    })
  }

  return res.status(404).json({ message: 'Profile not found.' })
})

// _________________________________________________________________________
// =========================================================================
// GET /api/profile/:username/products?q=&category=&availability=in|out&sort=latest|price_asc|price_desc|name|popular&page=&limit=
export const getShopProducts = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ username: normalizeUsername(req.params.username) })
  if (!shop) return res.status(404).json({ message: 'Shop not found.' })

  const { q = '', category = '', availability = '', sort = 'latest' } = req.query
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 48)
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1)

  const filter = { shopId: shop._id, listed: { $ne: false } }
  if (String(q).trim()) filter.name = { $regex: escapeRegex(String(q).trim().slice(0, 60)), $options: 'i' }
  if (category) filter.category = String(category)
  if (availability === 'in') filter.stock = { $gt: 0 }
  if (availability === 'out') filter.stock = { $lte: 0 }

  const sortBy = {
    latest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    name: { name: 1 },
    popular: { sold: -1 },
  }[sort] || { createdAt: -1 }

  const [items, total] = await Promise.all([
    Product.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ])
  const owner = isOwnerOf(req, shop)
  res.json({
    items: items.map((p) => productShape(p, owner, null)),
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
  })
})

// _________________________________________________________________________
// =========================================================================
// GET /api/profile/:username/similar?limit=4 — same-category shops first, then anyone else
export const getSimilarShops = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ username: normalizeUsername(req.params.username) })
  if (!shop) return res.status(404).json({ message: 'Shop not found.' })
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 12)

  let list = await Shop.find({ _id: { $ne: shop._id }, category: shop.category }).sort({ rating: -1 }).limit(limit)
  if (list.length < limit) {
    const more = await Shop.find({ _id: { $nin: [shop._id, ...list.map((s) => s._id)] } }).sort({ rating: -1 }).limit(limit - list.length)
    list = [...list, ...more]
  }
  res.json(
    list.map((s) => ({
      id: s._id,
      username: s.username,
      name: s.shopName,
      category: s.category,
      logoUrl: s.logoUrl,
      imageUrl: s.images?.[0] || s.bannerUrl || s.logoUrl || '',
      rating: s.rating,
      reviewCount: s.reviewCount,
      area: s.location?.area || '',
      district: s.location?.district || '',
    }))
  )
})

// _________________________________________________________________________
// =========================================================================
// GET /api/profile/:username/stats — owner-only (admins too): the "Total Products / Orders / Revenue / Rating" row
export const getShopStats = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ username: normalizeUsername(req.params.username) })
  if (!shop) return res.status(404).json({ message: 'Shop not found.' })
  if (!req.user || (!isOwnerOf(req, shop) && req.user.role !== 'admin')) {
    return res.status(403).json({ message: 'Only the shop owner can view these stats.' })
  }

  const live = { shopId: shop._id, orderStatus: { $ne: 'Cancelled' }, cancelledAt: null }
  const [totalProducts, categories, orders] = await Promise.all([
    Product.countDocuments({ shopId: shop._id, listed: { $ne: false } }),
    Product.distinct('category', { shopId: shop._id, listed: { $ne: false } }),
    Bill.aggregate([{ $match: live }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }]),
  ])
  res.json({
    totalProducts,
    totalCategories: categories.length,
    totalOrders: orders[0]?.orders || 0,
    totalRevenue: orders[0]?.revenue || 0,
    rating: shop.rating,
    reviewCount: shop.reviewCount,
  })
})
