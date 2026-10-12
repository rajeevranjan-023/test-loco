import Bill from '../models/common/Bill.js'
import BillDraft from '../models/common/BillDraft.js'
import Sale from '../models/common/Sale.js'
import Product from '../models/common/Product.js'
import Customer from '../models/common/Customer.js'
import Udhar from '../models/common/Udhar.js'
import UdharHistory from '../models/common/UdharHistory.js'
import { applyLedger, rebuildLedger, r2, EPS } from '../utils/ledger.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { paymentsOf } from '../utils/billPayments.js'
import { displayBillId } from '../utils/billId.js'
import { restoreToBatches, breakdownOfSale, withProduct, r3 } from '../utils/stock.js'

const STATUSES = ['New', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled']
// List order: Draft (always first, newest first) → New → Preparing → Out for Delivery → Cancelled → Delivered
const DAY = 864e5
const sid = (req) => req.sellerAccount._id
// Any seller account (shop OR service provider) uses the one billing / customer / inventory system.
const shopOnly = () => false
const short = (billId) => displayBillId(billId)
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const METHOD = { upi: 'UPI', cash: 'Cash', card: 'Card', udhar: 'Udhar' }

// How a bill's payment should be shown: Paid (green) · Pending ₹x (orange) · Udhar ₹x (purple) · Advance Used (blue)
function payInfo(b, { onLedger, acctBal }) {
  const method = METHOD[b.paymentMethod] || 'Cash'
  if (b.orderStatus === 'Cancelled') return { kind: 'void', amount: 0, method }
  const settled = acctBal !== undefined && acctBal <= EPS // customer's whole account is back to ₹0 / in advance
  if (b.unpaidAmount > EPS && !settled) return onLedger ? { kind: 'udhar', amount: r2(b.unpaidAmount), method } : { kind: 'pending', amount: r2(b.unpaidAmount), method }
  if ((b.creditUsed || 0) > EPS && r2(b.paidAmount - b.creditUsed) <= EPS) return { kind: 'advance', amount: r2(b.creditUsed), method: 'Advance' }
  return { kind: 'paid', amount: 0, method: method === 'Udhar' ? 'Cash' : method, advance: b.advanceAdded || 0 }
}

// context for a set of bills: which have udhar ledger lines, and each customer's current account
async function context(req, bills) {
  const ids = bills.map((b) => b.billId)
  const names = [...new Set(bills.filter((b) => b.unpaidAmount > 0 && b.customerName).map((b) => b.customerName))]
  const [ledgerIds, accts] = await Promise.all([
    ids.length ? UdharHistory.distinct('billId', { shopId: sid(req), type: 'udhar', billId: { $in: ids } }) : [],
    names.length ? Udhar.find({ shopId: sid(req), customerName: { $in: names } }).select('customerName totalAmount').lean() : [],
  ])
  return { ledger: new Set(ledgerIds), bal: Object.fromEntries(accts.map((a) => [a.customerName, a.totalAmount])) }
}

function dateRange(key) {
  const now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return { today: [t0, null], yesterday: [new Date(+t0 - DAY), t0], '7d': [new Date(+t0 - 6 * DAY), null], '30d': [new Date(+t0 - 29 * DAY), null], month: [new Date(now.getFullYear(), now.getMonth(), 1), null] }[key]
}

// GET /api/seller/orders?status&q&date&payment&sort&page&limit&export=1
export const listOrders = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const { status, q, date, payment, sort } = req.query
  const base = { shopId: sid(req) }

  const text = String(q || '').trim().slice(0, 40)
  if (text) {
    const hex = text.replace(/^#?(ord)?/i, '') // matches new ids (261003A0101) and legacy hex ids
    const or = [{ customerName: new RegExp(esc(text), 'i') }, { customerPhone: new RegExp(esc(text)) }]
    if (/^[0-9a-z]{2,24}$/i.test(hex)) or.push({ billId: new RegExp(esc(hex), 'i') })
    base.$or = or
  }
  const rng = dateRange(date)
  if (rng) base.createdAt = { $gte: rng[0], ...(rng[1] ? { $lt: rng[1] } : {}) }
  if (payment === 'cash' || payment === 'upi' || payment === 'card') base.paymentMethod = payment
  else if (payment === 'udhar') base.unpaidAmount = { $gt: EPS }
  else if (payment === 'advance') base.$and = [{ $or: [{ creditUsed: { $gt: 0 } }, { advanceAdded: { $gt: 0 } }] }]

  const filter = { ...base }
  const onlyDrafts = status === 'Draft'
  if (STATUSES.includes(status)) filter.orderStatus = status
  if (onlyDrafts) filter.billId = { $in: [] } // the Draft tab shows drafts only
  const byStatus = !sort || sort === 'status' // default list order: New → Preparing → Out for Delivery → Cancelled → Delivered (newest first inside each)
  const order = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, amount_desc: { totalAmount: -1 }, amount_asc: { totalAmount: 1 }, customer: { customerName: 1, createdAt: -1 } }[sort] || { createdAt: -1 }
  const exporting = req.query.export === '1'
  const limit = exporting ? 2000 : Math.min(parseInt(req.query.limit, 10) || 10, 50)
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1)

  const PRIORITY = { $switch: { branches: [['New', 1], ['Preparing', 2], ['Out for Delivery', 3], ['Cancelled', 4], ['Delivered', 5]].map(([s, n]) => ({ case: { $eq: ['$orderStatus', s] }, then: n })), default: 6 } }
  const [bills, total, grouped] = await Promise.all([
    byStatus
      ? Bill.aggregate([{ $match: filter }, { $addFields: { _p: PRIORITY } }, { $sort: { _p: 1, createdAt: -1 } }, { $skip: exporting ? 0 : (page - 1) * limit }, { $limit: limit }])
      : Bill.find(filter).sort(order).skip(exporting ? 0 : (page - 1) * limit).limit(limit).lean(),
    Bill.countDocuments(filter),
    Bill.aggregate([{ $match: base }, { $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
  ])
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])); grouped.forEach((g) => (counts[g._id] = g.n))
  // drafts live in their own collection (no stock / ledger / analytics effect) and are merged in on top
  const dFilter = { shopId: sid(req) }
  if (text) dFilter.$or = [{ customerName: new RegExp(esc(text), 'i') }, { customerPhone: new RegExp(esc(text)) }]
  if (rng) dFilter.updatedAt = { $gte: rng[0], ...(rng[1] ? { $lt: rng[1] } : {}) }
  const wantDrafts = (!status || onlyDrafts || status === 'All') && !payment
  const draftDocs = wantDrafts ? await BillDraft.find(dFilter).sort({ updatedAt: -1 }).limit(100).lean() : []
  counts.Draft = wantDrafts ? draftDocs.length : 0
  counts.All = Object.values(counts).reduce((a, b) => a + b, 0)

  // item previews (first 3 products + "+N more")
  const lines = bills.length ? await Sale.find({ shopId: sid(req), billId: { $in: bills.map((b) => b.billId) } }).select('billId productId quantity').lean() : []
  const prods = lines.length ? await Product.find({ _id: { $in: [...new Set(lines.map((l) => String(l.productId)))] } }).select('name icon imageUrl').lean() : []
  const pmap = Object.fromEntries(prods.map((p) => [String(p._id), p]))
  const byBill = {}; lines.forEach((l) => (byBill[l.billId] ||= []).push(l))
  const ctx = await context(req, bills)
  // customer ids for the clickable name/phone (bills created before customerId existed are matched by name)
  const missing = [...new Set(bills.filter((b) => !b.customerId && b.customerName).map((b) => b.customerName))]
  const byName = missing.length ? Object.fromEntries((await Customer.find({ shopId: sid(req), name: { $in: missing } }).select('name').lean()).map((c) => [c.name, c._id])) : {}

  const rows = bills.map((b) => {
    const snap = b.items?.length ? b.items : null
    const ls = byBill[b.billId] || []
    return {
      billId: b.billId, id: short(b.billId), customerId: b.customerId || byName[b.customerName] || null, customerName: b.customerName || 'Walk-in', phone: b.customerPhone || '', channel: b.channel, amount: b.totalAmount,
      transactionType: b.transactionType || 'sale',
      itemCount: snap ? snap.length : ls.length, units: ls.reduce((s, l) => s + l.quantity, 0), more: Math.max((snap ? snap.length : ls.length) - 3, 0),
      preview: snap ? snap.slice(0, 3).map((i) => ({ name: i.name, icon: { product: '🛒', material: '🔩', service: '🛠️', labour: '👷', other: '➕' }[i.type] || '🛒', imageUrl: '' })) : ls.slice(0, 3).map((l) => ({ name: pmap[String(l.productId)]?.name || 'Item', icon: pmap[String(l.productId)]?.icon || '🛒', imageUrl: pmap[String(l.productId)]?.imageUrl || '' })),
      payment: payInfo(b, { onLedger: ctx.ledger.has(b.billId), acctBal: ctx.bal[b.customerName] }), status: b.orderStatus, createdAt: b.createdAt, notes: b.notes || '',
    }
  })

  // summary cards (whole shop, month-over-month on orders created)
  const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1), p0 = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const [tot, cur, prev] = await Promise.all([
    Bill.aggregate([{ $match: { shopId: sid(req) } }, { $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
    Bill.aggregate([{ $match: { shopId: sid(req), createdAt: { $gte: m0 } } }, { $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
    Bill.aggregate([{ $match: { shopId: sid(req), createdAt: { $gte: p0, $lt: m0 } } }, { $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
  ])
  const m = (a) => Object.fromEntries(a.map((x) => [x._id, x.n]))
  const T = m(tot), C = m(cur), P = m(prev), sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)
  const pct = (c, p) => (p ? Math.round(((c - p) / p) * 100) : c ? 100 : 0)
  const card = (count, c, p) => ({ count, pct: pct(c, p) })
  const summary = {
    total: card(sum(T), sum(C), sum(P)), new: card(T.New || 0, C.New || 0, P.New || 0), preparing: card(T.Preparing || 0, C.Preparing || 0, P.Preparing || 0),
    out: card(T['Out for Delivery'] || 0, C['Out for Delivery'] || 0, P['Out for Delivery'] || 0), delivered: card(T.Delivered || 0, C.Delivered || 0, P.Delivered || 0),
  }
  const draftRows = (page === 1 || onlyDrafts) && !exporting ? draftDocs.map((d) => ({
    isDraft: true, draftId: d._id, billId: `draft-${d._id}`, id: 'DRAFT', customerId: d.customerId || null, customerName: d.customerName || 'Walk-in', phone: d.customerPhone || '', channel: 'offline', amount: d.total,
    itemCount: d.itemCount, units: 0, more: Math.max(d.itemCount - 3, 0), preview: (d.state?.items || []).slice(0, 3).map((i) => ({ name: i.name, icon: '🛒', imageUrl: '' })),
    payment: { kind: 'draft', amount: 0, method: '' }, status: 'Draft', createdAt: d.updatedAt, notes: d.state?.notes || '',
  })) : []
  res.json({ orders: [...draftRows, ...rows], total: total + (onlyDrafts ? draftDocs.length : 0), page, pages: Math.max(Math.ceil(total / limit), 1), limit, counts, summary })
})

// ----- shared: undo everything an order did (stock + udhar/advance ledger) -----
async function reverseOrder(req, bill, { removeDocs }) {
  const shopId = sid(req)
  const lines = await Sale.find({ shopId, billId: bill.billId, cancelled: { $ne: true } })
  for (const l of lines) {
    // Stock goes back into the very batches the sale drew from (re-opening exhausted ones), at their original cost.
    await withProduct({ _id: l.productId, shopId }, (p) => {
      restoreToBatches(p, breakdownOfSale(l), l.createdAt)
      p.sold = Math.max(r3((p.sold || 0) - l.quantity), 0)
      if (p.listed === false) p.billedCount = Math.max((p.billedCount || 1) - 1, 0)
    })
  }
  // Service materials were consumed from the same batches (no Sale row) — give them back too.
  for (const it of (bill.items || []).filter((i) => i.type === 'material' && i.refId)) {
    await withProduct({ _id: it.refId, shopId }, (p) => {
      restoreToBatches(p, it.costBreakdown || [], bill.createdAt)
      p.consumed = Math.max(r3((p.consumed || 0) - it.qty), 0)
    })
  }
  const entries = await UdharHistory.find({ shopId, billId: bill.billId }).select('customerId').lean()
  const cids = [...new Set(entries.map((e) => String(e.customerId)))]
  if (entries.length) await UdharHistory.deleteMany({ shopId, billId: bill.billId })
  for (const cid of cids) await rebuildLedger(shopId, cid)
  if (removeDocs) { await Sale.deleteMany({ shopId, billId: bill.billId }); await Bill.deleteOne({ _id: bill._id }) }
  else await Sale.updateMany({ shopId, billId: bill.billId }, { $set: { cancelled: true } })
}

// PATCH /api/seller/orders/:billId/status  { status }
export const updateOrderStatus = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const status = req.body.status
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status.' })
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.billId })
  if (!bill) return res.status(404).json({ message: 'Order not found.' })
  if (bill.orderStatus === 'Cancelled') return res.status(400).json({ message: 'A cancelled order cannot be changed.' })
  if (status === 'Cancelled') { await reverseOrder(req, bill, { removeDocs: false }); bill.cancelledAt = new Date() }
  bill.orderStatus = status
  await bill.save()
  res.json({ billId: bill.billId, status: bill.orderStatus })
})

// PATCH /api/seller/orders/:billId  { notes, channel }  — the "Edit" action
export const editOrder = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const patch = {}
  if (req.body.notes !== undefined) patch.notes = String(req.body.notes).slice(0, 300)
  if (['online', 'offline'].includes(req.body.channel)) patch.channel = req.body.channel
  const bill = await Bill.findOneAndUpdate({ shopId: sid(req), billId: req.params.billId }, patch, { new: true })
  if (!bill) return res.status(404).json({ message: 'Order not found.' })
  if (patch.channel) await Sale.updateMany({ shopId: sid(req), billId: bill.billId }, { channel: patch.channel })
  res.json({ billId: bill.billId, notes: bill.notes, channel: bill.channel })
})

