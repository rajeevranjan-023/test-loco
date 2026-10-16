import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import Customer from '../models/Customer.js'
import Bill from '../models/Bill.js'
import Sale from '../models/Sale.js'
import { applyLedger, statusOf, EPS } from '../utils/ledger.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { displayBillId } from '../utils/billId.js'
import { validateUdharPhotos } from '../middleware/upload.js'
import { storePhotos, removePhotos, photosConfigured, publicPhotos } from '../utils/udharPhotos.js'

const DAY = 864e5
const sid = (req) => req.sellerAccount._id
// Any seller account (shop OR service provider) uses the one billing / customer / inventory system.
const shopOnly = () => false
const r2 = (n) => Math.round(n * 100) / 100
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortId = (b) => displayBillId(b, '#ORD')

// kind of a notebook line, as shown in history: udhar (+) · payment (−) · advance (+) · advance_used (−)
const kindOf = (e) => (e.type === 'adjustment' ? 'adjustment' : e.type === 'credit' ? (e.delta > 0 ? 'advance_used' : 'advance') : e.type)

const entryOut = (e) => ({ id: e._id, customerId: e.customerId, type: e.type, amount: e.amount, delta: e.delta, balanceAfter: e.balanceAfter, date: e.date, note: e.note, photos: publicPhotos(e) })
const row = (u, now = Date.now()) => ({
  id: u.customerId, name: u.customerName, phone: u.phone || '', total: u.totalAmount, pinned: !!u.pinned,
  status: statusOf(u.totalAmount), advance: u.totalAmount < -EPS ? Math.round(-u.totalAmount * 100) / 100 : 0,
  lastUpdated: u.lastUpdated, lastAdded: u.lastAddedAt, lastCleared: u.clearedAt,
  pendingSince: u.pendingSince, days: u.totalAmount > 0 && u.pendingSince ? Math.max(0, Math.floor((now - +u.pendingSince) / DAY)) : 0,
})

// GET /api/seller/udhar/overview?from=YYYY-MM-DD&to=YYYY-MM-DD&bucket=day|month
export const overview = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const now = Date.now()
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : new Date(now)
  const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : new Date(new Date(now).getFullYear(), 0, 1)
  if (isNaN(+from) || isNaN(+to) || +from > +to) return res.status(400).json({ message: 'Invalid date range.' })
  if (+to - +from > 800 * DAY) return res.status(400).json({ message: 'Range too long (max ~2 years).' })
  const bucket = req.query.bucket === 'day' ? 'day' : 'month'

  const [all, hist] = await Promise.all([
    Udhar.find({ shopId: sid(req) }).lean(),
    UdharHistory.find({ shopId: sid(req), type: { $in: ['udhar', 'payment'] }, date: { $gte: from, $lte: to } }).select('type amount date').lean(),
  ])
  const rows = all.map((u) => row(u, now))
  const pending = rows.filter((r) => r.status === 'pending'), advance = rows.filter((r) => r.status === 'advance'), cleared = rows.filter((r) => r.status === 'cleared')
  const overdue = pending.filter((r) => r.days > 7)

  // trend buckets
  const key = (d) => (bucket === 'day' ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : `${d.getFullYear()}-${d.getMonth()}`)
  const points = [], idx = {}
  const cur = new Date(from); bucket === 'month' ? cur.setDate(1) : cur.setHours(0, 0, 0, 0)
  const multiYear = from.getFullYear() !== to.getFullYear()
  while (+cur <= +to) {
    const label = bucket === 'day' ? `${cur.getDate()} ${MON[cur.getMonth()]}` : multiYear ? `${MON[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}` : MON[cur.getMonth()]
    idx[key(cur)] = points.push({ label, given: 0, recovered: 0 }) - 1
    bucket === 'day' ? cur.setDate(cur.getDate() + 1) : cur.setMonth(cur.getMonth() + 1)
  }
  let recovered = 0
  hist.forEach((h) => { const p = points[idx[key(new Date(h.date))]]; if (!p) return; if (h.type === 'udhar') p.given += h.amount; else { p.recovered += h.amount; recovered += h.amount } })
  points.forEach((p) => { p.given = Math.round(p.given); p.recovered = Math.round(p.recovered) })

  res.json({
    range: { from, to, bucket },
    kpis: {
      pending: { amount: r2(pending.reduce((s, r) => s + r.total, 0)), customers: pending.length },
      recovered: { amount: Math.round(recovered) },
      advance: { amount: Math.round(advance.reduce((s, r) => s + r.advance, 0) * 100) / 100, customers: advance.length },
      totalCustomers: rows.length,
      overdue: { amount: r2(overdue.reduce((s, r) => s + r.total, 0)), customers: overdue.length },
    },
    trend: points,
    pinned: pending.filter((r) => r.pinned).sort((a, b) => b.total - a.total).slice(0, 4),
    pending: pending.sort((a, b) => +new Date(b.lastAdded || 0) - +new Date(a.lastAdded || 0)),
    advance: advance.sort((a, b) => +new Date(b.lastUpdated || 0) - +new Date(a.lastUpdated || 0)),
    cleared: cleared.sort((a, b) => +new Date(b.lastCleared || 0) - +new Date(a.lastCleared || 0)),
  })
})

