import Bill from '../models/Bill.js'
import Customer from '../models/Customer.js'
import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import Sale from '../models/Sale.js'
import Shop from '../models/shop/Shop.js'
import { statusOf, EPS, r2, applyLedger } from '../utils/ledger.js'
import { displayBillId } from '../utils/billId.js'

const sid = (req) => req.sellerAccount._id
// Any seller account (shop OR service provider) uses the one billing / customer / inventory system.
const shopOnly = () => false
const orderId = (b) => displayBillId(b.billId, '#ORD')
const METHOD = { upi: 'UPI', cash: 'Cash', card: 'Card', udhar: 'Udhar' }
const methodOf = (b) => (b.creditId || b.unpaidAmount > 0 ? 'Udhar' : METHOD[b.paymentMethod] || 'Cash')
const billStatus = (b, bal) => (b.advanceAdded > 0 ? 'Advance' : b.unpaidAmount > 0 && !(bal !== undefined && bal <= EPS) ? 'Pending' : 'Cleared')

// Money fields every customer response carries. balance: + owes the shop · − shop holds an Advance Balance.
const money = (bal = 0) => ({ balance: bal, udharBalance: bal > EPS ? r2(bal) : 0, creditBalance: bal < -EPS ? r2(-bal) : 0, status: statusOf(bal) })

// GET /api/customers — light rows only (no orders / history); details load on click.
export const listCustomers = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const [custs, agg, accts] = await Promise.all([
    Customer.find({ shopId: sid(req) }).lean(),
    Bill.aggregate([{ $match: { shopId: sid(req), customerName: { $ne: '' }, orderStatus: { $ne: 'Cancelled' } } }, { $group: { _id: '$customerName', orders: { $sum: 1 }, spent: { $sum: '$totalAmount' }, last: { $max: '$createdAt' } } }]),
    Udhar.find({ shopId: sid(req) }).select('customerId totalAmount').lean(),
  ])
  const by = Object.fromEntries(agg.map((a) => [a._id, a]))
  const bal = Object.fromEntries(accts.map((a) => [String(a.customerId), a.totalAmount]))
  res.json(custs.map((c) => {
    const a = by[c.name] || {}
    return { id: c._id, name: c.name, phone: c.phone || '', totalOrders: a.orders || 0, totalSpent: r2(a.spent || 0), lastOrder: a.last || c.lastBillAt || null, createdAt: c.createdAt, ...money(bal[String(c._id)] || 0) }
  }).sort((x, y) => +new Date(y.lastOrder || 0) - +new Date(x.lastOrder || 0)))
})

// What a notebook line is called in the UI
const describe = (e) => (e.type === 'adjustment' ? 'Adjustment' : e.type === 'udhar' ? (e.source === 'billing' ? 'Bill (Udhar)' : 'Udhar added') : e.type === 'payment' ? (e.source === 'billing' ? 'Bill Payment' : 'Payment received') : e.delta > 0 ? 'Advance used' : 'Advance Payment')
// Customer's point of view: owing is NEGATIVE, Advance is POSITIVE. (Ledger: delta + = owes more.)
//   change  = −delta        e.g. udhar ₹200 → −200 · payment ₹100 → +100 · advance ₹50 → +50
//   balance = −balanceAfter e.g. owes ₹63 → −63 · advance ₹300 → +300
const entryOut = (e) => ({ id: e._id, customerId: e.customerId, type: e.type, description: describe(e), amount: e.amount, delta: e.delta, change: r2(-e.delta), date: e.date, balanceAfter: e.balanceAfter, balance: r2(-e.balanceAfter), remaining: Math.max(e.balanceAfter, 0), paymentType: e.paymentType })
const txnStatus = (b) => (b.advanceAdded > 0 ? 'Advance' : b.unpaidAmount > 0 ? 'Udhar' : 'Paid')

