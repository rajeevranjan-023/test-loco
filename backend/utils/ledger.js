import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import Customer from '../models/Customer.js'
import Bill from '../models/Bill.js'

export const r2 = (n) => Math.round(n * 100) / 100
export const EPS = 0.005
// Customer standing from the single signed balance: + owes the shop · − shop holds an Advance Balance
export const statusOf = (bal) => (bal > EPS ? 'pending' : bal < -EPS ? 'advance' : 'cleared')

// The single place that changes a customer's account. Billing and the Udhar dashboard both call this.
//   udhar      → balance + amount                           (history: udhar)
//   payment    → pays udhar first; whatever is left over becomes Advance Balance   (history: payment [+ credit])
//   credit     → balance − amount, a straight Advance deposit                      (history: credit)
//   use_credit → consumes existing Advance Balance (bill auto-deduct), never more than is held  (history: credit, delta +)
export async function applyLedger({ shopId, customer, type, amount, source = 'manual', billId = null, items = [], paymentType = 'cash', note = '', date = new Date() }) {
  type = { add: 'udhar', extra: 'credit' }[type] || type
  amount = r2(Number(amount))
  if (type === 'adjustment' ? !(Math.abs(amount) > 0) : !(amount > 0)) throw Object.assign(new Error('Amount must be greater than 0.'), { status: 400 })
  if (!['udhar', 'payment', 'credit', 'use_credit', 'adjustment'].includes(type)) throw Object.assign(new Error('Invalid entry type.'), { status: 400 })

  let u = await Udhar.findOne({ shopId, customerId: customer._id })
  if (!u) u = new Udhar({ shopId, customerId: customer._id, customerName: customer.name, phone: customer.phone || '', totalAmount: 0 })
  u.customerName = customer.name
  if (customer.phone) u.phone = customer.phone

  const prev = u.totalAmount
  let bal = prev
  const out = []
  const push = (t, a, sign, pt = paymentType, n = note) => { bal = r2(bal + sign * a); out.push({ shopId, customerId: customer._id, type: t, amount: a, delta: sign * a, source, billId, items, paymentType: pt, note: n, balanceAfter: bal, date }) }

  if (type === 'udhar') push('udhar', amount, +1)
  else if (type === 'payment') {
    const applied = Math.min(amount, Math.max(prev, 0)), extra = r2(amount - applied)
    if (applied > 0) push('payment', applied, -1)
    if (extra > 0) push('credit', extra, -1, paymentType, source === 'billing' ? 'Extra paid — added to Advance Balance' : note || 'Extra paid — added to Advance Balance')
  } else if (type === 'credit') push('credit', amount, -1)
  else if (type === 'adjustment') push('adjustment', Math.abs(amount), amount > 0 ? +1 : -1, 'adjust')
  else {
    const used = Math.min(amount, Math.max(-prev, 0))
    if (used > 0) push('credit', used, +1, 'advance', note || 'Advance Balance used')
  }
  if (!out.length) return { udhar: u, entries: [] }

  if (type === 'udhar') u.lastAddedAt = date
  if (prev <= EPS && bal > EPS) u.pendingSince = date
  if (prev > EPS && bal <= EPS) { u.clearedAt = date; u.pendingSince = null }
  u.totalAmount = bal
  u.lastUpdated = date
  await u.save()
  const entries = await UdharHistory.insertMany(out)
  await Customer.updateOne({ _id: customer._id }, { $set: { creditBalance: bal < 0 ? -bal : 0 } })
  return { udhar: u, entries }
}

// Idempotent upgrade for data written before the Advance Balance release (safe to run on every start).
export async function migrateLedger() {
  await UdharHistory.collection.updateMany({ type: 'add' }, { $set: { type: 'udhar' } })
  await UdharHistory.collection.updateMany({ type: 'extra' }, { $set: { type: 'credit' } })
  await UdharHistory.collection.updateMany({ delta: { $exists: false } }, [{ $set: { delta: { $cond: [{ $eq: ['$type', 'udhar'] }, '$amount', { $multiply: ['$amount', -1] }] } } }])
  await Bill.collection.updateMany({ paymentMethod: 'other', unpaidAmount: { $gt: 0 } }, { $set: { paymentMethod: 'udhar' } })
  await Bill.collection.updateMany({ paymentMethod: 'other' }, { $set: { paymentMethod: 'cash' } })
  const adv = await Udhar.find({ totalAmount: { $lt: -EPS } }).select('customerId totalAmount').lean()
  if (adv.length) await Customer.bulkWrite(adv.map((a) => ({ updateOne: { filter: { _id: a.customerId }, update: { $set: { creditBalance: r2(-a.totalAmount) } } } })))
  // bills: link to the customer + store the settlement status (idempotent)
  const custs = await Customer.find({}).select('shopId name').lean()
  const key = new Map(custs.map((c) => [`${c.shopId}|${c.name}`, c._id]))
  const open = await Bill.find({ customerName: { $ne: '' }, customerId: null }).select('shopId customerName').lean()
  const ops = open.filter((b) => key.has(`${b.shopId}|${b.customerName}`)).map((b) => ({ updateOne: { filter: { _id: b._id }, update: { $set: { customerId: key.get(`${b.shopId}|${b.customerName}`) } } } }))
  if (ops.length) await Bill.bulkWrite(ops)
  await Bill.collection.updateMany({ status: { $exists: false }, advanceAdded: { $gt: 0 } }, { $set: { status: 'advance' } })
  await Bill.collection.updateMany({ status: { $exists: false }, unpaidAmount: { $gt: 0 } }, { $set: { status: 'udhar' } })
  await Bill.collection.updateMany({ status: { $exists: false } }, { $set: { status: 'paid' } })
}

// Recompute a customer's running balances + account fields from their remaining history.
// Used when an order is cancelled/deleted and its ledger lines are removed.
export async function rebuildLedger(shopId, customerId) {
  const entries = await UdharHistory.find({ shopId, customerId }).sort({ date: 1, createdAt: 1 })
  let bal = 0, pendingSince = null, clearedAt = null, lastAddedAt = null
  const ops = []
  for (const e of entries) {
    const prev = bal
    bal = r2(bal + (e.delta ?? (e.type === 'udhar' ? e.amount : -e.amount)))
    if (e.type === 'udhar') lastAddedAt = e.date
    if (prev <= EPS && bal > EPS) pendingSince = e.date
    if (prev > EPS && bal <= EPS) { clearedAt = e.date; pendingSince = null }
    if (e.balanceAfter !== bal) ops.push({ updateOne: { filter: { _id: e._id }, update: { $set: { balanceAfter: bal } } } })
  }
  if (ops.length) await UdharHistory.bulkWrite(ops)
  await Udhar.updateOne({ shopId, customerId }, { $set: { totalAmount: bal, lastAddedAt, pendingSince: bal > EPS ? pendingSince : null, clearedAt: bal <= EPS ? clearedAt : null, lastUpdated: new Date() } })
  await Customer.updateOne({ _id: customerId }, { $set: { creditBalance: bal < -EPS ? -bal : 0 } })
  return bal
}
