import Bill from '../models/common/Bill.js'
import Sale from '../models/common/Sale.js'
import Product from '../models/common/Product.js'
import Credit from '../models/shop/Credit.js'
import Message from '../models/shop/Message.js'
import { payLabel } from '../utils/payLabel.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { displayBillId } from '../utils/billId.js'

const DAY = 864e5
const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0)
const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0)
const ago = (d) => {
  const m = Math.max(1, Math.round((Date.now() - d) / 6e4))
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hour${m >= 120 ? 's' : ''} ago` : `${Math.round(m / 1440)} d ago`
}

// GET /api/seller/dashboard?days=30   (protect + requireSeller → req.sellerAccount is the Shop)
export const getDashboard = asyncHandler(async (req, res) => {
  if (req.sellerType !== 'shop') return res.status(400).json({ message: 'The analytics dashboard is available for shops.' })
  const shop = req.sellerAccount
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)
  const now = Date.now(), start = new Date(now - days * DAY), prevStart = new Date(now - 2 * days * DAY)
  const q = { shopId: shop._id, createdAt: { $gte: prevStart } }

  const [bills, sales, products, credits, firstSeen, unread] = await Promise.all([
    Bill.find(q).sort({ createdAt: -1 }).lean(),
    Sale.find(q).populate('productId', 'name category icon imageUrl').lean(),
    Product.find({ shopId: shop._id, listed: { $ne: false } }).lean(),
    Credit.find({ shopId: shop._id, paid: false }).lean(),
    Bill.aggregate([{ $match: { shopId: shop._id, customerName: { $ne: '' } } }, { $group: { _id: '$customerName', first: { $min: '$createdAt' } } }]),
    Message.countDocuments({ shopId: shop._id, direction: 'in', read: false }),
  ])
  const inCur = (x) => x.createdAt >= start
  const curBills = bills.filter(inCur), prevBills = bills.filter((b) => !inCur(b))
  const curSales = sales.filter(inCur), prevSales = sales.filter((s) => !inCur(s))
  const salesTotal = (a) => sum(a, (b) => b.totalAmount)
  const unitsOf = (a) => sum(a, (s) => s.quantity)

  // bars = daily revenue, line = daily orders
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(now - (days - 1 - i) * DAY); day.setHours(0, 0, 0, 0)
    const end = new Date(+day + DAY), d = curBills.filter((b) => b.createdAt >= day && b.createdAt < end)
    return { label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), sales: salesTotal(d), orders: d.length }
  })

  // category split, top products, top customers
  const cat = {}, prod = {}, cust = {}
  curSales.forEach((s) => {
    const p = s.productId || {}, rev = s.priceAtSale * s.quantity
    const c = p.category || 'Other'; cat[c] = (cat[c] || 0) + rev
    const t = (prod[p.name || 'Item'] ||= { name: p.name || 'Item', units: 0, revenue: 0, imageUrl: p.imageUrl, icon: p.icon }); t.units += s.quantity; t.revenue += rev
  })
  curBills.forEach((b) => {
    const n = b.customerName || 'Walk-in'
    const c = (cust[n] ||= { name: n, orders: 0, spent: 0 }); c.orders++; c.spent += b.totalAmount
  })
  const catTotal = sum(Object.values(cat), (v) => v) || 1
  const categories = Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, pct: Math.round((value / catTotal) * 100) }))

  // customers / repeat / AOV
  const newCur = firstSeen.filter((c) => c.first >= start).length, newPrev = firstSeen.filter((c) => c.first >= prevStart && c.first < start).length
  const countBy = (a) => a.reduce((m, b) => ((m[b.customerName] = (m[b.customerName] || 0) + 1), m), {})
  const repeatOf = (a) => Object.entries(countBy(a)).filter(([n, c]) => n && c > 1).length
  const buyers = Object.keys(countBy(curBills)).filter(Boolean).length || 1
  const aov = curBills.length ? salesTotal(curBills) / curBills.length : 0, aovPrev = prevBills.length ? salesTotal(prevBills) / prevBills.length : 0
  const udharNow = sum(credits.filter(inCur), (c) => c.amount), udharPrev = sum(credits.filter((c) => !inCur(c)), (c) => c.amount)

  res.json({
    shop: { name: shop.shopName, code: `#${String(shop.username).slice(0, 3).toUpperCase()}${String(shop._id).slice(-3).toUpperCase()}`, plan: 'Free' },
    range: `${fmt(start)} - ${fmt(new Date())}`,
    badges: { orders: bills.filter((b) => b.orderStatus !== 'Delivered').length, messages: unread },
    kpis: {
      sales: { value: salesTotal(curBills), growth: pct(salesTotal(curBills), salesTotal(prevBills)) },
      orders: { value: curBills.length, growth: pct(curBills.length, prevBills.length) },
      customers: { value: newCur, growth: pct(newCur, newPrev) },
      udhar: { value: sum(credits, (c) => c.amount), growth: pct(udharNow, udharPrev) },
    },
    extra: {
      aov, aovGrowth: pct(aov, aovPrev), repeatPct: Math.round((repeatOf(curBills) / buyers) * 100), repeatGrowth: pct(repeatOf(curBills), repeatOf(prevBills)),
      unitsSold: unitsOf(curSales), unitsGrowth: pct(unitsOf(curSales), unitsOf(prevSales)), rating: shop.rating, reviews: shop.reviewCount,
    },
    series, categories,
    recentOrders: bills.slice(0, 5).map((b) => ({ id: displayBillId(b.billId), total: b.totalAmount, status: b.orderStatus, payment: payLabel(b), ago: ago(b.createdAt) })),
    lowStock: products.filter((p) => p.stock <= (p.lowStockAt ?? 10)).sort((a, b) => a.stock - b.stock).slice(0, 5).map((p) => ({ name: p.name, stock: p.stock, imageUrl: p.imageUrl, icon: p.icon })),
    topProducts: Object.values(prod).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    topCustomers: Object.values(cust).filter((c) => c.name !== 'Walk-in').sort((a, b) => b.spent - a.spent).slice(0, 5),
  })
})
