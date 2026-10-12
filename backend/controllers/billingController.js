import Bill from '../models/Bill.js'
import Sale from '../models/Sale.js'
import Product from '../models/Product.js'
import Udhar from '../models/Udhar.js'
import Customer from '../models/Customer.js'
import GlobalUser from '../models/GlobalUser.js'
import BillDraft from '../models/BillDraft.js'
import { PHONE_RE, mostUsedName, totalUses, touchGlobalUser } from '../utils/globalUser.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { displayBillId } from '../utils/billId.js'
import ServiceItem from '../models/ServiceItem.js'
import { billingCapabilities, sanitizeCapabilities, enabledTypes, labelFor, addLabelFor } from '../utils/billingConfig.js'
import { schemaFor, hasCapability } from '../utils/businessSchema.js'
import { accountName } from '../utils/accounts.js'
import StudyMember from '../models/StudyMember.js'
import { hooksFor } from '../utils/businessHooks.js'
import { r2 as round2, buildDocument, paymentStatusOf } from '../utils/billing.js'
import { paymentsOf } from '../utils/billPayments.js'
import { dailySeries, topItems } from '../utils/billingSeries.js'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sid = (req) => req.sellerAccount._id
const bizName = (a) => accountName(a)
// Any seller account (shop OR service provider) uses the one billing / customer / inventory system.
const shopOnly = () => false
const shortId = (b) => displayBillId(b.billId, '#ORD')
const METHOD = { upi: 'UPI', cash: 'Cash', card: 'Card', udhar: 'Udhar' }
// Payment method shown on a bill: only Cash · UPI · Card · Udhar
const payLabel = (b) => (b.creditId || b.unpaidAmount > 0 ? 'Udhar' : METHOD[b.paymentMethod] || 'Cash')
// Bill status: Pending (udhar still owed) · Cleared (fully paid) · Advance (customer paid extra → Advance Balance)
const billStatus = (b, bal) => (b.advanceAdded > 0 ? 'Advance' : b.unpaidAmount > 0 && !(bal !== undefined && bal <= 0.005) ? (b.paidAmount > 0 ? 'Partial' : 'Pending') : 'Cleared')

const MAX_SUGGESTIONS = 5
const NAME_MIN = 2, PHONE_MIN = 3

// One customer, in the shape the billing screen uses (balances come from the udhar account map).
const shape = (c, bal = {}) => {
  const b = bal[String(c._id)] || 0
  return { source: 'local', id: c._id, name: c.name, phone: c.phone || '', usageCount: c.usageCount || 0, globalUserId: c.globalUserId || null, udharDue: Math.max(b, 0), credit: Math.max(-b, 0), creditBalance: c.creditBalance || 0 }
}
const balancesOf = async (req, ids) => {
  if (!ids.length) return {}
  const led = await Udhar.find({ shopId: sid(req), customerId: { $in: ids } }).select('customerId totalAmount').lean()
  return Object.fromEntries(led.map((u) => [String(u.customerId), u.totalAmount]))
}

// GET /api/seller/billing/customers?q=
// Type-ahead (also served at GET /api/customers/search?q=). NOTHING is queried until there is enough input
// (name ≥ 2 chars, phone ≥ 3 digits). At most 5 rows, from this shop's own customers.
// Only a FULL 10-digit number that is not in this shop falls back to the global directory (exact match,
// most-used name) so the seller can confirm / edit the name before saving it to the shop.
export const searchCustomers = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const q = String(req.query.q || '').trim().slice(0, 40)
  const phoneLike = /^[\d\s+-]+$/.test(q)
  let digits = q.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (phoneLike ? digits.length < PHONE_MIN : q.length < NAME_MIN) return res.json([])

  const lq = q.toLowerCase()
  const filter = { shopId: sid(req), ...(phoneLike ? { phone: new RegExp(esc(digits)) } : { name: new RegExp(esc(q), 'i') }) }
  const local = (await Customer.find(filter).limit(20).lean())
    .sort((a, b) => Number(phoneLike ? b.phone.startsWith(digits) : b.name.toLowerCase().startsWith(lq)) - Number(phoneLike ? a.phone.startsWith(digits) : a.name.toLowerCase().startsWith(lq))
      || (b.usageCount || 0) - (a.usageCount || 0) || +new Date(b.lastBillAt || 0) - +new Date(a.lastBillAt || 0))
    .slice(0, MAX_SUGGESTIONS)
  const bal = await balancesOf(req, local.map((c) => c._id))
  const out = local.map((c) => shape(c, bal))

  // Global DB is a fallback ONLY for a full 10-digit number (never for partial digits or names).
  // It returns that number's identity with its most-used name, flagged `exact`.
  if (phoneLike && PHONE_RE.test(digits) && !local.some((c) => c.phone === digits)) {
    const g = await GlobalUser.findOne({ phone: digits }).lean()
    if (g) out.push({ source: 'global', globalUserId: g._id, name: mostUsedName(g), phone: g.phone, usageCount: totalUses(g), exact: true, udharDue: 0, credit: 0 })
  }
  res.json(out)
})