// GET /api/customers/:id — customer basic info + orders + udhar history + balance history (one call, opened on its own page)
export const getCustomer = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const c = await Customer.findOne({ _id: req.params.id, shopId: sid(req) }).lean()
  if (!c) return res.status(404).json({ message: 'Customer not found.' })
  const [bills, u, lines] = await Promise.all([
    Bill.find({ shopId: sid(req), customerName: c.name }).sort({ createdAt: -1 }).limit(200).lean(),
    Udhar.findOne({ shopId: sid(req), customerId: c._id }).select('totalAmount').lean(),
    UdharHistory.find({ shopId: sid(req), customerId: c._id }).sort({ date: -1, createdAt: -1 }).limit(300).lean(),
  ])
  const bal = u?.totalAmount || 0
  const entries = lines.map(entryOut)
  res.json({
    id: c._id, name: c.name, phone: c.phone || '', createdAt: c.createdAt,
    totalOrders: bills.length, totalSpent: r2(bills.reduce((s, b) => s + b.totalAmount, 0)), lastOrder: bills[0]?.createdAt || null,
    ...money(bal),
    counts: { orders: bills.length, udhar: entries.filter((e) => e.type !== 'credit').length, balance: entries.length },
    orders: bills.map((b) => ({ billId: b.billId, id: orderId(b), date: b.createdAt, amount: b.totalAmount, paid: b.paidAmount, due: b.unpaidAmount, advanceAdded: b.advanceAdded || 0, creditUsed: b.creditUsed || 0, payment: methodOf(b), txnStatus: txnStatus(b), status: billStatus(b, bal) })),
    udharHistory: entries.filter((e) => e.type !== 'credit'),   // udhar added · payment received · remaining
    balanceHistory: entries,                                      // + advance · − udhar · running balance
  })
})

// GET /api/customers/:id/history — balance history only (udhar / payment / credit), newest first
export const getCustomerHistory = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const limit = Math.min(Number(req.query.limit) || 100, 300)
  const rows = await UdharHistory.find({ shopId: sid(req), customerId: req.params.id }).sort({ date: -1, createdAt: -1 }).limit(limit).lean()
  res.json(rows.map(entryOut))
})

// GET /api/customers/activity?period=daily|weekly|monthly|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// Time series for the Customer Activity chart. One response carries all four metrics so switching metric needs no refetch:
//   spent   = bill totals · orders = bill count · udhar = udhar given · advance = advance added (extra payments / deposits)
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const mondayOf = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthKey = (d) => dayKey(d).slice(0, 7)

export const customerActivity = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const period = ['daily', 'weekly', 'monthly', 'custom'].includes(req.query.period) ? req.query.period : 'monthly'
  let end = endOfDay(new Date()), start, gran
  if (period === 'custom') {
    const f = new Date(req.query.from), t = new Date(req.query.to)
    if (Number.isNaN(+f) || Number.isNaN(+t)) return res.status(400).json({ message: 'Pick a valid from and to date.' })
    if (f > t) return res.status(400).json({ message: '"From" must be before "To".' })
    start = startOfDay(f); end = endOfDay(t)
    const days = Math.round((end - start) / 864e5)
    if (days > 800) return res.status(400).json({ message: 'Custom range can be at most 2 years.' })
    gran = days <= 45 ? 'day' : days <= 365 ? 'week' : 'month'
  } else if (period === 'daily') { gran = 'day'; start = startOfDay(addDays(end, -13)) }
  else if (period === 'weekly') { gran = 'week'; start = mondayOf(addDays(end, -7 * 11)) }
  else { gran = 'month'; start = new Date(end.getFullYear(), end.getMonth() - 11, 1) }

  const keyOf = (d) => (gran === 'day' ? dayKey(new Date(d)) : gran === 'week' ? dayKey(mondayOf(d)) : monthKey(new Date(d)))
  const fmt = (d) => d.toLocaleDateString('en-GB', gran === 'month' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
  const buckets = [], at = {}
  for (let cur = gran === 'week' ? mondayOf(start) : gran === 'month' ? new Date(start.getFullYear(), start.getMonth(), 1) : start; cur <= end; cur = gran === 'day' ? addDays(cur, 1) : gran === 'week' ? addDays(cur, 7) : new Date(cur.getFullYear(), cur.getMonth() + 1, 1)) {
    const b = { key: keyOf(cur), label: fmt(cur), spent: 0, orders: 0, udhar: 0, advance: 0 }
    at[b.key] = b; buckets.push(b)
  }
  const [bills, lines] = await Promise.all([
    Bill.find({ shopId: sid(req), createdAt: { $gte: start, $lte: end } }).select('totalAmount createdAt').lean(),
    UdharHistory.find({ shopId: sid(req), date: { $gte: start, $lte: end }, $or: [{ type: 'udhar' }, { type: 'credit', delta: { $lt: 0 } }] }).select('type amount date').lean(),
  ])
  bills.forEach((b) => { const x = at[keyOf(b.createdAt)]; if (x) { x.spent += b.totalAmount; x.orders += 1 } })
  lines.forEach((e) => { const x = at[keyOf(e.date)]; if (x) x[e.type === 'udhar' ? 'udhar' : 'advance'] += e.amount })
  buckets.forEach((b) => { b.spent = r2(b.spent); b.udhar = r2(b.udhar); b.advance = r2(b.advance) })
  res.json({ period, granularity: gran, from: start, to: end, buckets, totals: { spent: r2(buckets.reduce((s, b) => s + b.spent, 0)), orders: buckets.reduce((s, b) => s + b.orders, 0), udhar: r2(buckets.reduce((s, b) => s + b.udhar, 0)), advance: r2(buckets.reduce((s, b) => s + b.advance, 0)) } })
})