// DELETE /api/seller/orders/:billId — removes the order, returns stock, and reverses its udhar/advance entries
export const deleteOrder = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.billId })
  if (!bill) return res.status(404).json({ message: 'Order not found.' })
  if (bill.orderStatus === 'Cancelled') { await Sale.deleteMany({ shopId: sid(req), billId: bill.billId }); await Bill.deleteOne({ _id: bill._id }) }
  else await reverseOrder(req, bill, { removeDocs: true })
  res.json({ ok: true })
})

// GET /api/seller/orders/:billId — everything the /bill/:id page shows
export const getOrder = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.billId }).lean()
  if (!bill) return res.status(404).json({ message: 'Bill not found.' })
  const [sales, entries, cust] = await Promise.all([
    Sale.find({ shopId: sid(req), billId: bill.billId }).populate('productId', 'name icon imageUrl').lean(),
    UdharHistory.find({ shopId: sid(req), billId: bill.billId }).sort({ date: 1, createdAt: 1 }).lean(),
    bill.customerName ? Customer.findOne({ shopId: sid(req), name: bill.customerName }).lean() : null,
  ])
  const acct = cust ? await Udhar.findOne({ shopId: sid(req), customerId: cust._id }).lean() : null
  const bal = acct?.totalAmount ?? 0
  const ctx = await context(req, [bill])
  const lines = bill.items?.length
    ? bill.items.map((i) => ({ type: i.type, name: i.name, icon: { product: '🛒', material: '🔩', service: '🛠️', labour: '👷', other: '➕' }[i.type] || '🛒', imageUrl: '', qty: i.qty, unit: i.unit, price: i.rate, total: i.total, description: i.description || '', charge: i.charge || 'charged', discount: i.discount || 0 }))
    : sales.map((l) => ({ name: l.productId?.name || 'Item', icon: l.productId?.icon || '🛒', imageUrl: l.productId?.imageUrl || '', qty: l.quantity, unit: l.unit, price: l.priceAtSale, total: r2(l.quantity * l.priceAtSale) }))
  const subtotal = bill.subtotal ?? r2(lines.reduce((s, l) => s + l.total, 0)) // universal bills store their own (pre-discount, pre-tax) subtotal
  const pay = payInfo(bill, { onLedger: ctx.ledger.has(bill.billId), acctBal: cust ? bal : undefined })
  const cashPaid = r2(bill.paidAmount - (bill.creditUsed || 0))
  const statusKey = bill.advanceAdded > 0 ? 'advance' : pay.kind === 'udhar' || pay.kind === 'pending' ? 'udhar' : 'paid'
  // customer's balance right after this bill: stored value, else the last ledger line of this bill, else the latest line before it
  let balanceAfter = bill.balanceAfter ?? null
  if (balanceAfter === null && cust) {
    const own = entries.length ? entries[entries.length - 1].balanceAfter : null
    const before = own === null ? await UdharHistory.findOne({ shopId: sid(req), customerId: cust._id, date: { $lte: bill.createdAt } }).sort({ date: -1, createdAt: -1 }).select('balanceAfter').lean() : null
    balanceAfter = own ?? before?.balanceAfter ?? 0
  }
  res.json({
    id: short(bill.billId), billId: bill.billId, date: bill.createdAt, status: bill.orderStatus, statusKey, balanceAfter, customerId: cust?._id || null, channel: bill.channel, notes: bill.notes || '', method: METHOD[bill.paymentMethod] || 'Cash', payment: pay,
    customer: { id: cust?._id || null, name: bill.customerName || 'Walk-in', phone: bill.customerPhone || cust?.phone || '', udharDue: Math.max(bal, 0), advance: Math.max(-bal, 0) },
    lines, transactionType: bill.transactionType || 'sale', context: bill.context || [], payments: await paymentsOf(bill),
    summary: {
      subtotal, discount: bill.subtotal != null ? bill.discount || 0 : Math.max(r2(subtotal - bill.totalAmount), 0), tax: bill.taxAmount || 0, taxName: bill.taxName || '', total: bill.totalAmount, advanceUsed: bill.creditUsed || 0, received: bill.receivedAmount ?? cashPaid, returned: bill.returnedAmount ?? 0, paid: bill.paidAmount,
      unpaid: pay.kind === 'paid' || pay.kind === 'advance' ? 0 : bill.unpaidAmount, advanceAdded: bill.advanceAdded || 0,
    },
    ledger: entries.map((e) => ({ type: e.type, amount: e.amount, delta: e.delta, date: e.date, note: e.note, paymentType: e.paymentType })),
  })
})