// POST /api/seller/billing/customers/select  { globalUserId, name, phone }
// The seller picked a person from the GLOBAL list: copy them into this shop (name is the seller's own, editable).
export const selectGlobalCustomer = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const name = String(req.body.name || '').trim().slice(0, 80), phone = String(req.body.phone || '').trim()
  const g = req.body.globalUserId ? await GlobalUser.findById(req.body.globalUserId).lean().catch(() => null) : null
  if (!g || g.phone !== phone) return res.status(400).json({ message: 'That customer could not be verified. Search again.' })
  if (!name) return res.status(400).json({ message: 'Customer name is required.' })

  const mine = await Customer.findOne({ shopId: sid(req), phone })
  if (mine) return res.json(shape(mine, await balancesOf(req, [mine._id])))
  const clash = await Customer.findOne({ shopId: sid(req), name }).lean()
  if (clash) return res.status(409).json({ message: `You already have a customer named “${name}” with a different number. Change the name to save this one.` })

  const c = await Customer.create({ shopId: sid(req), name, phone, globalUserId: g._id, usageCount: totalUses(g) })
  await hooksFor(req.sellerType).ensureParty?.(req.sellerAccount, c)
  res.status(201).json(shape(c))
})

// POST /api/seller/billing/customers  { name, phone }   — quick add
export const addCustomer = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const name = String(req.body.name || '').trim(), phone = String(req.body.phone || '').trim()
  if (!name) return res.status(400).json({ message: 'Customer name is required.' })
  if (phone && !PHONE_RE.test(phone)) return res.status(400).json({ message: 'Mobile number must be 10 digits.' })
  const c = await Customer.findOneAndUpdate({ shopId: sid(req), name }, { $setOnInsert: { shopId: sid(req), name }, ...(phone ? { $set: { phone } } : {}) }, { upsert: true, new: true })
  await hooksFor(req.sellerType).ensureParty?.(req.sellerAccount, c) // study centre: the new person is registered as a Member too
  if (phone) { // join the global directory (count stays 0 until a bill is made)
    const g = await touchGlobalUser(phone, name, 0)
    if (g && String(c.globalUserId) !== String(g._id)) { c.globalUserId = g._id; await c.save() }
  }
  res.status(201).json(shape(c, await balancesOf(req, [c._id])))
})

// ───────────────────────── Drafts ─────────────────────────
const draftRow = (d) => ({ id: d._id, customerId: d.customerId, customerName: d.customerName || 'Walk-in', phone: d.customerPhone || '', total: d.total, itemCount: d.itemCount, updatedAt: d.updatedAt })

// GET /api/seller/billing/drafts — newest first
export const listDrafts = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  res.json((await BillDraft.find({ shopId: sid(req) }).sort({ updatedAt: -1 }).limit(30).select('-state').lean()).map(draftRow))
})

