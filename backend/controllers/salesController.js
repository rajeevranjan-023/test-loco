import mongoose from 'mongoose'
import Product from '../models/Product.js'
import Sale from '../models/Sale.js'
import Udhar from '../models/Udhar.js'
import Customer from '../models/Customer.js'
import Bill from '../models/Bill.js'
import BillDraft from '../models/BillDraft.js'
import { PHONE_RE, touchGlobalUser } from '../utils/globalUser.js'
import UdharHistory from '../models/UdharHistory.js'
import ServiceItem from '../models/ServiceItem.js'
import { applyLedger, rebuildLedger, r2 } from '../utils/ledger.js'
import { billingCapabilities, LINE_TYPES, LINE_LABEL, TYPE_CAP } from '../utils/billingConfig.js'
import { deriveTransactionType, computeBill, costBreakdown as costTotals, resolveContext, cleanChargeLine, cleanLineExtras, cleanDiscount } from '../utils/billing.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { generateBillId } from '../utils/billId.js'
import { computeSettlement, postBillLedger } from '../utils/settlement.js'
import { hooksFor } from '../utils/businessHooks.js'
import { consumeFIFO, restoreToBatches, trimBreakdown, breakdownOfSale, mergeBreakdown, weightedCost, withProduct, r3, StockError } from '../utils/stock.js'

