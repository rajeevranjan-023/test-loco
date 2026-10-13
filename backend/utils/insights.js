import { displayBillId } from './billId.js'
const DAY = 864e5
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0)
const pct = (c, p) => (p ? Math.round(((c - p) / p) * 100) : c ? 100 : 0)
const r1 = (n) => Math.round(n * 10) / 10
const mid = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d }
const hourLabel = (h) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`)
const dLabel = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const rev = (s) => s.priceAtSale * s.quantity
const prof = (s) => (s.priceAtSale - s.costAtSale) * s.quantity
const share = (rows) => { const t = sum(rows, (x) => Math.abs(x.value)) || 1; return rows.map((x) => ({ ...x, pct: Math.round((Math.abs(x.value) / t) * 100) })) }

export function buildInsights({ shop, bills, sales, products, credits, udharTotal, people, messages, days, now = Date.now() }) {
  const firstDay = mid(now - (days - 1) * DAY), start = firstDay, prevStart = start - days * DAY
  const inCur = (x) => +x.createdAt >= start
  const inPrev = (x) => +x.createdAt >= prevStart && +x.createdAt < start
  const cB = bills.filter(inCur), pB = bills.filter(inPrev), cS = sales.filter(inCur), pS = sales.filter(inPrev)
  const P = Object.fromEntries(products.map((p) => [String(p._id), p]))
  const catOf = (s) => P[String(s.productId)]?.category || 'Other'
  const billTotal = (a) => sum(a, (b) => b.totalAmount)
  const units = (a) => sum(a, (s) => s.quantity)
  const dayIdx = (t) => Math.floor((+t - firstDay) / DAY)

  // ---------- daily series ----------
  const series = Array.from({ length: days }, (_, i) => ({ label: dLabel(firstDay + i * DAY), sales: 0, orders: 0, profit: 0, revenue: 0 }))
  cB.forEach((b) => { const i = dayIdx(b.createdAt); if (series[i]) { series[i].sales += b.totalAmount; series[i].orders++ } })
  cS.forEach((s) => { const i = dayIdx(s.createdAt); if (series[i]) { series[i].profit += prof(s); series[i].revenue += rev(s) } })
  series.forEach((d) => { d.profit = Math.round(d.profit); d.revenue = Math.round(d.revenue) })

  // ---------- weekly / monthly / hourly ----------
  const weekly = Array.from({ length: 12 }, (_, i) => ({ label: dLabel(now - (11 - i) * 7 * DAY), sales: 0, profit: 0 }))
  const wIdx = (t) => 11 - Math.floor((now - +t) / (7 * DAY))
  bills.forEach((b) => { const w = weekly[wIdx(b.createdAt)]; if (w) w.sales += b.totalAmount })
  sales.forEach((s) => { const w = weekly[wIdx(s.createdAt)]; if (w) w.profit += prof(s) })
  const nowD = new Date(now), mKey = (t) => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth() }
  const monthly = Array.from({ length: 10 }, (_, i) => { const k = nowD.getFullYear() * 12 + nowD.getMonth() - (9 - i); return { k, label: MONTHS[((k % 12) + 12) % 12], sales: 0, profit: 0 } })
  const mBy = Object.fromEntries(monthly.map((m) => [m.k, m]))
  bills.forEach((b) => { const m = mBy[mKey(b.createdAt)]; if (m) m.sales += b.totalAmount })
  sales.forEach((s) => { const m = mBy[mKey(s.createdAt)]; if (m) m.profit += prof(s) })
  const hourly = (list) => { const a = Array.from({ length: 16 }, (_, i) => ({ label: hourLabel(i + 6), sales: 0 })); list.forEach((b) => { const h = new Date(b.createdAt).getHours() - 6; if (a[h]) a[h].sales += b.totalAmount }); return a }
  const today0 = mid(now)
  const round = (a) => a.map(({ k, ...x }) => ({ ...x, sales: Math.round(x.sales), profit: x.profit === undefined ? undefined : Math.round(x.profit) }))
  const timeSeries = { hourly: round(hourly(cB)), daily: series, weekly: round(weekly), monthly: round(monthly) }
  const hourlyToday = round(hourly(bills.filter((b) => +b.createdAt >= today0)))

  // ---------- heatmap (Mon..Sun × 6 three-hour blocks) ----------
  const heat = Array.from({ length: 7 }, () => Array(6).fill(0))
  cB.forEach((b) => { const d = new Date(b.createdAt), h = d.getHours(); if (h >= 6) heat[(d.getDay() + 6) % 7][Math.min(5, Math.floor((h - 6) / 3))] += b.totalAmount })
  const heatmap = { cols: ['6-9', '9-12', '12-3', '3-6', '6-9', '9-12'], rows: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({ day: d, v: heat[i].map(Math.round) })) }
  const blockTotals = Array(6).fill(0); heat.forEach((r) => r.forEach((v, i) => (blockTotals[i] += v)))
  const peakBlock = ['6 AM - 9 AM', '9 AM - 12 PM', '12 PM - 3 PM', '3 PM - 6 PM', '6 PM - 9 PM', '9 PM - 12 AM'][blockTotals.indexOf(Math.max(...blockTotals))]

  // ---------- categories ----------
  const cat = {}
  cS.forEach((s) => { const c = (cat[catOf(s)] ||= { name: catOf(s), sales: 0, profit: 0 }); c.sales += rev(s); c.profit += prof(s) })
  const catTotal = sum(Object.values(cat), (c) => c.sales) || 1
  const categories = Object.values(cat).sort((a, b) => b.sales - a.sales).map((c) => ({ ...c, value: Math.round(c.sales), sales: Math.round(c.sales), profit: Math.round(c.profit), pct: Math.round((c.sales / catTotal) * 100), margin: c.sales ? Math.round((c.profit / c.sales) * 100) : 0 }))

  // ---------- donuts ----------
  const bySrc = { online: 0, offline: 0 }; cB.forEach((b) => (bySrc[b.channel] = (bySrc[b.channel] || 0) + 1))
  const orderSource = share([{ name: 'Online', value: bySrc.online }, { name: 'Offline', value: bySrc.offline }])
  const pm = { UPI: 0, Cash: 0, Card: 0, Udhar: 0 }; cB.forEach((b) => (pm[b.unpaidAmount > 0 || b.paymentMethod === 'udhar' ? 'Udhar' : { upi: 'UPI', cash: 'Cash', card: 'Card' }[b.paymentMethod] || 'Cash'] += b.totalAmount))
  const paymentMethods = share(Object.entries(pm).map(([name, value]) => ({ name, value: Math.round(value) })))
  const productSales = sum(cS, rev), delivery = sum(cB, (b) => b.deliveryCharge || 0), discount = sum(cB, (b) => b.discount || 0), other = sum(cB, (b) => b.otherIncome || 0)
  const revenueBreakdown = { total: Math.round(billTotal(cB)), items: share([{ name: 'Product Sales', value: Math.round(productSales) }, { name: 'Delivery Charges', value: Math.round(delivery) }, { name: 'Discount Given', value: Math.round(discount) }, { name: 'Other Income', value: Math.round(other) }]) }
  const productProfit = sum(cS, prof), netProfit = productProfit + delivery + other - discount
  const profitBreakdown = { total: Math.round(netProfit), items: share([{ name: 'Product Profit', value: Math.round(productProfit) }, { name: 'Delivery Charges', value: Math.round(delivery) }, { name: 'Other Income', value: Math.round(other) }, { name: 'Discount Given', value: Math.round(discount) }]) }

  // ---------- customers ----------
  const byName = {}; cB.forEach((b) => { if (!b.customerName) return; const c = (byName[b.customerName] ||= { name: b.customerName, orders: 0, spent: 0, last: 0 }); c.orders++; c.spent += b.totalAmount; c.last = Math.max(c.last, +b.createdAt) })
  const agoD = (t) => { const d = Math.floor((now - t) / DAY); return d <= 0 ? 'Today' : d === 1 ? '1 day ago' : `${d} days ago` }
  const topCustomers = Object.values(byName).sort((a, b) => b.spent - a.spent).slice(0, 5).map((c) => ({ ...c, spent: Math.round(c.spent), lastOrder: agoD(c.last) }))
  const first = Object.fromEntries(people.map((p) => [p._id, +p.first]))
  const newC = people.filter((p) => +p.first >= start).length, prevNewC = people.filter((p) => +p.first >= prevStart && +p.first < start).length
  const inactive = people.filter((p) => +p.first < start && +p.last < now - 30 * DAY).length
  const customerType = { total: people.length, items: share([{ name: 'New Customers', value: newC }, { name: 'Returning Customers', value: Math.max(people.length - newC - inactive, 0) }, { name: 'Inactive Customers', value: inactive }]) }
  const buyers = Object.keys(byName).length || 1
  const repeatOf = (a) => { const m = {}; a.forEach((b) => b.customerName && (m[b.customerName] = (m[b.customerName] || 0) + 1)); return Object.values(m).filter((n) => n > 1).length }

  // behaviour: new vs returning orders (an order is "returning" if the customer's first bill is earlier)
  const isRet = (b) => b.customerName && first[b.customerName] !== undefined && first[b.customerName] < +b.createdAt
  const wk = (t) => 3 - Math.floor((now - +t) / (7 * DAY))
  const wkB = bills.filter((b) => b.customerName && wk(b.createdAt) >= 0)
  const mkW = () => Array.from({ length: 4 }, (_, i) => ({ label: `Week ${i + 1}`, new: 0, returning: 0 }))
  const frequency = mkW(), newVsRet = mkW(), seen = Array.from({ length: 4 }, () => new Set())
  wkB.forEach((b) => { const w = wk(b.createdAt), k = isRet(b) ? 'returning' : 'new'; frequency[w][k]++; if (!seen[w].has(b.customerName)) { seen[w].add(b.customerName); newVsRet[w][k]++ } })
  const bucketsV = [['< ₹100', 0, 100], ['₹100-250', 100, 250], ['₹250-500', 250, 500], ['₹500+', 500, 1e9]]
  const orderValue = bucketsV.map(([label, lo, hi]) => ({ label, new: cB.filter((b) => b.customerName && !isRet(b) && b.totalAmount >= lo && b.totalAmount < hi).length, returning: cB.filter((b) => isRet(b) && b.totalAmount >= lo && b.totalAmount < hi).length }))
  const retBill = new Set(cB.filter(isRet).map((b) => b.billId)), namedBill = new Set(cB.filter((b) => b.customerName).map((b) => b.billId))
  const cp = {}; cS.forEach((s) => { if (!namedBill.has(s.billId)) return; const c = (cp[catOf(s)] ||= { label: catOf(s), new: 0, returning: 0 }); c[retBill.has(s.billId) ? 'returning' : 'new'] += s.quantity })
  const behavior = { frequency, orderValue, categoryPreference: Object.values(cp), newVsReturning: newVsRet }
  const retB = cB.filter(isRet), newB = cB.filter((b) => b.customerName && !isRet(b))
  const aovR = retB.length ? billTotal(retB) / retB.length : 0, aovN = newB.length ? billTotal(newB) / newB.length : 0
  const retPct = customerType.items[1]?.pct ?? 0
  const customerInsights = [
    `${retPct}% customers are returning`,
    `Average order value of returning customers is ${aovN ? Math.abs(pct(aovR, aovN)) : 0}% ${aovR >= aovN ? 'higher' : 'lower'}`,
    `Most common purchase time: ${peakBlock.replace(' AM', ' AM').replace(' - ', ' - ')}`,
    topCustomers[0] ? `Top returning customer: ${topCustomers[0].name} (${topCustomers[0].orders} orders)` : 'No repeat customers yet',
  ]

  // ---------- products ----------
  const pStat = {}; products.forEach((p) => (pStat[String(p._id)] = { units: 0, revenue: 0, profit: 0, prev: 0, ch: new Set(), spark: Array(7).fill(0), daily: Array(days).fill(0) }))
  cS.forEach((s) => { const a = pStat[String(s.productId)]; if (!a) return; a.units += s.quantity; a.revenue += rev(s); a.profit += prof(s); const i = dayIdx(s.createdAt); if (a.daily[i] !== undefined) a.daily[i] += s.quantity; const k = Math.floor((now - +s.createdAt) / DAY); if (k < 7) a.spark[6 - k] += s.quantity })
  pS.forEach((s) => { const a = pStat[String(s.productId)]; if (a) a.prev += s.quantity })
  sales.forEach((s) => { const a = pStat[String(s.productId)]; if (a) a.ch.add(s.channel) })
  const rows = products.map((p) => {
    const a = pStat[String(p._id)], avg = a.units / days, low = p.stock <= (p.lowStockAt ?? 10)
    const exp = p.expiryDate ? Math.ceil((+p.expiryDate - now) / DAY) : null
    return { id: String(p._id), name: p.name, category: p.category || 'Other', imageUrl: p.imageUrl, icon: p.icon, active: p.active !== false, stock: p.stock, units: a.units, revenue: Math.round(a.revenue), profit: Math.round(a.profit),
      margin: a.revenue ? Math.round((a.profit / a.revenue) * 100) : 0, growth: pct(a.units, a.prev), prevUnits: a.prev, trend: a.spark, avgDaily: r1(avg), daysLeft: avg > 0 ? Math.round(p.stock / avg) : null,
      channels: a.ch.size > 1 ? 'Both' : a.ch.has('online') ? 'Online' : 'Offline', status: p.stock === 0 ? 'Out of Stock' : low ? 'Low Stock' : 'Normal', expiryIn: exp, _daily: a.daily, _low: low }
  })
  const clean = ({ _daily, _low, ...x }) => x
  const top = (f, n = 5) => rows.slice().sort(f).slice(0, n).map(clean)
  const topProducts = {
    mostSold: top((a, b) => b.units - a.units), mostProfitable: top((a, b) => b.profit - a.profit), leastSold: top((a, b) => a.units - b.units),
    fastestGrowing: rows.filter((p) => p.prevUnits > 0).sort((a, b) => b.growth - a.growth).slice(0, 5).map(clean),
  }
  const best = (p, v) => (p ? { name: p.name, imageUrl: p.imageUrl, icon: p.icon, value: v } : null)
  const ms = topProducts.mostSold[0], mp = topProducts.mostProfitable[0], ls = topProducts.leastSold[0]
  const bestMetrics = { mostSold: best(ms, `${ms?.units ?? 0} units`), mostProfitable: best(mp, `₹ ${(mp?.profit ?? 0).toLocaleString('en-IN')} profit`), leastSold: best(ls, `${ls?.units ?? 0} units`) }

  const top6 = rows.slice().sort((a, b) => b.units - a.units).slice(0, 8)
  const stockVsSales = top6.slice(0, 6).map((p) => ({ name: p.name.replace(/\s*\(.*\)/, ''), units: p.units, stock: p.stock }))
  const stockTimeline = {}, productInsights = {}
  top6.forEach((p) => {
    let after = 0; const tl = Array(days)
    for (let i = days - 1; i >= 0; i--) { tl[i] = { label: series[i].label, units: p._daily[i], stock: p.stock + after }; after += p._daily[i] }
    stockTimeline[p.name] = tl
    const mate = rows.filter((x) => x.category === p.category).sort((a, b) => b.units - a.units)[0]
    productInsights[p.name] = { growth: p.growth, stock: p.stock, avgDaily: p.avgDaily, category: p.category, best: mate?.name === p.name, recommend: Math.max(10, Math.ceil((p.avgDaily * 7) / 5) * 5), low: p._low }
  })

  // ---------- inventory ----------
  const inv = (list) => list.slice(0, 8).map(clean)
  const inventory = {
    stock: inv(rows.slice().sort((a, b) => a.stock - b.stock)), fast: inv(rows.slice().sort((a, b) => b.avgDaily - a.avgDaily)),
    slow: inv(rows.slice().sort((a, b) => a.avgDaily - b.avgDaily)), expiry: inv(rows.filter((p) => p.expiryIn !== null && p.expiryIn <= 30).sort((a, b) => a.expiryIn - b.expiryIn)),
  }
  const cls = (p) => (p.stock === 0 ? 'Out of Stock' : p.expiryIn !== null && p.expiryIn <= 7 ? 'Near Expiry' : p._low ? 'Low Stock' : 'In Stock')
  const stockStatus = { total: rows.length, items: share(['In Stock', 'Low Stock', 'Out of Stock', 'Near Expiry'].map((n) => ({ name: n, value: rows.filter((p) => cls(p) === n).length }))) }
  const lowCount = rows.filter((p) => p._low).length

  // ---------- KPIs ----------
  const aov = cB.length ? billTotal(cB) / cB.length : 0, aovP = pB.length ? billTotal(pB) / pB.length : 0
  const kpis = {
    sales: { value: Math.round(billTotal(cB)), growth: pct(billTotal(cB), billTotal(pB)) }, orders: { value: cB.length, growth: pct(cB.length, pB.length) },
    customers: { value: newC, growth: pct(newC, prevNewC) },
    udhar: { value: Math.round(udharTotal ?? sum(credits, (c) => c.amount)), growth: pct(sum(credits.filter(inCur), (c) => c.amount), sum(credits.filter(inPrev), (c) => c.amount)) },
    profit: { value: Math.round(sum(cS, prof)), growth: pct(sum(cS, prof), sum(pS, prof)) }, unitsSold: { value: units(cS), growth: pct(units(cS), units(pS)) },
    aov: { value: Math.round(aov), growth: pct(aov, aovP) }, repeat: { value: Math.round((repeatOf(cB) / buyers) * 100), growth: pct(repeatOf(cB), repeatOf(pB)) },
    rating: { value: shop.rating, reviews: shop.reviewCount }, lowStock: { value: lowCount },
  }

  // ---------- recent ----------
  const recentOrders = bills.slice().sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 5).map((b) => ({ id: displayBillId(b.billId, '#ORD'), customer: b.customerName || 'Walk-in', amount: b.totalAmount, status: b.orderStatus, payment: b.paymentStatus === 'paid' ? 'Paid' : b.creditId ? 'Udhar' : 'Pending', createdAt: b.createdAt }))
  const recentMessages = messages.map((m) => ({ customer: m.customerName, text: m.text, createdAt: m.createdAt }))

  // ---------- forecast ----------
  const capped = Math.max(-20, Math.min(30, kpis.sales.growth)), avgDay = billTotal(cB) / days
  const fast = rows.filter((p) => p.avgDaily > 0).sort((a, b) => (a.stock / a.avgDaily) - (b.stock / b.avgDaily)).slice(0, 2)
  const lost = sum(rows.filter((p) => p._low && p.avgDaily > 0), (p) => p.avgDaily * 7 * (p.units ? p.profit / p.units : 0))
  const slowN = rows.filter((p) => p.avgDaily < 1).length
  const forecast = {
    expectedSales: Math.round(avgDay * 30 * (1 + capped / 100)), growth: capped, restock: fast.map((p) => p.name.replace(/\s*\(.*\)/, '')),
    profitBoost: Math.round(lost), slowMoving: slowN,
  }

  return { range: { days, from: start, to: now }, kpis, series, timeSeries, hourlyToday, heatmap, categories, orderSource, paymentMethods, revenueBreakdown, profitBreakdown, topCustomers, customerType, behavior, customerInsights,
    topProducts, bestMetrics, productTable: rows.map(clean), stockVsSales, stockTimeline, productInsights, inventory, stockStatus, recentOrders, recentMessages, forecast }
}