// POST /api/seller/udhar/entries  { customerId | (name, phone), type: udhar|payment|credit, amount, paymentType, note, clientRequestId? }
const inFlight = new Set() // ids being saved right now in this process (a double-tap / fast retry can not run twice in parallel)
const cleanRequestId = (v) => (/^[A-Za-z0-9_-]{8,64}$/.test(String(v || '')) ? String(v) : null)
const fail = (status, message, code) => Object.assign(new Error(message), { status, expose: true, ...(code ? { code } : {}) })

export const addEntry = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const { customerId, name, phone, type, amount, paymentType, note } = req.body
  if (!['udhar', 'payment', 'credit'].includes(type)) return res.status(400).json({ message: 'Type must be udhar, payment or credit.' })
  const files = req.files || []
  const requestId = type === 'udhar' ? cleanRequestId(req.body.clientRequestId) : null

  // ── photos: validated up front, before anything is uploaded or saved ──
  if (files.length) {
    if (type !== 'udhar') return res.status(400).json({ message: 'Photos can only be attached to an Udhar entry.' })
    const bad = validateUdharPhotos(files)
    if (bad) return res.status(400).json({ message: bad })
    if (!(r2(Number(amount)) > 0)) return res.status(400).json({ message: 'Amount must be greater than 0.' })
    if (!photosConfigured()) return res.status(503).json({ message: 'Photo uploads are not set up on the server yet. Save the entry without photos, or ask the admin to configure Cloudinary.' })
  }

  // ── retry of an entry that was already saved → hand back that one, change nothing ──
  if (requestId) {
    const prior = await UdharHistory.find({ shopId: sid(req), clientRequestId: requestId }).sort({ createdAt: 1 }).lean()
    if (prior.length) {
      const u = await Udhar.findOne({ shopId: sid(req), customerId: prior[0].customerId }).lean()
      return res.status(200).json({ row: u ? row(u) : null, entries: prior.map(entryOut), replayed: true })
    }
    if (inFlight.has(`${sid(req)}:${requestId}`)) return res.status(409).json({ message: 'This entry is already being saved. Please wait a moment.', code: 'ALREADY_SAVING' })
    inFlight.add(`${sid(req)}:${requestId}`)
  }

  let uploaded = []
  try {
    let customer = null
    const newName = String(name || '').trim()
    if (customerId) customer = await Customer.findOne({ _id: customerId, shopId: sid(req) })
    else if (newName) {
      if (phone && !/^\d{10}$/.test(String(phone))) return res.status(400).json({ message: 'Mobile number must be 10 digits.' })
    }
    if (!customer && !(newName && !customerId)) return res.status(400).json({ message: 'Choose a customer.' })

    if (files.length) uploaded = await storePhotos(files, sid(req)) // all or nothing — throws (and cleans up) if any photo fails

    if (!customer) customer = await Customer.findOneAndUpdate({ shopId: sid(req), name: newName }, { $setOnInsert: { shopId: sid(req), name: newName }, ...(phone ? { $set: { phone } } : {}) }, { upsert: true, new: true })
    let result
    try {
      result = await applyLedger({ shopId: sid(req), customer, type, amount, source: 'manual', paymentType: ['cash', 'upi', 'card'].includes(paymentType) ? paymentType : 'cash', note: String(note || '').slice(0, 300), meta: { ...(uploaded.length ? { photos: uploaded } : {}), ...(requestId ? { clientRequestId: requestId } : {}) } })
    } catch (e) { await removePhotos(uploaded); throw e } // the entry was not saved → its freshly uploaded photos must not be left behind
    res.status(201).json({ row: row(result.udhar), entries: result.entries })
  } finally { if (requestId) inFlight.delete(`${sid(req)}:${requestId}`) }
})