// _________________________________________________________________________
// =========================================================================
// POST /api/seller/sales  (protected)
// Records a bill — one or more line items, plus payment info. Every bill
// gets a `billId` shared by its Sale line items and its Bill summary doc.
//
// Body:
//   items: [{ productId, quantity }]   (required, at least one)
//   channel: 'online' | 'offline'
//   customerName, customerPhone: optional strings
//   paymentMode: 'full' | 'custom'     ('full' = customer pays what is due; 'custom' = use amountPaid, 0 = nothing paid)
//   amountPaid: number                 (required when paymentMode === 'custom'; may exceed the amount due → Advance Balance)
//   receivedAmount / returnedAmount    (cash handed over / change given back; net = received − returned)
//   addRemainingToUdhar: boolean       (only matters when there's an unpaid remainder)
//   useCredit: boolean                 (default true — auto-deduct the customer's Advance Balance from this bill)
//
// Settlement (all automatic):  paid < due → Udhar · paid = due → Cleared · paid > due → Advance Balance.
export const recordSale = asyncHandler(async (req, res) => {
  if (!req.sellerAccount) return res.status(403).json({ message: 'Seller account required.' })
  const account = req.sellerAccount, shopId = account._id
  const caps = billingCapabilities(account, req.sellerType)
  const hooks = hooksFor(req.sellerType) // business-specific steps of the shared billing flow (none for shop / service)

  const {
    channel, customerName, customerPhone,
    paymentMode, amountPaid, addRemainingToUdhar,
    notes,
  } = req.body
  let { paymentMethod, receivedAmount, returnedAmount } = req.body
  // Several payment methods in one transaction: payments:[{method, amount}] → the bill keeps each one; its main method is the biggest.
  let splitPayments = null
  if (Array.isArray(req.body.payments) && req.body.payments.length) {
    splitPayments = []
    for (const p of req.body.payments.slice(0, 6)) {
      const m = String(p?.method || '').toLowerCase(), amt = Number(p?.amount)
      if (!['cash', 'upi', 'card'].includes(m) || !(amt >= 0)) return res.status(400).json({ message: 'Each payment needs cash, upi or card and a valid amount.' })
      if (amt > 0) { const hit = splitPayments.find((x) => x.method === m); if (hit) hit.amount = r2(hit.amount + amt); else splitPayments.push({ method: m, amount: r2(amt) }) }
    }
    receivedAmount = r2(splitPayments.reduce((s, p) => s + p.amount, 0)); returnedAmount = Number(returnedAmount || 0)
    if (splitPayments.length) paymentMethod = [...splitPayments].sort((a, b) => b.amount - a.amount)[0].method
  }

  // Legacy callers send { productId, quantity } lines with no `type` → they are product lines.
  const items = Array.isArray(req.body.items) && req.body.items.length > 0
    ? req.body.items
    : req.body.productId
      ? [{ productId: req.body.productId, quantity: req.body.quantity }]
      : []
  if (items.length === 0) return res.status(400).json({ message: 'At least one product/quantity line item is required.' })
  if (items.length > 200) return res.status(400).json({ message: 'Too many line items on one bill.' })
  const bad = (status, message) => res.status(status).json({ message })

  // ---- what each row is, and is that row type switched on for this business? ----
  const typeOf = (i) => (LINE_TYPES.includes(i.type) ? i.type : 'product')
  for (const item of items) {
    const t = typeOf(item)
    if (!caps[TYPE_CAP[t]]) return bad(400, `${LINE_LABEL[t]} billing is not enabled for this business.`)
  }

  // Items typed at the till that aren't in inventory become "unlisted" products (listed:false): they are
  // remembered + priced here and reviewed later in Inventory → "Products Added From Billing".
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const item of items) {
    if (typeOf(item) !== 'product' || item.productId || !item.unlisted) continue
    const name = String(item.name || '').trim().slice(0, 80), price = Number(item.price)
    if (!name || !(price > 0)) return bad(400, 'Unlisted products need a name and a selling price.')
    let p = await Product.findOne({ shopId, listed: false, name: new RegExp(`^${esc(name)}$`, 'i') })
    if (!p) p = await Product.create({ shopId, name, price, costPrice: 0, stock: 0, listed: false, icon: '🛒', category: 'Other' })
    item.productId = String(p._id)
  }

  // ---- Resolve every line (validate stock for ALL inventory lines before committing any) ----
  const invIds = items.filter((i) => ['product', 'material'].includes(typeOf(i))).map((i) => i.productId)
  const products = invIds.length ? await Product.find({ _id: { $in: invIds }, shopId }) : []
  const productMap = new Map(products.map((p) => [p._id.toString(), p]))
  const wanted = new Map() // total quantity asked per product across ALL lines (a product line + a material line of the same item add up)
  const lines = []
  for (const item of items) {
    const type = typeOf(item)
    if (type === 'product' || type === 'material') {
      const product = productMap.get(String(item.productId))
      if (!product) return bad(404, 'One of the selected products was not found.')
      const qty = Number(item.quantity ?? item.qty)
      if (!(qty > 0)) return bad(400, 'Each line item needs a quantity greater than 0.')
      if (type === 'material' && product.listed === false) return bad(400, `"${product.name}" is not in inventory — materials must come from inventory.`)
      if (type === 'product' && product.sellable === false) return bad(400, `"${product.name}" is a service material and is not sold directly.`)
      let rate = product.price
      if (product.listed === false) {
        const np = Number(item.price) // unlisted items have no stock limit; the till can re-price them
        if (np > 0) { product.price = np; rate = np }
      } else {
        const asked = r3((wanted.get(String(item.productId)) || 0) + qty)
        wanted.set(String(item.productId), asked)
        if (product.stock < asked) return bad(400, `Only ${product.stock} of "${product.name}" in stock.`)
        if (type === 'material' && Number(item.rate) > 0) rate = Number(item.rate) // a material can be billed at a negotiated rate
      }
      const extras = cleanLineExtras(item, type)
      if (type === 'product' && product.listed !== false && caps.editRate && Number(item.rate) > 0) rate = Number(item.rate) // rate change on the bill only — the inventory master price is never touched
      if (extras.charge !== 'charged') rate = 0 // included / internal: stock is used but the customer isn't charged
      lines.push({ type, name: product.name, qty, unit: product.priceUnit === 'unit' ? '' : product.priceUnit, rate, pricing: 'fixed', refId: product._id, product, ...extras })
    } else {
      const r = cleanChargeLine(item, type)
      if (r.error) return bad(400, r.error)
      const hk = hooks.cleanMeta ? hooks.cleanMeta(item, type, account) : null
      if (hk?.error) return bad(400, hk.error)
      lines.push({ ...r.line, refId: hk?.meta?.courseId || null, meta: hk?.meta })
    }
  }
  // ONE calculation pipeline (utils/billing.js): line totals → subtotal → discounts → tax → grand total
  const wantsDiscount = lines.some((l) => l.discountValue > 0) || cleanDiscount(req.body.discount).value > 0
  if (!caps.discount && wantsDiscount) return bad(400, 'Discount is not enabled for this business.')
  const calc = computeBill(lines, { discount: caps.discount ? req.body.discount : 0, taxRate: caps.tax ? caps.taxRate : 0 })
  const totalAmount = calc.total, discount = calc.discount
  const ctxRes = resolveContext(caps.context, req.body.context)
  if (ctxRes.error) return bad(400, ctxRes.error)
  const transactionType = deriveTransactionType(lines)
  if (hooks.validate) { // e.g. study centre: the seat must be free for the chosen slot — refused BEFORE anything is written
    if (lines.some((l) => l.meta) && !customerName?.trim()) return bad(400, 'Select the member first.')
    await hooks.validate({ account, lines, customerName })
  }

  // ---- Customer + their standing (existing udhar / Advance Balance) ----
  const cname = customerName?.trim()
  const cust = cname
    ? await Customer.findOneAndUpdate(
        { shopId, name: cname },
        { $set: { lastBillAt: new Date(), ...(customerPhone ? { phone: customerPhone } : {}) }, $setOnInsert: { shopId, name: cname } },
        { upsert: true, new: true }
      )
    : null
  if (cust && hooks.ensureParty) await hooks.ensureParty(account, cust) // the person also becomes a Member (study centre)
  const standing = cust ? await Udhar.findOne({ shopId, customerId: cust._id }).select('totalAmount').lean() : null

  // ---- Work out the settlement ----
  // 1) Advance Balance is auto-deducted first. 2) What the customer actually pays is compared with what is still due.
  // The seller chooses the advance explicitly (billing screen "−₹…" → advanceToUse) and the money collected against old udhar (oldUdharPaid); the server applies
  // exactly that, capped by what is really held / owed — utils/settlement.js is the single piece of arithmetic (older clients keep the automatic advance).
  const st = computeSettlement({
    totalAmount, hasCustomer: !!cust, balance: standing?.totalAmount ?? 0, useCredit: req.body.useCredit,
    advanceAsked: req.body.advanceToUse == null ? null : Number(req.body.advanceToUse) || 0, oldAsked: req.body.oldUdharPaid,
    received: receivedAmount, returned: returnedAmount, paymentMode, amountPaid,
  })
  if (st.error) return bad(400, st.error)
  const { creditUsed, oldPaid, unpaidAmount, extraPaid, paidAmount } = st
  const paymentStatus = unpaidAmount <= 0 ? 'paid' : paidAmount <= 0 ? 'unpaid' : 'partial'

  if (unpaidAmount > 0 && addRemainingToUdhar && !cname) {
    return bad(400, 'A customer name is required to add the remaining balance to Udhar.')
  }
  if (unpaidAmount > 0) {
    if (paymentMethod === 'udhar' ? caps.udhar === false : caps.partialPayment === false) return bad(400, 'Part payment / udhar is not enabled for this business.')
  }

  // Remember typed services / labour as quick-picks (non-critical; the bill keeps its own snapshot regardless).
  for (const l of lines) {
    if (l.type !== 'service' && l.type !== 'labour') continue
    try {
      const where = l.serviceId ? { _id: l.serviceId, shopId } : { shopId, kind: l.type, name: new RegExp(`^${esc(l.name)}$`, 'i') }
      const si = await ServiceItem.findOneAndUpdate(where, { $set: { lastUsedAt: new Date(), active: true }, $inc: { usedCount: 1 }, $setOnInsert: { shopId, kind: l.type, name: l.name, rate: l.rate, pricing: l.pricing === 'custom' ? 'fixed' : l.pricing, unit: l.unit } }, { upsert: !l.serviceId, new: true })
      if (si) l.refId = si._id
    } catch { /* a quick-pick hiccup must never block a bill */ }
  }

  const { billId, fullId } = await generateBillId(account)

  // ---- Everything from here on is all-or-nothing. Stock is taken OLDEST BATCH FIRST (FIFO); each product/material
  //      line stores the batches it used, and costAtSale/cost is their weighted average, so profit is batch-exact. ----
  const created = []   // Sale rows (product lines only — keeps existing product analytics exact)
  const consumed = []  // so a failure half-way can put everything back
  let bill = null, ledgerTouched = false
  const undo = async () => {
    for (const c of consumed) await withProduct({ _id: c.productId, shopId }, (p) => { restoreToBatches(p, c.pieces); if (c.type === 'material') p.consumed = Math.max(r3((p.consumed || 0) - c.qty), 0); else p.sold = Math.max(r3((p.sold || 0) - c.qty), 0) }).catch(() => null)
    if (created.length) await Sale.deleteMany({ _id: { $in: created.map((x) => x._id) } }).catch(() => null)
    if (bill) { await Bill.deleteOne({ _id: bill._id }).catch(() => null); if (hooks.undo) await hooks.undo({ account, billId }).catch(() => null) }
    if (ledgerTouched && cust) { await UdharHistory.deleteMany({ shopId, billId }).catch(() => null); await rebuildLedger(shopId, cust._id).catch(() => null) }
  }
  try {
    for (const l of lines) {
      if (l.type !== 'product' && l.type !== 'material') continue
      const product = l.product
      const pieces = await withProduct({ _id: product._id, shopId }, (p) => {
        const used = consumeFIFO(p, l.qty)
        if (l.type === 'material') p.consumed = r3((p.consumed || 0) + l.qty)
        else {
          if (p.listed === false) { p.billedCount = (p.billedCount || 0) + 1; p.lastBilledAt = new Date(); if (product.price !== p.price) p.price = product.price } // till item: re-priced here
          p.sold = r3((p.sold || 0) + l.qty)
        }
        return used
      })
      if (!pieces) throw new StockError('One of the selected products was not found.')
      consumed.push({ productId: product._id, qty: l.qty, pieces, type: l.type })
      l.cost = weightedCost(pieces); l.costBreakdown = pieces
      if (l.type === 'product') {
        created.push(await Sale.create({
          shopId, productId: product._id, quantity: l.qty, unit: product.priceUnit, priceAtSale: l.rate, costAtSale: l.cost, costBreakdown: pieces,
          channel: channel === 'online' ? 'online' : 'offline', customerName: customerName || '', billId,
        }))
      }
    }

    bill = await Bill.create({
      shopId, billId, fullId,
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      channel: channel === 'online' ? 'online' : 'offline',
      totalAmount, paidAmount, unpaidAmount, paymentStatus,
      creditId: null,
      paymentMethod: ['upi', 'cash', 'card', 'udhar'].includes(paymentMethod) ? paymentMethod : 'cash',
      creditUsed,
      balanceBefore: cust ? standing?.totalAmount ?? 0 : null, // snapshot for the customer-facing "previous udhar" (see utils/billing.js#accountSummary)
      customerId: cust?._id || null,
      status: 'paid',
      receivedAmount: receivedAmount == null ? null : Number(receivedAmount),
      returnedAmount: returnedAmount == null ? null : Number(returnedAmount),
      notes: String(notes || '').slice(0, 300),
      discount, subtotal: calc.subtotal,
      ...(caps.discount ? (() => { const d = cleanDiscount(req.body.discount); return d.value ? { discountType: d.type, discountValue: d.value } : {} })() : {}),
      ...(calc.taxAmount > 0 ? { taxName: caps.taxName || 'Tax', taxRate: calc.taxRate, taxAmount: calc.taxAmount } : {}),
      payments: splitPayments ? splitPayments.map((p) => ({ ...p, at: new Date() })) : undefined,
      transactionType,
      items: lines.map((l, i) => ({ type: l.type, refId: l.refId || null, name: l.name, qty: l.qty, unit: l.unit || '', rate: l.rate, total: calc.lines[i].total, pricing: l.pricing || 'fixed', description: l.description || '', charge: l.charge || 'charged', discountType: l.discountType || 'fixed', discountValue: l.discountValue || 0, discount: calc.lines[i].discount, cost: l.cost || 0, costBreakdown: l.costBreakdown, meta: l.meta })),
      revenue: calc.revenue,
      cost: costTotals(lines),
      context: ctxRes.values.length ? ctxRes.values : undefined,
    })

    // ---- Auto-update the customer's account: Advance used → Udhar → extra payment ----
    const pm = ['upi', 'cash', 'card'].includes(paymentMethod) ? paymentMethod : 'cash'
    const ledgerItems = lines.map((l) => ({ name: l.name, qty: l.qty, price: l.rate }))
    const ref = billId.slice(-6).toUpperCase()
    ledgerTouched = true
    const posted = await postBillLedger({ shopId, customer: cust, billId, items: ledgerItems, paymentType: pm, ref, creditUsed, unpaidAmount, addToUdhar: !!addRemainingToUdhar, oldPaid, extraPaid })
    const { last, udharAdded, advanceAdded, paidTowardsUdhar } = posted
    const balance = last ? last.udhar.totalAmount : standing?.totalAmount ?? 0
    if (advanceAdded > 0) bill.advanceAdded = advanceAdded
    bill.status = advanceAdded > 0 ? 'advance' : unpaidAmount > 0 ? 'udhar' : 'paid'
    bill.balanceAfter = cust ? balance : null
    await bill.save()
    if (hooks.afterBill) await hooks.afterBill({ account, bill, lines, calc, customer: cust }) // memberships · seat assignments · enrolments

    // ---- Usage counters + global identity (only after the bill really exists) ----
    if (cust) {
      const upd = { $inc: { usageCount: 1 } }
      if (PHONE_RE.test(cust.phone || '')) {
        const g = await touchGlobalUser(cust.phone, cust.name).catch(() => null) // never let the directory break a sale
        if (g) upd.$set = { globalUserId: g._id }
      }
      await Customer.updateOne({ _id: cust._id }, upd)
    }
    // billed from a saved draft → the draft is done
    if (req.body.draftId) await BillDraft.deleteOne({ _id: req.body.draftId, shopId }).catch(() => null)

    const status = advanceAdded > 0 ? 'Advance' : unpaidAmount > 0 ? 'Pending' : 'Cleared'
    res.status(201).json({
      billId, sales: created, bill, status, transactionType, revenue: bill.revenue,
      settlement: { creditUsed, udharAdded, advanceAdded, paidTowardsUdhar, balance },
      udhar: last ? [{ balance: last.udhar.totalAmount }] : [],
    })
  } catch (err) {
    await undo()
    throw err
  }
})

