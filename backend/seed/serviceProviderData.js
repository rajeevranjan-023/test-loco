// Pure, deterministic Service Provider dev-data generator (no DB calls) — "CoolFix Home Services", a HYBRID provider:
// it bills services + labour + materials, and also sells parts over the counter.
//   • Same seed + same `now` → same data (a seeded PRNG, never Math.random).
//   • Built on the real engines: computeBill (totals), addBatch/consumeFIFO (batch stock + cost), generateBillId's pure helpers,
//     so every bill, batch and ledger line is shaped exactly as the app itself would write it.
//   • Everything is linked through real ids: Bill.items[].refId → ServiceItem/Product, Bill.customerId → Customer,
//     UdharHistory/Udhar → Customer, Sale → Product + billId.
import mongoose from 'mongoose'
import { computeBill, costBreakdown, deriveTransactionType, r2 } from '../utils/billing.js'
import { addBatch, consumeFIFO, codeFor, weightedCost, r3 } from '../utils/stock.js'
import { dateParts, slotFor, formatBillId, formatFullId } from '../utils/billId.js'

const DAY = 864e5
const oid = () => new mongoose.Types.ObjectId()

export const PROVIDER = { name: 'Rakesh Soni', businessName: 'CoolFix Home Services', username: '@coolfix417', phone: '9876500201', email: 'demo.service@example.com', workType: 'AC & Appliance Repair' }
export const SHOP_REF = PROVIDER.username.replace(/[^A-Za-z0-9]/g, '').toUpperCase() // same rule as utils/billId.js shopRefOf

// Billing capabilities for a hybrid provider (read through utils/billingConfig.js like every other business).
export const CAPABILITIES = {
  products: true, services: true, materials: true, labour: true, otherCharges: true, discount: true, tax: false, editRate: true, partialPayment: true, udhar: true,
  context: [{ key: 'device', label: 'Device / Model', required: false }],
}

export const SERVICES = [
  { kind: 'service', name: 'AC General Service', rate: 600, pricing: 'fixed', unit: '' },
  { kind: 'service', name: 'AC Gas Refill', rate: 2200, pricing: 'fixed', unit: '' },
  { kind: 'service', name: 'AC Installation', rate: 1500, pricing: 'fixed', unit: '' },
  { kind: 'service', name: 'Washing Machine Repair (visit)', rate: 450, pricing: 'fixed', unit: '' },
  { kind: 'service', name: 'Refrigerator Repair (visit)', rate: 400, pricing: 'fixed', unit: '' },
  { kind: 'labour', name: 'Technician Labour', rate: 300, pricing: 'hourly', unit: 'hr' },
  { kind: 'labour', name: 'Helper Labour', rate: 150, pricing: 'hourly', unit: 'hr' },
]

// name, category, sell, cost, opening qty, icon, sellable (false = a part used inside services only)
export const PARTS = [
  ['AC Capacitor 35µF', 'AC Parts', 450, 320, 40, '🔌', true],
  ['Copper Pipe Joint', 'AC Parts', 120, 80, 90, '🔩', false],
  ['Universal AC Remote', 'Accessories', 350, 250, 45, '🎛️', true],
  ['Washing Machine Belt', 'Appliance Parts', 220, 150, 30, '⚙️', true],
  ['Fan Motor', 'Appliance Parts', 1800, 1450, 22, '🌀', true],
  ['Drain Pipe (1m)', 'AC Parts', 90, 60, 60, '🚿', false],
]

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Rohan', 'Karan', 'Ishaan', 'Dev', 'Nikhil', 'Sachin', 'Ananya', 'Diya', 'Isha', 'Kriti', 'Pallavi', 'Tanvi', 'Swati', 'Shweta', 'Komal']
const LAST = ['Sharma', 'Gupta', 'Yadav', 'Jain', 'Patel', 'Mishra', 'Tiwari', 'Rao', 'Soni', 'Thakur']
const DEVICES = ['Voltas 1.5 Ton Split AC', 'LG 1 Ton Window AC', 'Samsung Front-Load Washer', 'Whirlpool 265L Fridge', 'Daikin 1.5 Ton Inverter AC', 'IFB Top-Load Washer', 'Godrej Double-Door Fridge']
const METHODS = ['cash', 'upi', 'upi', 'card', 'cash']