// PATCH /api/customers/:id  { name?, phone? } — keeps bills + the udhar account in step with the rename
export const updateCustomer = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const c = await Customer.findOne({ _id: req.params.id, shopId: sid(req) })
  if (!c) return res.status(404).json({ message: 'Customer not found.' })
  const name = req.body.name === undefined ? c.name : String(req.body.name).trim()
  const phone = req.body.phone === undefined ? c.phone : String(req.body.phone).trim()
  if (!name) return res.status(400).json({ message: 'Customer name is required.' })
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ message: 'Mobile number must be 10 digits.' })
  if (name !== c.name && (await Customer.exists({ shopId: sid(req), name, _id: { $ne: c._id } }))) return res.status(400).json({ message: 'Another customer already has that name.' })
  const old = c.name
  c.name = name; c.phone = phone
  await c.save()
  await Promise.all([
    Bill.updateMany({ shopId: sid(req), customerName: old }, { $set: { customerName: name, customerPhone: phone } }),
    Udhar.updateMany({ shopId: sid(req), customerId: c._id }, { $set: { customerName: name, phone } }),
  ])
  res.json({ id: c._id, name, phone })
})

// ───────────────────────── Transaction timeline ─────────────────────────
// GET /api/customers/:id/transactions?type=all|bills|payments|udhar|advance|adjustments&limit=120
// One chronological account of the customer: Bill · Payment · Udhar · Adjustment, each with the balance AFTER it.
//   ledger sign: + owes the shop · − Advance Balance.
const FILTERS = ['all', 'bills', 'payments', 'udhar', 'advance', 'adjustments']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortBill = (id) => displayBillId(id)