// POST /api/seller/billing/drafts  { id?, customer?, total, itemCount, state }  — create, or overwrite when `id` is given
export const saveDraft = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const { id, customer, state } = req.body
  if (!state || !Array.isArray(state.items) || state.items.length > 200) return res.status(400).json({ message: 'Nothing to save as a draft.' })
  if (!state.items.length && !customer?.name) return res.status(400).json({ message: 'Add a customer or a product before saving a draft.' })
  const doc = {
    customerId: customer?.id || null, customerName: String(customer?.name || '').slice(0, 80), customerPhone: String(customer?.phone || '').slice(0, 15),
    total: Math.max(Number(req.body.total) || 0, 0), itemCount: state.items.length,
    state: { items: state.items, method: state.method, recv: state.recv ?? null, retMode: state.retMode, retCustom: state.retCustom, notes: String(state.notes || '').slice(0, 300), discount: state.discount ?? '', discountType: state.discountType === 'percent' ? 'percent' : 'fixed', split: state.split && typeof state.split === 'object' ? { cash: String(state.split.cash ?? ''), upi: String(state.split.upi ?? ''), card: String(state.split.card ?? '') } : null, context: state.context && typeof state.context === 'object' ? state.context : {}, mode: state.mode || null },
  }
  const d = (id && (await BillDraft.findOneAndUpdate({ _id: id, shopId: sid(req) }, doc, { new: true }).catch(() => null))) || (await BillDraft.create({ shopId: sid(req), ...doc }))
  res.status(201).json(draftRow(d))
})

// GET /api/seller/billing/drafts/:id — the full saved state, with the customer's CURRENT udhar/advance (it may have changed since)
export const getDraft = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const d = await BillDraft.findOne({ _id: req.params.id, shopId: sid(req) }).lean().catch(() => null)
  if (!d) return res.status(404).json({ message: 'Draft not found.' })
  const c = d.customerId ? await Customer.findOne({ _id: d.customerId, shopId: sid(req) }).lean() : null
  res.json({ ...draftRow(d), state: d.state, customer: c ? shape(c, await balancesOf(req, [c._id])) : d.customerName ? { source: 'local', id: null, name: d.customerName, phone: d.customerPhone, udharDue: 0, credit: 0 } : null })
})

// DELETE /api/seller/billing/drafts/:id
export const deleteDraft = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  await BillDraft.deleteOne({ _id: req.params.id, shopId: sid(req) }).catch(() => null)
  res.json({ ok: true })
})

// GET /api/seller/billing/products — active inventory + the most frequently sold quantity per product
export const billingProducts = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const [products, freq] = await Promise.all([
    Product.find({ shopId: sid(req), active: { $ne: false } }).limit(500).lean(),
    Sale.aggregate([{ $match: { shopId: sid(req) } }, { $group: { _id: { p: '$productId', q: '$quantity' }, n: { $sum: 1 } } }, { $sort: { n: -1 } },
      { $group: { _id: '$_id.p', qty: { $first: '$_id.q' }, lines: { $sum: '$n' } } }]),
  ])
  const f = Object.fromEntries(freq.map((x) => [String(x._id), x]))
  res.json(products.map((p) => ({ id: p._id, name: p.name, price: p.price, priceUnit: p.priceUnit || 'unit', unlisted: p.listed === false, sellable: p.sellable !== false, cost: p.costPrice, stock: p.listed === false ? null : p.stock, icon: p.icon, topQty: f[String(p._id)]?.qty || 1, popularity: f[String(p._id)]?.lines || 0 }))
    .sort((a, b) => b.popularity - a.popularity))
})