// _________________________________________________________________________
// =========================================================================
// PUT /api/seller/sales/:saleId  (protected) - edit a logged bill line item.
// Only quantity, channel and customerName are editable; changing quantity
// adjusts the product's stock by the difference so stock stays accurate.
// Note: this does not recompute the parent Bill's totals/payment status —
// edit the bill's payment separately via the Udhar/credit tools if needed.
export const updateSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.saleId, shopId: req.sellerAccount._id })
  if (!sale) {
    return res.status(404).json({ message: 'Sale not found.' })
  }

  const { quantity, channel, customerName } = req.body

  if (quantity !== undefined && Number(quantity) !== sale.quantity) {
    const qn = r3(Number(quantity))
    if (!(qn > 0)) return res.status(400).json({ message: 'Quantity must be greater than 0.' })
    const delta = r3(qn - sale.quantity)
    let pieces = breakdownOfSale(sale)
    const done = await withProduct({ _id: sale.productId, shopId: req.sellerAccount._id }, (p) => {
      const base = breakdownOfSale(sale) // recomputed on every retry
      if (delta > 0) { pieces = mergeBreakdown([...base, ...consumeFIFO(p, delta)]) } // more sold → take more, oldest first
      else { const { kept, removed } = trimBreakdown(base, -delta); restoreToBatches(p, removed, sale.createdAt); pieces = kept } // fewer → newest pieces go back
      p.sold = Math.max(r3((p.sold || 0) + delta), 0)
    })
    if (done) { sale.costBreakdown = pieces; sale.costAtSale = weightedCost(pieces) }
    sale.quantity = qn
  }

  if (channel !== undefined) sale.channel = channel === 'online' ? 'online' : 'offline'
  if (customerName !== undefined) sale.customerName = customerName

  await sale.save()
  res.json(sale)
})

// _________________________________________________________________________
// =========================================================================
// GET /api/seller/sales  (protected, shop sellers only)
// Flat line items — the frontend groups them by billId to render as bills.
export const listSales = asyncHandler(async (req, res) => {
  if (!req.sellerAccount) {
    return res.status(403).json({ message: 'Only shop accounts have sales.' })
  }
  const sales = await Sale.find({ shopId: req.sellerAccount._id })
    .populate('productId', 'name icon imageUrl')
    .sort({ createdAt: -1 })
    .limit(200)
  res.json(sales)
})

// _________________________________________________________________________
// =========================================================================
// GET /api/seller/bills  (protected, shop sellers only)
// One summary doc per bill — payment status/totals for the Sales tab to
// merge with the grouped line items from listSales.
export const listBills = asyncHandler(async (req, res) => {
  if (!req.sellerAccount) {
    return res.status(403).json({ message: 'Only shop accounts have bills.' })
  }
  const bills = await Bill.find({ shopId: req.sellerAccount._id }).sort({ createdAt: -1 }).limit(200)
  res.json(bills)
})
// _________________________________________________________________________
// =========================================================================
