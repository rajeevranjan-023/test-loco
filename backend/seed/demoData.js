// Pure demo-data generator (no DB calls): 300 days of realistic shop activity for one shop.
import mongoose from 'mongoose'

const DAY = 864e5
const oid = () => new mongoose.Types.ObjectId()

// name, category, sell, cost, stock, icon, image (files in the frontend /public folder), expiry days (optional)
export const PRODUCTS = [
  ['Amul Taaza Milk (1L)', 'Dairy', 50, 45, 25, '🥛', '/amul-milk.png', 4], ['Tata Salt (1kg)', 'Grocery', 28, 23, 15, '🧂', ''], ['Maggi Noodles (70g)', 'Snacks', 14, 11, 10, '🍜', '/maggi.png'],
  ['Sugar (1kg)', 'Grocery', 46, 40, 4, '🍬', ''], ['Fortune Oil (1L)', 'Grocery', 135, 120, 30, '🫙', '/sunflower-oil.png'], ['Sunfeast Biscuits', 'Snacks', 15, 12, 8, '🍪', ''],
  ['Parle-G Biscuit (100g)', 'Snacks', 10, 8, 120, '🍪', '/parle-g.png'], ['Aashirvaad Atta (1kg)', 'Grocery', 66, 58, 40, '🌾', '/aashirvaad-atta.png'], ['Bread', 'Grocery', 35, 28, 25, '🍞', '/bread.png', 3],
  ['Milk (1L)', 'Dairy', 52, 46, 30, '🥛', '/milk.png', 6], ['Curd (400g)', 'Dairy', 32, 26, 22, '🥣', '', 9], ['Paneer (200g)', 'Dairy', 85, 70, 14, '🧀', '', 12],
  ['Coca-Cola (750ml)', 'Beverages', 46, 38, 48, '🥤', '/coca-cola.png'], ['Frooti (200ml)', 'Beverages', 20, 16, 70, '🧃', ''], ['Tea Powder (250g)', 'Beverages', 120, 100, 18, '🍵', ''],
  ['Surf Excel (1kg)', 'Personal Care', 120, 102, 20, '🧺', '/surf-excel.png'], ['Dettol Soap (75g)', 'Personal Care', 38, 30, 55, '🧼', ''], ['Colgate Paste', 'Personal Care', 95, 80, 33, '🪥', ''],
  ['Shampoo Sachet', 'Personal Care', 3, 2, 200, '🧴', ''], ['Lays Chips', 'Snacks', 20, 16, 90, '🥔', ''], ['Kurkure', 'Snacks', 20, 16, 75, '🌽', ''],
  ['Matchbox (10)', 'Others', 20, 15, 60, '🔥', ''], ['Candles (pack)', 'Others', 40, 30, 26, '🕯️', ''], ['Notebook', 'Others', 45, 34, 35, '📓', ''],
]
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Rohan', 'Karan', 'Ishaan', 'Kabir', 'Dev', 'Nikhil', 'Sachin', 'Ananya', 'Diya', 'Isha', 'Kriti', 'Pallavi', 'Sneha', 'Tanvi', 'Swati', 'Shweta', 'Komal']
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Yadav', 'Jain', 'Patel', 'Mishra', 'Tiwari', 'Rao', 'Soni', 'Thakur', 'Dubey', 'Agarwal', 'Chouhan']
export const CUSTOMERS = [
  'Rahul Verma', 'Priya Sharma', 'Amit Kumar', 'Neha Singh', 'Suresh Yadav', 'Anita Jain', 'Vikas Gupta', 'Sunita Devi', 'Rohit Mishra', 'Pooja Patel',
  ...FIRST.flatMap((f) => LAST.map((l) => `${f} ${l}`)),
]
const HOUR_W = { 7: 2, 8: 4, 9: 7, 10: 8, 11: 6, 12: 5, 13: 3, 14: 2, 15: 3, 16: 5, 17: 8, 18: 10, 19: 9, 20: 6, 21: 3 }
const MINS = [2, 15, 32, 60, 120]
const STATUS = ['New', 'Preparing', 'Out for Delivery', 'Delivered', 'Delivered']