// What the "Type" column says for a bill: the business schema names it (Membership · Course Fee · Book Issue · Fine · Other Charge …)
const typeLabelOf = (sellerType, b) => {
  const labels = schemaFor(sellerType).txnLabels, kinds = new Set((b.items || []).map((i) => i.type))
  if (kinds.size && [...kinds].every((k) => k === 'other')) return labelFor(sellerType, 'other') // an other-charge-only bill
  return labels[b.transactionType || 'sale'] || labels.sale
}
// GET /api/seller/billing/recent?limit=8
export const recentBills = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 50)
  const bills = await Bill.find({ shopId: sid(req) }).sort({ createdAt: -1 }).limit(limit).lean()
  const counts = await Sale.aggregate([{ $match: { shopId: sid(req), billId: { $in: bills.map((b) => b.billId) } } }, { $group: { _id: '$billId', n: { $sum: 1 } } }])
  const n = Object.fromEntries(counts.map((c) => [c._id, c.n]))
  // an udhar bill turns "Cleared" once that customer's account is back to ₹0 or in advance
  const names = [...new Set(bills.filter((b) => b.unpaidAmount > 0 && b.customerName).map((b) => b.customerName))]
  const accts = names.length ? await Udhar.find({ shopId: sid(req), customerName: { $in: names } }).select('customerName totalAmount').lean() : []
  const balOf = Object.fromEntries(accts.map((u) => [u.customerName, u.totalAmount]))
  // customer ids for the clickable name (older bills without customerId are matched by name) + live balances for "recent customers"
  const missing = [...new Set(bills.filter((b) => !b.customerId && b.customerName).map((b) => b.customerName))]
  const byName = missing.length ? Object.fromEntries((await Customer.find({ shopId: sid(req), name: { $in: missing } }).select('name').lean()).map((c) => [c.name, c._id])) : {}
  const idOf = (b) => b.customerId || byName[b.customerName] || null
  const bal = await balancesOf(req, [...new Set(bills.map(idOf).filter(Boolean).map(String))])
  res.json(bills.map((b) => {
    const cid = idOf(b), x = cid ? bal[String(cid)] || 0 : 0
    return { billId: b.billId, id: shortId(b), time: b.createdAt, customer: b.customerName || 'Walk-in', customerId: cid, phone: b.customerPhone || '', udharDue: Math.max(x, 0), credit: Math.max(-x, 0), items: b.items?.length || n[b.billId] || 0, transactionType: b.transactionType || 'sale', typeLabel: typeLabelOf(req.sellerType, b), amount: b.totalAmount, payment: payLabel(b), status: billStatus(b, balOf[b.customerName]) }
  }))
})

// GET /api/seller/billing/bills/:billId — full bill for the details modal / receipt
export const billDetail = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.billId }).lean()
  if (!bill) return res.status(404).json({ message: 'Bill not found.' })
  const lines = await Sale.find({ shopId: sid(req), billId: bill.billId }).populate('productId', 'name').lean()
  res.json({
    id: shortId(bill), billId: bill.billId, time: bill.createdAt, customer: bill.customerName || 'Walk-in', customerId: bill.customerId || null, phone: bill.customerPhone || '', payment: payLabel(bill), status: billStatus(bill), creditUsed: bill.creditUsed || 0, advanceAdded: bill.advanceAdded || 0,
    total: bill.totalAmount, paid: bill.paidAmount, due: bill.unpaidAmount, received: bill.receivedAmount ?? null, returned: bill.returnedAmount ?? null, notes: bill.notes || '', shopName: bizName(req.sellerAccount),
    transactionType: bill.transactionType || 'sale', discount: bill.discount || 0, subtotal: bill.subtotal ?? null, tax: bill.taxAmount || 0, taxName: bill.taxName || '', taxRate: bill.taxRate || 0, context: bill.context || [], paymentStatus: paymentStatusOf(bill), payments: await paymentsOf(bill),
    lines: bill.items?.length
      ? bill.items.map((i) => ({ type: i.type, name: i.name, qty: i.qty, unit: i.unit, price: i.rate, total: i.total, description: i.description || '', charge: i.charge || 'charged', discount: i.discount || 0 }))
      : lines.map((l) => ({ type: 'product', name: l.productId?.name || 'Item', qty: l.quantity, unit: l.unit, price: l.priceAtSale, total: Math.round(l.priceAtSale * l.quantity * 100) / 100 })),
  })
})


// ───────────────────── Universal billing: capabilities · service catalog · summary ─────────────────────
// Public business details printed on the customer's bill (no owner-private fields).
const businessOf = (account, sellerType) => ({
  name: accountName(account), phone: account.phone || '',
  logoUrl: account.logoUrl || '', // shops and study centres have a logo; service providers keep an empty one (as before)
  address: account.location?.address || account.address || account.serviceArea || '',
})
const configOf = (req) => {
  const caps = billingCapabilities(req.sellerAccount, req.sellerType)
  const order = schemaFor(req.sellerType).billing.order, rank = (t) => (order.includes(t) ? order.indexOf(t) : 99)
  const on = enabledTypes(caps).sort((a, b) => rank(a) - rank(b))
  return { capabilities: caps, lineTypes: on.map((t) => ({ type: t, label: labelFor(req.sellerType, t), addLabel: addLabelFor(req.sellerType, t) })), sellerType: req.sellerType, partyLabel: schemaFor(req.sellerType).billing.partyLabel, business: businessOf(req.sellerAccount, req.sellerType) }
}