export const getTransactions = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const c = await Customer.findOne({ _id: req.params.id, shopId: sid(req) }).lean()
  if (!c) return res.status(404).json({ message: 'Customer not found.' })
  const type = FILTERS.includes(req.query.type) ? req.query.type : 'all'
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 120, 20), 600)

  const [bills, entries, acct] = await Promise.all([
    Bill.find({ shopId: sid(req), $or: [{ customerId: c._id }, { customerName: c.name }] }).sort({ createdAt: 1 }).lean(),
    UdharHistory.find({ shopId: sid(req), customerId: c._id }).sort({ date: 1, createdAt: 1 }).lean(),
    Udhar.findOne({ shopId: sid(req), customerId: c._id }).select('totalAmount').lean(),
  ])
  const bal = acct?.totalAmount || 0
  const counts = bills.length ? await Sale.aggregate([{ $match: { shopId: sid(req), billId: { $in: bills.map((b) => b.billId) } } }, { $group: { _id: '$billId', n: { $sum: 1 } } }]) : []
  const itemsOf = Object.fromEntries(counts.map((x) => [x._id, x.n]))

  // what each bill did to the account (udhar added · payment · advance added · advance used)
  const effects = {}, lastBal = {}
  entries.forEach((e) => {
    if (!e.billId) return
    const kind = e.type === 'udhar' ? 'udhar' : e.type === 'payment' ? 'payment' : e.delta < 0 ? 'advance' : 'advance_used'
    ;(effects[e.billId] ||= []).push({ kind, amount: e.amount }); lastBal[e.billId] = e.balanceAfter
  })

  // merge bills + ledger lines oldest → newest so every row can carry a running balance
  const items = [...bills.map((b) => ({ k: 'bill', d: +new Date(b.createdAt), b })), ...entries.map((e) => ({ k: 'entry', d: +new Date(e.date), e }))]
    .sort((x, y) => x.d - y.d || (x.k === 'bill' ? -1 : 1))
  let running = 0
  const all = items.map((it) => {
    if (it.k === 'entry') {
      const e = it.e; running = e.balanceAfter
      const kind = e.type === 'udhar' ? 'udhar' : e.type === 'payment' ? 'payment' : e.type === 'adjustment' ? 'adjustment' : e.delta < 0 ? 'advance' : 'advance_used'
      return {
        key: `e${e._id}`, kind, type: kind === 'udhar' ? 'Udhar' : kind === 'adjustment' ? 'Adjustment' : 'Payment', date: e.date, entryId: e._id, billRef: e.billId || null, billId: e.billId ? shortBill(e.billId) : null,
        amount: kind === 'adjustment' ? r2(e.delta) : e.amount, payment: kind === 'udhar' ? 'Udhar' : kind === 'adjustment' ? '—' : kind === 'advance_used' ? 'Advance' : String(e.paymentType || 'cash').toUpperCase(),
        status: { udhar: 'Udhar', payment: 'Received', advance: 'Advance', advance_used: 'Advance Used', adjustment: 'Adjusted' }[kind], source: e.source, note: e.note || '', balanceAfter: e.balanceAfter, hidden: e.source === 'billing', // billing-sourced lines show inside their bill row in the All view
      }
    }
    const b = it.b
    const own = lastBal[b.billId]
    const balanceAfter = own !== undefined ? own : running
    running = balanceAfter
    const cancelled = b.orderStatus === 'Cancelled'
    const status = cancelled ? 'Cancelled' : b.advanceAdded > 0 ? 'Advance' : b.unpaidAmount > EPS && bal > EPS ? 'Udhar' : 'Paid'
    return {
      key: `b${b.billId}`, kind: 'bill', type: 'Bill', date: b.createdAt, billRef: b.billId, billId: shortBill(b.billId), items: itemsOf[b.billId] || 0, amount: b.totalAmount,
      payment: b.unpaidAmount > EPS ? 'Udhar' : METHOD[b.paymentMethod] || 'Cash', status, remaining: status === 'Udhar' ? r2(b.unpaidAmount) : 0, effects: effects[b.billId] || [], orderStatus: b.orderStatus, balanceAfter, hidden: false,
    }
  })

  const inView = {
    all: (r) => !r.hidden, bills: (r) => r.kind === 'bill', payments: (r) => r.kind === 'payment' || r.kind === 'advance',
    udhar: (r) => r.kind === 'udhar', advance: (r) => r.kind === 'advance' || r.kind === 'advance_used', adjustments: (r) => r.kind === 'adjustment',
  }
  const tabCounts = Object.fromEntries(FILTERS.map((f) => [f, all.filter(inView[f]).length]))
  const rows = all.filter(inView[type]).slice(-limit).reverse() // newest first

  // summary (whole account)
  const given = r2(entries.filter((e) => e.type === 'udhar').reduce((s, e) => s + e.amount, 0))
  const received = r2(entries.filter((e) => e.type === 'payment' || (e.type === 'credit' && e.delta < 0)).reduce((s, e) => s + e.amount, 0))
  const summary = { transactions: tabCounts.all, totalUdhar: given, totalPayments: received, netBalance: bal, udharDue: bal > EPS ? r2(bal) : 0, advance: bal < -EPS ? r2(-bal) : 0 }

  // bonus graphs: balance over time + monthly bills vs payments
  const now = new Date(), months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1); return { k: d.getFullYear() * 12 + d.getMonth(), label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, billed: 0, paid: 0, udhar: 0 } })
  const mk = Object.fromEntries(months.map((m) => [m.k, m])), keyOf = (d) => new Date(d).getFullYear() * 12 + new Date(d).getMonth()
  bills.filter((b) => b.orderStatus !== 'Cancelled').forEach((b) => { const m = mk[keyOf(b.createdAt)]; if (m) m.billed += b.totalAmount })
  entries.forEach((e) => { const m = mk[keyOf(e.date)]; if (!m) return; if (e.type === 'udhar') m.udhar += e.amount; else if (e.type === 'payment' || (e.type === 'credit' && e.delta < 0)) m.paid += e.amount })
  const fmtD = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const balanceSeries = entries.slice(-80).map((e) => ({ label: fmtD(e.date), date: e.date, balance: e.balanceAfter }))
  res.json({
    customer: { id: c._id, name: c.name, phone: c.phone || '', ...money(bal) }, filter: type, rows, hasMore: all.filter(inView[type]).length > rows.length, counts: tabCounts, summary,
    charts: { balance: balanceSeries, monthly: months.map(({ k, ...m }) => ({ ...m, billed: r2(m.billed), paid: r2(m.paid), udhar: r2(m.udhar) })) },
  })
})