export function generateDemo({ shopId, seed = 11, days = 300, now = Date.now() }) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  const wpick = (w) => { const e = Object.entries(w), t = e.reduce((x, [, v]) => x + v, 0); let r = rnd() * t; for (const [k, v] of e) if ((r -= v) <= 0) return +k; return +e[0][0] }

  const products = PRODUCTS.map(([name, category, price, costPrice, stock, icon, imageUrl, expiry]) => ({
    _id: oid(), shopId, name, category, price, costPrice, stock, icon, imageUrl, lowStockAt: 10, active: true, sold: 0,
    priceUnit: ['Sugar (1kg)', 'Aashirvaad Atta (1kg)'].includes(name) ? 'kg' : 'unit', costPriceUnit: 'unit', videoUrl: '', description: '',
    expiryDate: expiry ? new Date(now + expiry * DAY) : null, createdAt: new Date(now - 320 * DAY), updatedAt: new Date(now) }))
  // staples sell more; a couple of slow movers so "least sold" is meaningful
  const weight = (p) => (p.price < 60 ? 4 : p.price >= 100 ? 0.8 : 2) * (['Notebook', 'Candles (pack)', 'Dettol Soap (75g)', 'Matchbox (10)'].includes(p.name) ? 0.3 : 1) * (p.name.startsWith('Amul') ? 3 : 1)
  const bag = products.flatMap((p) => Array(Math.max(1, Math.round(weight(p) * 2))).fill(p))

  const bills = [], sales = [], credits = []
  let nextCust = 8
  const makeBill = (when, recentIdx = -1) => {
    const billId = oid().toString()
    const channel = rnd() < 0.45 ? 'online' : 'offline'
    let customerName = ''
    if (rnd() < 0.86) {
      if (rnd() < 0.12 && nextCust < CUSTOMERS.length - 1) customerName = CUSTOMERS[nextCust++]
      else customerName = CUSTOMERS[Math.min(nextCust - 1, Math.floor(rnd() ** 2.2 * nextCust))]
    }
    let total = 0
    for (let i = 0, n = int(1, 3); i < n; i++) {
      const p = pick(bag), quantity = rnd() < 0.7 ? 1 : 2; total += p.price * quantity; p.sold += quantity
      sales.push({ _id: oid(), shopId, productId: p._id, quantity, unit: p.priceUnit, priceAtSale: p.price, costAtSale: p.costPrice, channel, customerName, billId, createdAt: when, updatedAt: when })
    }
    const m = rnd()
    bills.push({ _id: oid(), shopId, billId, customerName, customerPhone: '', channel, totalAmount: total, paidAmount: total, unpaidAmount: 0, paymentStatus: 'paid',
      paymentMethod: m < 0.48 ? 'upi' : m < 0.8 ? 'cash' : m < 0.92 ? 'card' : 'cash',
      deliveryCharge: channel === 'online' && rnd() < 0.6 ? pick([20, 30]) : 0, discount: rnd() < 0.12 ? Math.round(total * (0.04 + rnd() * 0.05)) : 0, otherIncome: rnd() < 0.05 ? int(5, 20) : 0,
      orderStatus: recentIdx >= 0 ? STATUS[recentIdx] : 'Delivered', creditId: null, createdAt: when, updatedAt: when })
  }
  for (let d = days - 1; d >= 0; d--) {
    const base = new Date(now - d * DAY); base.setHours(0, 0, 0, 0)
    const n = Math.max(3, Math.round(6 + 3.2 * (1 - d / days) + Math.sin(d / 3) * 1.6 + rnd() * 2 + (base.getDay() === 0 ? 1.5 : 0)))
    for (let i = 0; i < n; i++) {
      const when = new Date(+base + wpick(HOUR_W) * 36e5 + int(0, 59) * 6e4)
      if (+when < now - 3 * 36e5) makeBill(when)
    }
  }
  MINS.forEach((m, i) => makeBill(new Date(now - m * 6e4), i)) // five freshest orders for "Recent Orders"

  // saved customers (with mobile numbers) for billing type-ahead
  const phones = new Set(); const last = {}, firstAt = {}
  bills.forEach((b) => { if (!b.customerName) return; last[b.customerName] = Math.max(last[b.customerName] || 0, +b.createdAt); firstAt[b.customerName] = Math.min(firstAt[b.customerName] || Infinity, +b.createdAt) })
  const customers = Object.keys(last).map((name) => {
    let ph = name === 'Rahul Verma' ? '9876543210' : `9${int(100000000, 999999999)}`; while (phones.has(ph)) ph = `9${int(100000000, 999999999)}`; phones.add(ph)
    return { _id: oid(), shopId, name, phone: ph, lastBillAt: new Date(last[name]), createdAt: new Date(firstAt[name]), updatedAt: new Date(last[name]) }
  })
  const phoneOf = Object.fromEntries(customers.map((c) => [c.name, c.phone]))
  const idOf = Object.fromEntries(customers.map((c) => [c.name, c._id]))
  bills.forEach((b) => { if (b.customerName) { b.customerPhone = phoneOf[b.customerName]; b.customerId = idOf[b.customerName] } })

  // ───────── udhar notebook: 35 customers · 18 pending (4 pinned) · 17 cleared · 8 months of history ─────────
  const byCust = {}; bills.forEach((b) => b.customerName && (byCust[b.customerName] ||= []).push(b))
  const prodName = Object.fromEntries(products.map((p) => [String(p._id), p.name]))
  const linesOf = {}; sales.forEach((x) => (linesOf[x.billId] ||= []).push({ name: prodName[String(x.productId)], qty: x.quantity, price: x.priceAtSale }))
  const cByName = Object.fromEntries(customers.map((c) => [c.name, c]))
  const chosen = CUSTOMERS.filter((n) => cByName[n] && (byCust[n] || []).length >= 2).slice(0, 35)
  const usedBill = new Set(), udhars = [], history = []
  const PT = () => { const r = rnd(); return r < 0.5 ? 'cash' : r < 0.85 ? 'upi' : 'card' }
  chosen.forEach((name, ci) => {
    const c = cByName[name], mine = byCust[name], pending = ci < 18, ev = []
    const add = (date, amt, bill) => {
      if (bill) { usedBill.add(bill.billId); const a = Math.min(amt, Math.max(10, Math.round(bill.totalAmount / 10) * 10)); ev.push({ type: 'udhar', amount: a, date: bill.createdAt, source: 'billing', billId: bill.billId, items: linesOf[bill.billId] || [], pt: 'udhar', bill }) }
      else ev.push({ type: 'udhar', amount: amt, date, source: 'manual', billId: null, items: [], pt: 'udhar', note: 'Manual entry' })
    }
    const near = (lo, hi) => mine.filter((b) => !usedBill.has(b.billId) && +b.createdAt >= lo && +b.createdAt <= hi && b.orderStatus === 'Delivered')
    // earlier, fully settled cycles
    const finalStart = now - (pending ? [12, 8, 6, 3, 2, 5, 9, 14, 4, 1, 7, 10, 3, 6, 2, 11, 5, 8][ci] : int(8, 60)) * DAY
    let cursor = now - int(150, 290) * DAY
    for (let k = 0, n = int(1, pending ? 3 : 4); k < n && cursor < finalStart - 25 * DAY; k++) {
      let bal = 0, last = cursor
      for (let j = 0, m = int(1, 3); j < m; j++) { const d = cursor + j * int(1, 5) * DAY, amt = int(2, 16) * 50, bs = near(d - 12 * 36e5, d + 3 * DAY); const before = ev.length; add(d, amt, bs[0]); bal += ev[before].amount; last = Math.max(last, +ev[before].date) }
      let pd = last + int(2, 18) * DAY
      const parts = rnd() < 0.5 ? 2 : 1
      for (let j = 0; j < parts; j++) { const amt = j === parts - 1 ? bal : Math.round((bal * 0.5) / 10) * 10 || bal; ev.push({ type: 'payment', amount: amt, date: pd, source: 'manual', pt: PT(), note: j === parts - 1 ? 'Cleared' : 'Part payment' }); bal -= amt; pd += int(1, 6) * DAY }
      if (rnd() < 0.12) ev.push({ type: 'credit', amount: int(1, 4) * 10, date: pd, source: 'manual', pt: 'cash', note: 'Extra paid — kept as credit' })
      cursor = pd + int(5, 25) * DAY
    }
    // latest cycle
    let bal = 0
    for (let j = 0, m = int(1, 3); j < m; j++) {
      const d = finalStart + j * int(0, 3) * DAY
      if (+d > now - 36e5) break
      const bs = j === 0 ? near(finalStart - 2 * DAY, finalStart + 2 * DAY) : near(d - 12 * 36e5, d + 2 * DAY)
      const amt = int(2, 18) * 50, before = ev.length; add(d, amt, bs[0]); bal += ev[before].amount
    }
    if (bal > 0) {
      const lastAdd = Math.max(...ev.filter((e) => e.type === 'udhar').map((e) => +e.date))
      if (pending && bal >= 60 && ci % 4 === 1) { ev.push({ type: 'adjustment', amount: -20, date: Math.min(now - 36e5, lastAdd + 36e5), source: 'manual', pt: 'adjust', note: 'Discount on settlement' }); bal -= 20 }
      if (pending) { if (rnd() < 0.4) { const amt = Math.round((bal * 0.3) / 10) * 10 || 10; ev.push({ type: 'payment', amount: amt, date: Math.min(now - 36e5, lastAdd + int(0, 2) * DAY + 36e5), source: 'manual', pt: PT(), note: 'Part payment' }) } }
      else { const pd = Math.min(now - 36e5, lastAdd + int(1, 6) * DAY); ev.push({ type: 'payment', amount: bal, date: pd, source: 'manual', pt: PT(), note: 'Cleared' }); if (ci % 6 === 0) ev.push({ type: 'credit', amount: 50, date: pd, source: 'manual', pt: 'cash', note: 'Extra paid — kept as credit' }) }
    }
    // replay in date order → running balance, pendingSince, clearedAt
    ev.sort((x, y) => +x.date - +y.date)
    let run = 0, pendingSince = null, clearedAt = null, lastAddedAt = null
    ev.forEach((e) => {
      const d = new Date(e.date), prev = run
      const dl = e.type === 'adjustment' ? e.amount : e.type === 'udhar' ? e.amount : -e.amount
      run = Math.round((run + dl) * 100) / 100
      if (e.type === 'udhar') lastAddedAt = d
      if (prev <= 0 && run > 0) pendingSince = d
      if (prev > 0 && run <= 0) { clearedAt = d; pendingSince = null }
      if (e.bill) { e.bill.unpaidAmount = Math.min(e.amount, e.bill.totalAmount); e.bill.paidAmount = Math.round((e.bill.totalAmount - e.bill.unpaidAmount) * 100) / 100; e.bill.paymentStatus = e.bill.paidAmount ? 'partial' : 'unpaid'; e.bill.paymentMethod = 'udhar' }
      history.push({ _id: oid(), shopId, customerId: c._id, type: e.type, amount: Math.abs(e.amount), delta: dl, source: e.source, billId: e.billId || null, items: e.items || [], paymentType: e.pt, note: e.note || '', balanceAfter: run, date: d, createdAt: d, updatedAt: d })
    })
    udhars.push({ _id: oid(), shopId, customerId: c._id, customerName: name, phone: c.phone, totalAmount: run, pinned: false, lastAddedAt, pendingSince: run > 0 ? pendingSince : null, clearedAt: run <= 0 ? clearedAt : null, lastUpdated: new Date(ev[ev.length - 1].date), createdAt: new Date(ev[0].date), updatedAt: new Date(ev[ev.length - 1].date) })
  })
  udhars.filter((u) => u.totalAmount > 0).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 4).forEach((u) => (u.pinned = true))

  // a few low-stock items so the alerts are populated
  ;[['Sugar (1kg)', 4], ['Sunfeast Biscuits', 8], ['Maggi Noodles (70g)', 10], ['Surf Excel (1kg)', 7]].forEach(([n, st]) => { const p = products.find((x) => x.name === n); if (p) p.stock = st })
  // two items the shopkeeper typed at the counter that aren't in inventory yet
  ;[['Chocolate Bar', 20, 7, 2], ['Mosquito Coil', 15, 3, 26]].forEach(([name, price, n, hrs]) => products.push({
    _id: oid(), shopId, name, category: 'Other', price, costPrice: 0, stock: 0, icon: '🛒', imageUrl: '', lowStockAt: 10, active: true, listed: false, billedCount: n, lastBilledAt: new Date(now - hrs * 36e5),
    sold: n, priceUnit: 'unit', costPriceUnit: 'unit', videoUrl: '', description: '', expiryDate: null, createdAt: new Date(now - 5 * DAY), updatedAt: new Date(now) }))
  bills.forEach((b) => { b.status = b.unpaidAmount > 0 ? 'udhar' : 'paid'; b.balanceAfter = null })
  // a couple of cancelled orders + one bill with a pending balance that isn't on the udhar ledger (so every Orders badge shows up)
  const free = bills.filter((b) => b.orderStatus === 'Delivered' && b.customerName && !b.unpaidAmount && !usedBill.has(b.billId) && +b.createdAt > now - 20 * DAY && +b.createdAt < now - 2 * DAY)
  free.slice(0, 2).forEach((b) => { b.orderStatus = 'Cancelled'; b.cancelledAt = new Date(+b.createdAt + 36e5); sales.forEach((x) => { if (x.billId === b.billId) x.cancelled = true }) })
  if (free[2]) { const b = free[2]; b.unpaidAmount = Math.min(70, b.totalAmount); b.paidAmount = Math.round((b.totalAmount - b.unpaidAmount) * 100) / 100; b.paymentStatus = b.paidAmount ? 'partial' : 'unpaid' }
  return { products, bills, sales, credits: [], customers, udhars, history }
}