// POST /api/seller/orders/:billId/payment  { amount, paymentType }  — "Add Payment" on a pending/udhar bill
export const addOrderPayment = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.billId })
  if (!bill) return res.status(404).json({ message: 'Order not found.' })
  if (bill.orderStatus === 'Cancelled') return res.status(400).json({ message: 'This order is cancelled.' })
  if (!(bill.unpaidAmount > EPS)) return res.status(400).json({ message: 'Nothing is pending on this bill.' })
  const amount = r2(Number(req.body.amount))
  if (!(amount > 0)) return res.status(400).json({ message: 'Enter a payment amount.' })
  const cust = bill.customerName ? await Customer.findOne({ shopId: sid(req), name: bill.customerName }) : null
  const pt = ['cash', 'upi', 'card'].includes(req.body.paymentType) ? req.body.paymentType : 'cash'
  const applied = r2(Math.min(amount, bill.unpaidAmount))
  let result = null
  // with a saved customer the payment goes through the ledger (anything above what's owed becomes Advance Balance)
  if (cust) result = await applyLedger({ shopId: sid(req), customer: cust, type: 'payment', amount, source: 'manual', billId: bill.billId, paymentType: pt, note: `Payment · Bill ${short(bill.billId)}` })
  bill.paidAmount = r2(bill.paidAmount + applied)
  bill.unpaidAmount = r2(bill.unpaidAmount - applied)
  bill.paymentStatus = bill.unpaidAmount <= EPS ? 'paid' : 'partial'
  bill.status = bill.unpaidAmount > EPS ? 'udhar' : bill.advanceAdded > 0 ? 'advance' : 'paid'
  await bill.save()
  res.json({ billId: bill.billId, paid: bill.paidAmount, unpaid: bill.unpaidAmount, paymentStatus: bill.paymentStatus, extraToAdvance: r2(amount - applied), balance: result?.udhar.totalAmount ?? null })
})

// POST /api/bills/:id/convert-paid  { paymentType? } — settle whatever is still pending on the bill in one tap
export const convertPaid = asyncHandler(async (req, res, next) => {
  if (shopOnly(req, res)) return
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.billId }).select('unpaidAmount orderStatus').lean()
  if (!bill) return res.status(404).json({ message: 'Bill not found.' })
  if (!(bill.unpaidAmount > EPS)) return res.status(400).json({ message: 'This bill is already fully paid.' })
  req.body = { ...req.body, amount: bill.unpaidAmount }
  return addOrderPayment(req, res, next)
})