// POST /api/customers/:id/adjustment  { amount (+ owes more / − owes less), note }  — manual correction, logged as an Adjustment
export const addAdjustment = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const c = await Customer.findOne({ _id: req.params.id, shopId: sid(req) })
  if (!c) return res.status(404).json({ message: 'Customer not found.' })
  const amount = r2(Number(req.body.amount)), note = String(req.body.note || '').trim().slice(0, 300)
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.01) return res.status(400).json({ message: 'Enter an adjustment amount (+ or −).' })
  if (note.length < 2) return res.status(400).json({ message: 'Add a short reason for the adjustment.' })
  const { udhar } = await applyLedger({ shopId: sid(req), customer: c, type: 'adjustment', amount, source: 'manual', paymentType: 'adjust', note })
  res.status(201).json({ balance: udhar.totalAmount, ...money(udhar.totalAmount) })
})

// GET /api/customers/:id/global — the same person (same phone, via globalUserId) across ALL shops.
// Only money facts are shared (date · amount · paid/udhar) — never the other shops' item lists or notes.
export const getGlobalHistory = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const c = await Customer.findOne({ _id: req.params.id, shopId: sid(req) }).select('globalUserId').lean()
  if (!c) return res.status(404).json({ message: 'Customer not found.' })
  if (!c.globalUserId) return res.json({ linked: false, shops: [], totals: { shops: 0, bills: 0, spent: 0 } })

  const links = await Customer.find({ globalUserId: c.globalUserId }).select('shopId name').lean()
  const [shops, bills] = await Promise.all([
    Shop.find({ _id: { $in: links.map((l) => l.shopId) } }).select('shopName').lean(),
    Bill.find({ orderStatus: { $ne: 'Cancelled' }, $or: links.flatMap((l) => [{ shopId: l.shopId, customerId: l._id }, { shopId: l.shopId, customerName: l.name }]) })
      .sort({ createdAt: -1 }).limit(300).select('shopId billId totalAmount unpaidAmount advanceAdded createdAt').lean(),
  ])
  const nameOf = Object.fromEntries(shops.map((s) => [String(s._id), s.shopName]))
  const by = {}
  for (const b of bills) {
    const k = String(b.shopId)
    const g = (by[k] ||= { shopId: b.shopId, shopName: nameOf[k] || 'Shop', current: k === String(sid(req)), bills: [], spent: 0 })
    if (g.bills.some((x) => x.billId === b.billId)) continue // matched by id and by name
    g.spent = r2(g.spent + b.totalAmount)
    g.bills.push({ billId: b.billId, id: orderId(b), date: b.createdAt, amount: b.totalAmount, status: b.advanceAdded > 0 ? 'Advance' : b.unpaidAmount > EPS ? 'Udhar' : 'Paid' })
  }
  const list = Object.values(by).sort((a, b) => Number(b.current) - Number(a.current) || b.spent - a.spent)
  res.json({ linked: true, shops: list, totals: { shops: list.length, bills: list.reduce((s, x) => s + x.bills.length, 0), spent: r2(list.reduce((s, x) => s + x.spent, 0)) } })
})