export function generateService({ providerId, now = Date.now(), seed = 17, days = 150 } = {}) {
  let s = seed >>> 0 || 1
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]

  // ───────── catalogue: saved services / labour types ─────────
  const services = SERVICES.map((x) => ({ _id: oid(), shopId: providerId, ...x, active: true, usedCount: 0, lastUsedAt: null, createdAt: new Date(now - (days + 20) * DAY), updatedAt: new Date(now - (days + 20) * DAY) }))
  const svc = Object.fromEntries(services.map((x) => [x.name, x]))

  // ───────── parts / products with batch stock (opening batch + one restock) ─────────
  const openingAt = new Date(now - (days + 10) * DAY)
  const products = PARTS.map(([name, category, price, cost, qty, icon, sellable], i) => {
    const p = { _id: oid(), shopId: providerId, productCode: codeFor(i + 1), name, category, price, priceUnit: 'unit', costPrice: cost, costPriceUnit: 'unit', stock: 0, batches: [], icon, imageUrl: '', videoUrl: '', description: '', sellable, active: true, listed: true,
      lowStockAt: 10, sold: 0, consumed: 0, billedCount: 0, lastBilledAt: null, expiryDate: null, costHistory: [{ costPrice: cost, at: openingAt }], priceHistory: [{ price, at: openingAt }], createdAt: openingAt, updatedAt: openingAt }
    addBatch(p, { quantity: qty, costPrice: cost, sellingPrice: price, addedAt: openingAt, source: 'opening', note: 'Opening stock' })
    return p
  })
  const prod = Object.fromEntries(products.map((p) => [p.name, p]))
  // a restock at a higher cost (so FIFO cost differs between old and new batches) — applied in time order below
  const restocks = [{ at: new Date(now - 70 * DAY), name: 'AC Capacitor 35µF', quantity: 30, costPrice: 335 }, { at: new Date(now - 55 * DAY), name: 'Copper Pipe Joint', quantity: 40, costPrice: 85 }]

  // ───────── customers ─────────
  const combos = FIRST.flatMap((f) => LAST.map((l) => `${f} ${l}`))
  for (let i = combos.length - 1; i > 0; i--) { const j = int(0, i); [combos[i], combos[j]] = [combos[j], combos[i]] } // seeded shuffle
  const customers = combos.slice(0, 32).map((name, i) => ({ _id: oid(), shopId: providerId, name, phone: `98770${String(10000 + i * 7)}`, lastBillAt: null, usageCount: 0, creditBalance: 0, createdAt: new Date(now - int(100, days) * DAY), updatedAt: new Date(now) }))

  // ───────── bill slots in time order ─────────
  const slots = []
  for (let d = days; d >= 0; d--) {
    const n = rnd() < 0.2 ? 0 : rnd() < 0.7 ? 1 : 2
    for (let k = 0; k < n; k++) { const base = new Date(now - d * DAY); base.setHours(int(9, 19), int(0, 59), 0, 0); const at = +base > now - 36e5 ? new Date(now - int(2, 50) * 6e4 - k * 6e4) : base; slots.push(at) }
  }
  slots.sort((a, b) => +a - +b)

  const bills = [], sales = [], counters = new Map(), ledger = new Map()
  let pendingRestocks = [...restocks].sort((a, b) => +a.at - +b.at)

  // a line the billing screen would produce; product/material lines draw stock FIFO and snapshot the batch cost
  const chargeLine = (name, qty = 1, extra = {}) => { const x = svc[name]; return { type: x.kind, refId: x._id, name, qty, unit: x.unit, rate: x.rate, pricing: x.pricing, charge: 'charged', ...extra } }
  const partLine = (type, name, qty, charge = 'charged', when) => {
    const p = prod[name]; const take = Math.min(qty, p.stock)
    if (take <= 0) return null
    const pieces = consumeFIFO(p, take)
    if (type === 'material') p.consumed = r3(p.consumed + take); else { p.sold = r3(p.sold + take); p.billedCount += 1 }
    p.lastBilledAt = when; p.updatedAt = when
    return { type, refId: p._id, name, qty: take, unit: 'unit', rate: p.price, pricing: 'fixed', charge, cost: weightedCost(pieces), costBreakdown: pieces, _product: p }
  }

  const jobs = [
    // AC service with a joint used inside the price (included) — customer pays the service only
    (w) => [chargeLine('AC General Service'), partLine('material', 'Copper Pipe Joint', int(1, 2), 'included', w)],
    // gas refill: service + technician hours + charged material
    (w) => [chargeLine('AC Gas Refill'), chargeLine('Technician Labour', int(1, 2)), partLine('material', 'Drain Pipe (1m)', 1, 'charged', w)],
    // installation with helper, internal (not charged) consumable
    (w) => [chargeLine('AC Installation'), chargeLine('Helper Labour', int(1, 3)), partLine('material', 'Copper Pipe Joint', int(2, 3), 'internal', w)],
    // appliance repair visit + part used (charged) + labour
    (w) => [chargeLine(pick(['Washing Machine Repair (visit)', 'Refrigerator Repair (visit)'])), partLine('material', pick(['Washing Machine Belt', 'Fan Motor']), 1, 'charged', w), chargeLine('Technician Labour', 1)],
    // over-the-counter part sale (no service)
    (w) => [partLine('product', pick(['AC Capacitor 35µF', 'Universal AC Remote', 'Washing Machine Belt']), int(1, 2), 'charged', w)],
    // mixed: service + product + other charge
    (w) => [chargeLine('AC General Service'), partLine('product', 'Universal AC Remote', 1, 'charged', w), { type: 'other', refId: null, name: 'Transport', qty: 1, unit: '', rate: 100, pricing: 'fixed', charge: 'charged' }],
  ]
  const WEIGHT = [0, 0, 1, 1, 2, 3, 3, 4, 5, 0, 1, 3]

  const billIds = new Map()
  slots.forEach((when, idx) => {
    while (pendingRestocks.length && +pendingRestocks[0].at <= +when) { const r = pendingRestocks.shift(); addBatch(prod[r.name], { quantity: r.quantity, costPrice: r.costPrice, sellingPrice: prod[r.name].price, addedAt: r.at, source: 'restock', note: 'Restock' }) }
    const cust = customers[Math.min(customers.length - 1, Math.floor(rnd() ** 1.6 * customers.length))]
    const raw = jobs[pick(WEIGHT)](when).filter(Boolean)
    if (!raw.length) return
    // one in six billed lines carries a line discount, one in five bills a bill-level discount
    const lines = raw.map((l) => { const { _product, ...x } = l; return { ...x, discountType: 'fixed', discountValue: 0 } })
    const billable = lines.findIndex((l) => l.charge === 'charged' && l.type !== 'other' && l.rate * l.qty >= 600)
    if (billable >= 0 && rnd() < 0.17) { lines[billable].discountType = 'percent'; lines[billable].discountValue = pick([5, 10]) }
    const discount = rnd() < 0.2 ? (rnd() < 0.5 ? { type: 'percent', value: pick([5, 10]) } : { type: 'fixed', value: pick([50, 100]) }) : null
    const calc = computeBill(lines, { discount: discount || 0 })
    const total = calc.total
    if (!(total > 0)) return
    const roll = rnd(), mode = roll < 0.68 ? 'paid' : roll < 0.86 ? 'partial' : 'unpaid'
    const got = mode === 'paid' ? total : mode === 'unpaid' ? 0 : r2(Math.min(total - 10, Math.max(10, Math.round((total * (0.4 + rnd() * 0.3)) / 10) * 10)))
    const unpaid = r2(total - got), method = pick(METHODS), pm = unpaid > 0 && got === 0 ? 'udhar' : method
    const d = dateParts(when), n = (counters.get(d.date) || 0) + 1; counters.set(d.date, n)
    const slot = slotFor(n)
    const items = lines.map((l, k) => ({ type: l.type, refId: l.refId || null, name: l.name, qty: l.qty, unit: l.unit || '', rate: l.rate, total: calc.lines[k].total, pricing: l.pricing, description: '', charge: l.charge, discountType: l.discountType, discountValue: l.discountValue, discount: calc.lines[k].discount, cost: l.cost || 0, ...(l.costBreakdown ? { costBreakdown: l.costBreakdown } : {}) }))
    const doc = {
      _id: oid(), shopId: providerId, billId: formatBillId({ ...d, ...slot }), fullId: formatFullId({ shopRef: SHOP_REF, ...d, ...slot }), customerName: cust.name, customerPhone: cust.phone, customerId: cust._id, channel: 'offline',
      totalAmount: total, paidAmount: got, unpaidAmount: unpaid, paymentStatus: unpaid <= 0 ? 'paid' : got <= 0 ? 'unpaid' : 'partial', paymentMethod: pm, status: unpaid > 0 ? 'udhar' : 'paid',
      creditUsed: 0, advanceAdded: 0, receivedAmount: got, returnedAmount: 0, notes: '', deliveryCharge: 0, otherIncome: 0, orderStatus: 'Delivered', cancelledAt: null,
      discount: calc.discount, subtotal: calc.subtotal, ...(discount && discount.value ? { discountType: discount.type, discountValue: discount.value } : {}),
      ...(got > 0 ? { payments: [{ method: pm === 'udhar' ? 'cash' : pm, amount: got, at: when }] } : {}),
      transactionType: deriveTransactionType(lines), items, revenue: calc.revenue, cost: costBreakdown(lines),
      ...(rnd() < 0.55 ? { context: [{ key: 'device', label: 'Device / Model', value: pick(DEVICES) }] } : {}),
      createdAt: when, updatedAt: when,
    }
    const rec = { when, doc }; bills.push(rec); billIds.set(doc.billId, rec)
    // usage counters the real billing writes
    lines.forEach((l) => { if (l.type === 'service' || l.type === 'labour') { const x = services.find((y) => String(y._id) === String(l.refId)); x.usedCount += 1; x.lastUsedAt = when } })
    // Sale rows for product + material lines (what salesController writes), linked by billId + productId
    items.forEach((it) => { if (it.type === 'product' || it.type === 'material') sales.push({ _id: oid(), shopId: providerId, productId: it.refId, quantity: it.qty, unit: 'unit', priceAtSale: it.charge === 'charged' ? it.rate : 0, costAtSale: it.cost, costBreakdown: it.costBreakdown, channel: 'offline', customerName: cust.name, billId: doc.billId, cancelled: false, createdAt: when, updatedAt: when }) })
    cust.usageCount += 1; cust.lastBillAt = when
    if (unpaid > 0) { const led = ledger.get(String(cust._id)) || ledger.set(String(cust._id), []).get(String(cust._id)); led.push({ type: 'udhar', amount: unpaid, delta: unpaid, date: when, billRec: rec, source: 'billing', paymentType: pm, note: 'Bill' }) }
  })

  // restocks dated after the last bill still happened (they are in the past)
  for (const r of pendingRestocks) addBatch(prod[r.name], { quantity: r.quantity, costPrice: r.costPrice, sellingPrice: prod[r.name].price, addedAt: r.at, source: 'restock', note: 'Restock' })
  pendingRestocks = []

  // ───────── dues: some customers settle later, some part-pay, some still owe (ages vary) ─────────
  let ci = 0
  for (const cust of customers) {
    const led = ledger.get(String(cust._id)); if (!led || !led.length) continue
    const owed = r2(led.reduce((x, e) => x + e.amount, 0)), lastAt = Math.max(...led.map((e) => +e.date))
    const plan = ci++ % 3
    const payAt = new Date(Math.min(now - 36e5, lastAt + int(2, 9) * DAY))
    if (plan === 0 && +payAt > lastAt) led.push({ type: 'payment', amount: owed, delta: -owed, date: payAt, billRec: null, source: 'manual', paymentType: pick(['upi', 'cash']), note: 'Cleared' })
    else if (plan === 1 && owed >= 100 && +payAt > lastAt) { const part = Math.round((owed * 0.5) / 10) * 10 || 10; led.push({ type: 'payment', amount: part, delta: -part, date: payAt, billRec: null, source: 'manual', paymentType: 'upi', note: 'Part payment' }) }
  }

  // ───────── ledger replay → Udhar + UdharHistory (balance after every entry) ─────────
  const udhars = [], history = []
  for (const cust of customers) {
    const entries = (ledger.get(String(cust._id)) || []).sort((a, b) => +a.date - +b.date); if (!entries.length) continue
    let bal = 0, pendingSince = null, clearedAt = null, lastAddedAt = null
    for (const e of entries) {
      const prev = bal; bal = r2(bal + e.delta)
      if (e.type === 'udhar') lastAddedAt = e.date
      if (prev <= 0.005 && bal > 0.005) pendingSince = e.date
      if (prev > 0.005 && bal <= 0.005) { clearedAt = e.date; pendingSince = null }
      history.push({ _id: oid(), shopId: providerId, customerId: cust._id, type: e.type, amount: e.amount, delta: e.delta, source: e.source, billId: e.billRec?.doc.billId || null, items: [], paymentType: e.paymentType, note: e.note, balanceAfter: bal, date: e.date, createdAt: e.date, updatedAt: e.date })
      if (e.billRec) e.billRec.doc.balanceAfter = bal
    }
    udhars.push({ _id: oid(), shopId: providerId, customerId: cust._id, customerName: cust.name, phone: cust.phone, totalAmount: bal, pinned: false, lastAddedAt, pendingSince: bal > 0.005 ? pendingSince : null, clearedAt: bal <= 0.005 ? clearedAt : null, lastUpdated: entries[entries.length - 1].date, createdAt: entries[0].date, updatedAt: entries[entries.length - 1].date })
  }
  udhars.filter((u) => u.totalAmount > 0).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 2).forEach((u) => (u.pinned = true))

  const billDocs = bills.map((r) => r.doc)
  const billCounters = [...counters.entries()].map(([date, n]) => ({ shopId: providerId, date, series: slotFor(n).series, count: slotFor(n).count, issued: n }))
  return { services, products, sales, customers: customers.filter((c) => c.usageCount > 0), bills: billDocs, billCounters, udhars, history }
}
