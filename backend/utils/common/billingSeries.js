import { r2 } from './billing.js'

// Read-only roll-ups over bills that already carry their stored revenue split — no billing math is redone here.
// Days are IST calendar days (UTC+5:30).
const IST = 330 * 6e4
export const istDay = (d) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10)
const KINDS = ['product', 'material', 'service', 'labour']

export function dailySeries(bills) {
  const byDay = new Map()
  for (const b of bills) {
    const k = istDay(b.createdAt)
    const row = byDay.get(k) || { date: k, bills: 0, revenue: 0, product: 0, material: 0, service: 0, labour: 0, other: 0, collected: 0, outstanding: 0 }
    row.bills++; row.collected += b.paidAmount || 0; row.outstanding += b.unpaidAmount || 0
    if (b.revenue) for (const kind of Object.keys(b.revenue)) { const v = b.revenue[kind] || 0; row.revenue += v; row[KINDS.includes(kind) ? kind : 'other'] += v }
    else { row.revenue += b.totalAmount || 0; row.product += b.totalAmount || 0 } // legacy bill: all product revenue (same rule as billingSummary)
    byDay.set(k, row)
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v])))
}

// Line value as billed (before bill-level discount/tax). Internal lines billed at 0 are left out.
export function topItems(bills, limit = 8) {
  const by = new Map()
  for (const b of bills) for (const i of b.items || []) {
    const key = `${i.type}|${(i.name || '').trim().toLowerCase()}`
    const it = by.get(key) || { name: (i.name || 'Item').trim(), type: i.type, qty: 0, billed: 0, bills: 0 }
    it.qty += i.qty || 0; it.billed += i.total || 0; it.bills++; by.set(key, it)
  }
  return [...by.values()].filter((i) => i.billed > 0).sort((a, b) => b.billed - a.billed).slice(0, limit).map((i) => ({ ...i, qty: r2(i.qty), billed: r2(i.billed) }))
}