// GET /api/seller/billing/config — what this business can put on a bill (drives which "+ Add …" buttons exist)
export const getBillingConfig = asyncHandler(async (req, res) => res.json(configOf(req)))

// PUT /api/seller/billing/config  { products?, services?, materials?, labour?, otherCharges?, discount?, partialPayment?, udhar?, context?: [{label, required}] }
export const updateBillingConfig = asyncHandler(async (req, res) => {
  const clean = sanitizeCapabilities(req.body)
  const merged = { ...(req.sellerAccount.billing?.capabilities || {}), ...clean }
  req.sellerAccount.billing = { capabilities: merged }
  req.sellerAccount.markModified('billing')
  await req.sellerAccount.save()
  res.json(configOf(req))
})

const svcRow = (x) => ({ id: x._id, kind: x.kind, name: x.name, rate: x.rate, pricing: x.pricing, unit: x.unit, usedCount: x.usedCount })
// GET /api/seller/billing/services?kind=service|labour — quick-picks, most used first
export const listServices = asyncHandler(async (req, res) => {
  const q = { shopId: sid(req), active: true, ...(['service', 'labour'].includes(req.query.kind) ? { kind: req.query.kind } : {}) }
  res.json((await ServiceItem.find(q).sort({ usedCount: -1, name: 1 }).limit(200).lean()).map(svcRow))
})
// POST /api/seller/billing/services  { kind, name, rate, pricing, unit }  — save/update a quick-pick (same name+kind updates it)
export const saveService = asyncHandler(async (req, res) => {
  const kind = req.body.kind === 'labour' ? 'labour' : 'service', name = String(req.body.name || '').trim().slice(0, 80), rate = Number(req.body.rate)
  if (!name) return res.status(400).json({ message: 'Name is required.' })
  if (!(rate >= 0)) return res.status(400).json({ message: 'Rate must be 0 or more.' })
  const pricing = ['fixed', 'per_unit', 'hourly', 'custom'].includes(req.body.pricing) ? req.body.pricing : 'fixed'
  const doc = await ServiceItem.findOneAndUpdate({ shopId: sid(req), kind, name: new RegExp(`^${esc(name)}$`, 'i') },
    { $set: { rate, pricing, unit: String(req.body.unit || '').slice(0, 12), active: true }, $setOnInsert: { shopId: sid(req), kind, name } }, { upsert: true, new: true })
  res.status(201).json(svcRow(doc))
})
// DELETE /api/seller/billing/services/:id — hides it from the picker (old bills keep their own snapshot)
export const deleteService = asyncHandler(async (req, res) => {
  await ServiceItem.updateOne({ _id: req.params.id, shopId: sid(req) }, { $set: { active: false } }).catch(() => null)
  res.json({ ok: true })
})