// GET /api/seller/udhar/customers/:id/history   (oldest → newest, like a notebook)
export const customerHistory = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const [u, entries] = await Promise.all([
    Udhar.findOne({ shopId: sid(req), customerId: req.params.id }).lean(),
    UdharHistory.find({ shopId: sid(req), customerId: req.params.id }).sort({ date: 1, createdAt: 1 }).lean(),
  ])
  if (!u) return res.status(404).json({ message: 'No udhar account for this customer.' })
  res.json({
    customer: row(u),
    entries: entries.map((e) => ({
      id: e._id, type: e.type, kind: kindOf(e), amount: e.amount, source: e.source, date: e.date, balanceAfter: e.balanceAfter, paymentType: e.paymentType, note: e.note,
      photos: publicPhotos(e), billId: e.billId ? shortId(e.billId) : null, summary: (e.items || []).map((i) => i.name.replace(/\s*\([^)]*\)\s*$/, '')).slice(0, 3).join(', '),
    })),
  })
})

// GET /api/seller/udhar/entries/:entryId — everything about one notebook line
export const entryDetail = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const e = await UdharHistory.findOne({ _id: req.params.entryId, shopId: sid(req) }).lean()
  if (!e) return res.status(404).json({ message: 'Entry not found.' })
  let items = (e.items || []).map((i) => ({ name: i.name, qty: i.qty, price: i.price, total: r2(i.qty * i.price) }))
  let billTotal = null
  if (e.billId) {
    const bill = await Bill.findOne({ shopId: sid(req), billId: e.billId }).select('totalAmount').lean()
    billTotal = bill?.totalAmount ?? null
    if (!items.length) { const lines = await Sale.find({ shopId: sid(req), billId: e.billId }).populate('productId', 'name').lean(); items = lines.map((l) => ({ name: l.productId?.name || 'Item', qty: l.quantity, price: l.priceAtSale, total: r2(l.quantity * l.priceAtSale) })) }
  }
  res.json({ id: e._id, type: e.type, kind: kindOf(e), delta: e.delta, amount: e.amount, source: e.source, addedBy: e.source === 'billing' ? 'Billing' : 'Manual (Udhar dashboard)', date: e.date, billId: e.billId ? shortId(e.billId) : null, billRef: e.billId, billTotal, paymentType: e.paymentType, note: e.note, balanceAfter: e.balanceAfter, items, photos: publicPhotos(e) })
})

// PATCH /api/seller/udhar/customers/:id/pin  { pinned }  — max 4 pinned
export const setPinned = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const pinned = !!req.body.pinned
  if (pinned) {
    const n = await Udhar.countDocuments({ shopId: sid(req), pinned: true, customerId: { $ne: req.params.id }, totalAmount: { $gt: 0 } })
    if (n >= 4) return res.status(409).json({ message: 'You can pin up to 4 customers. Unpin one first.' })
  }
  const u = await Udhar.findOneAndUpdate({ shopId: sid(req), customerId: req.params.id }, { pinned }, { new: true })
  u ? res.json(row(u)) : res.status(404).json({ message: 'Customer not found.' })
})
