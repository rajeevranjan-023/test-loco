import Bill from '../models/Bill.js'
import Sale from '../models/Sale.js'
import Customer from '../models/Customer.js'
import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { applyLedger, r2, EPS } from '../utils/ledger.js'
import { allocateRemaining, billStateOf } from '../utils/billState.js'
import { displayBillId } from '../utils/billId.js'

const sid = (req) => req.sellerAccount._id
// Any seller account (shop OR service provider) uses the one billing / customer / inventory system.
const shopOnly = () => false
const code = (b) => displayBillId(b.billId, '#ORD')
const METHOD = { upi: 'UPI', cash: 'Cash', card: 'Card', udhar: 'Udhar' }
const methodOf = (b) => (b.creditId || b.unpaidAmount > 0 ? 'Udhar' : METHOD[b.paymentMethod] || 'Cash')

// Who the bill belongs to + how much of the customer's current udhar still sits on THIS bill.
async function context(req, bill) {
  const shopId = sid(req)
  const cust = bill.customerId
    ? await Customer.findOne({ _id: bill.customerId, shopId })
    : bill.customerName ? await Customer.findOne({ shopId, name: bill.customerName }) : null
  if (!cust) return { cust: null, onLedger: false, remaining: bill.unpaidAmount > EPS ? r2(bill.unpaidAmount) : 0, balance: 0 }
  const [open, ledgerIds, u] = await Promise.all([
    Bill.find({ shopId, customerName: cust.name, unpaidAmount: { $gt: 0 } }).select('billId unpaidAmount createdAt').lean(),
    UdharHistory.distinct('billId', { shopId, customerId: cust._id, type: 'udhar', source: 'billing' }),
    Udhar.findOne({ shopId, customerId: cust._id }).select('totalAmount').lean(),
  ])
  const set = new Set(ledgerIds)
  const balance = u?.totalAmount || 0
  const map = allocateRemaining(open, set, balance)
  return { cust, onLedger: set.has(bill.billId), remaining: map[bill.billId] || 0, balance }
}

// Everything the bill page needs. Totals are re-derived so the numbers always add up.
async function view(req, bill) {
  const shopId = sid(req)
  const ctx = await context(req, bill)
  let items = (bill.items || []).map((i) => ({ type: i.type, name: i.name, qty: i.qty, unit: i.unit, price: i.rate ?? i.price, total: i.total ?? r2(i.qty * (i.rate ?? i.price)) }))
  if (!items.length) {
    const lines = await Sale.find({ shopId, billId: bill.billId }).populate('productId', 'name').lean()
    items = lines.map((l) => ({ name: l.productId?.name || 'Item', qty: l.quantity, price: l.priceAtSale, total: r2(l.priceAtSale * l.quantity) }))
  }
  const later = (await UdharHistory.find({ shopId, billId: bill.billId, type: 'payment', source: 'manual' }).sort({ date: 1 }).lean())
    .map((e) => ({ id: e._id, date: e.date, amount: e.amount, method: (e.paymentType || 'cash').toUpperCase() }))
  const laterSum = r2(later.reduce((s, p) => s + p.amount, 0))

  const subtotal = r2(items.reduce((s, i) => s + i.total, 0)) || bill.totalAmount
  const discount = Math.max(r2(subtotal - bill.totalAmount), 0)      // a bill saved below its line total carries a discount
  const received = bill.receivedAmount ?? r2(Math.max(bill.paidAmount - (bill.creditUsed || 0) - laterSum, 0))
  const returned = bill.returnedAmount ?? 0
  const remaining = ctx.remaining
  const status = billStateOf(bill, remaining)

  return {
    id: code(bill), billId: bill.billId, date: bill.createdAt, shopName: req.sellerAccount.shopName || req.sellerAccount.name, transactionType: bill.transactionType || 'sale', context: bill.context || [], notes: bill.notes || '',
    customer: bill.customerName ? { id: ctx.cust?._id || null, name: bill.customerName, phone: bill.customerPhone || ctx.cust?.phone || '' } : null,
    paymentMethod: methodOf(bill), status,
    items,
    summary: { subtotal, discount, total: bill.totalAmount, amountReceived: received, returnAmount: returned, advanceUsed: bill.creditUsed || 0, laterPayments: laterSum, remainingUdhar: remaining, advanceAdded: bill.advanceAdded || 0 },
    payments: later,
    balanceAfter: r2(-(bill.balanceAfter || 0)),            // customer's view: − owes · + advance
    customerBalance: ctx.cust ? r2(-ctx.balance) : null,
    canAddPayment: remaining > EPS,
  }
}

// GET /api/bills/:id   (id = the bill's billId)
export const getBill = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.id })
  if (!bill) return res.status(404).json({ message: 'Bill not found.' })
  res.json(await view(req, bill))
})

async function settle(req, res, amountOf) {
  if (shopOnly(req, res)) return
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.id })
  if (!bill) return res.status(404).json({ message: 'Bill not found.' })
  const ctx = await context(req, bill)
  if (!(ctx.remaining > EPS)) return res.status(400).json({ message: 'Nothing is pending on this bill.' })
  const amount = r2(amountOf(ctx.remaining))
  if (!(amount > 0)) return res.status(400).json({ message: 'Enter an amount greater than 0.' })
  if (amount > ctx.remaining + EPS) return res.status(400).json({ message: `Only ₹${ctx.remaining} is pending on this bill.` })
  const paymentType = ['cash', 'upi', 'card'].includes(req.body.paymentType) ? req.body.paymentType : 'cash'

  if (ctx.cust && ctx.onLedger) {
    // the payment goes through the same ledger as billing, so Udhar, balance and history all update together
    const out = await applyLedger({ shopId: sid(req), customer: ctx.cust, type: 'payment', amount, source: 'manual', billId: bill.billId, paymentType, note: `Payment on Bill ${code(bill)}` })
    bill.balanceAfter = out.udhar.totalAmount
  }
  const cleared = ctx.remaining - amount <= EPS
  bill.paidAmount = cleared ? bill.totalAmount : r2(bill.paidAmount + amount)
  bill.unpaidAmount = cleared ? 0 : r2(Math.max(bill.unpaidAmount - amount, 0))
  bill.paymentStatus = bill.unpaidAmount <= EPS ? 'paid' : 'partial'
  bill.status = bill.advanceAdded > 0 ? 'advance' : bill.unpaidAmount > EPS ? 'udhar' : 'paid'
  await bill.save()
  res.json(await view(req, bill))
}

// POST /api/bills/:id/payment  { amount, paymentType }   — part or full payment against this bill's pending udhar
export const addBillPayment = asyncHandler((req, res) => settle(req, res, () => Number(req.body.amount)))
// POST /api/bills/:id/settle   { paymentType }           — "Convert to Paid": pays whatever is still pending
export const settleBill = asyncHandler((req, res) => settle(req, res, (remaining) => remaining))