// GET /api/seller/billing/summary?days=30 — ONE standardized financial summary for every business type.
// Legacy bills (no revenue split) count entirely as product revenue; their cost comes from the Sale lines.
export const billingSummary = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365)
  const since = new Date(Date.now() - days * 864e5)
  const shopId = sid(req)
  const bills = await Bill.find({ shopId, createdAt: { $gte: since }, orderStatus: { $ne: 'Cancelled' } }).lean()
  const legacy = bills.filter((b) => !b.revenue).map((b) => b.billId)
  const sales = legacy.length ? await Sale.find({ shopId, billId: { $in: legacy }, cancelled: { $ne: true } }).select('costAtSale quantity').lean() : []
  const legacyUnits = round2(sales.reduce((s, l) => s + l.quantity, 0))
  const legacyCost = round2(sales.reduce((s, l) => s + l.costAtSale * l.quantity, 0))
  const z = () => ({ product: 0, material: 0, service: 0, labour: 0, other: 0 })
  const rev = z(), cnt = { sale: 0, service: 0, labour: 0, mixed: 0 }
  let productCost = 0, materialCost = 0, paid = 0, outstanding = 0, consumedUnits = 0, materialUnits = 0, discountTotal = 0, taxTotal = 0
  for (const b of bills) {
    if (b.revenue) for (const k of Object.keys(b.revenue)) rev[k] = (rev[k] || 0) + (b.revenue[k] || 0) // base kinds always; study kinds only when billed
    else rev.product += b.totalAmount
    cnt[b.transactionType || 'sale']++
    productCost += b.cost?.product || 0; materialCost += b.cost?.material || 0
    paid += b.paidAmount || 0; outstanding += b.unpaidAmount || 0
    discountTotal += b.discount || 0; taxTotal += b.taxAmount || 0
    for (const i of b.items || []) { if (i.type === 'material') materialUnits += i.qty; if (i.type === 'material' || i.type === 'product') consumedUnits += i.qty }
  }
  productCost = round2(productCost + legacyCost); materialCost = round2(materialCost)
  const totalRevenue = round2(Object.values(rev).reduce((a, b) => a + b, 0)) // net of discount, EXCLUDING tax
  const grandTotal = round2(bills.reduce((s, b) => s + b.totalAmount, 0)) // what customers were billed (revenue + tax)
  const goodsRevenue = rev.product + rev.material
  // Additive (existing fields unchanged): per-day revenue and top billed lines, read from what each bill already stored (utils/billingSeries.js).
  const daily = dailySeries(bills), topItemsList = topItems(bills)
  res.json({
    days, daily, topItems: topItemsList, bills: bills.length, totalRevenue, grandTotal, discount: round2(discountTotal), tax: round2(taxTotal),
    revenue: Object.fromEntries(Object.entries(rev).map(([k, v]) => [k, round2(v)])),
    productCost, materialCost, inventoryConsumed: round2(consumedUnits + legacyUnits), materialUnits: round2(materialUnits),
    grossProfit: round2(totalRevenue - productCost - materialCost), // service/labour carry no cost of goods here
    goodsGrossProfit: round2(goodsRevenue - productCost - materialCost),
    paid: round2(paid), outstanding: round2(outstanding),
    udharBills: bills.filter((b) => b.unpaidAmount > 0).length,
    transactions: { sale: cnt.sale, service: cnt.service, labour: cnt.labour, mixed: cnt.mixed },
  })
})

// GET /api/seller/billing/bills/:billId/document — the CUSTOMER-FACING bill. Built by whitelist (utils/billing.js#buildDocument):
// 80mm print, A4 print, WhatsApp, SMS and Telegram all render from this one object, so none of them can leak cost, batches or internal notes.
export const billDocument = asyncHandler(async (req, res) => {
  const bill = await Bill.findOne({ shopId: sid(req), billId: req.params.billId }).lean()
  if (!bill) return res.status(404).json({ message: 'Bill not found.' })
  let items = bill.items
  if (!items?.length) { // a bill from before universal billing: rebuild its lines from the Sale rows
    const sales = await Sale.find({ shopId: sid(req), billId: bill.billId }).populate('productId', 'name').lean()
    items = sales.map((l) => ({ type: 'product', name: l.productId?.name || 'Item', qty: l.quantity, unit: l.unit === 'unit' ? '' : l.unit, rate: l.priceAtSale, total: round2(l.priceAtSale * l.quantity) }))
  }
  const caps = billingCapabilities(req.sellerAccount, req.sellerType)
  const sch = schemaFor(req.sellerType)
  const member = hasCapability(req.sellerType, 'members') && bill.customerId ? await StudyMember.findOne({ centerId: sid(req), customerId: bill.customerId }).select('memberCode').lean() : null
  res.json(buildDocument({
    business: businessOf(req.sellerAccount, req.sellerType),
    bill: { ...bill, items, displayId: shortId(bill), memberCode: member?.memberCode || '' },
    payments: await paymentsOf(bill), terms: caps.terms, partyLabel: sch.billing.partyLabel, partyIdLabel: member ? `${sch.billing.partyLabel} ID` : '',
  }))
})
