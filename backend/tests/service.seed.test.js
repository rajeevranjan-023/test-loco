// Service Provider dev seed — invariants (no database needed): node tests/service.seed.test.js
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { generateService } from '../seed/serviceProviderData.js'
import { computeBill, r2 } from '../utils/billing.js'
import { guardSelfTest } from './_seedGuardCases.js'
import Bill from '../models/Bill.js'
import Product from '../models/Product.js'
import ServiceItem from '../models/ServiceItem.js'
import Sale from '../models/Sale.js'
import Customer from '../models/Customer.js'
import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import BillCounter from '../models/BillCounter.js'

const ok = (c, m) => { assert.ok(c, m); console.log('✅', m) }
const id = new mongoose.Types.ObjectId(), NOW = Date.UTC(2026, 9, 1, 8)
const d = generateService({ providerId: id, now: NOW })
const str = (x) => String(x)

// determinism: same seed + same now → same business content (ObjectIds differ by design)
const sig = (x) => JSON.stringify(x.bills.map((b) => [b.billId, b.customerName, b.totalAmount, b.paidAmount, b.items.map((i) => [i.name, i.qty, i.rate, i.charge])]))
ok(sig(d) === sig(generateService({ providerId: new mongoose.Types.ObjectId(), now: NOW })), 'deterministic: same seed → identical bills, totals, lines')
ok(sig(d) !== sig(generateService({ providerId: id, now: NOW, seed: 99 })), 'a different seed gives different data')

// schema validity through the REAL models
for (const [M, rows] of [[Bill, d.bills], [Product, d.products], [ServiceItem, d.services], [Sale, d.sales], [Customer, d.customers], [Udhar, d.udhars], [UdharHistory, d.history], [BillCounter, d.billCounters]]) {
  const errs = rows.map((r) => new M(r).validateSync()).filter(Boolean)
  assert.equal(errs.length, 0, `${M.modelName}: ${errs[0]?.message}`)
  ok(true, `schema-valid: ${M.modelName} ${rows.length}`)
}

// everything belongs to this one provider
const all = [...d.services, ...d.products, ...d.sales, ...d.customers, ...d.bills, ...d.billCounters, ...d.udhars, ...d.history]
ok(all.every((r) => str(r.shopId) === str(id)), 'every record is scoped to the provider account')

// hybrid coverage: every billing line type + every charge mode appears
const kinds = new Set(d.bills.flatMap((b) => b.items.map((i) => `${i.type}:${i.charge}`)))
for (const k of ['service:charged', 'labour:charged', 'product:charged', 'material:charged', 'material:included', 'material:internal', 'other:charged']) ok(kinds.has(k), `bills include ${k}`)
ok(!d.bills.some((b) => b.items.some((i) => ['membership', 'course', 'seat', 'fine'].includes(i.type))), 'no study-centre line types on a service provider')
ok(['paid', 'partial', 'unpaid'].every((s) => d.bills.some((b) => b.paymentStatus === s)), 'paid · partial · unpaid bills all exist')

// money: totals recomputed from the lines by the same engine; revenue buckets add up; paid + unpaid = total
for (const b of d.bills) {
  const calc = computeBill(b.items.map((i) => ({ type: i.type, qty: i.qty, rate: i.rate, charge: i.charge, discountType: i.discountType, discountValue: i.discountValue })), { discount: b.discountValue ? { type: b.discountType, value: b.discountValue } : 0 })
  assert.equal(b.totalAmount, calc.total, `bill ${b.billId} total`); assert.equal(r2(b.paidAmount + b.unpaidAmount), b.totalAmount, `bill ${b.billId} paid+unpaid`)
  assert.ok(Math.abs(Object.values(b.revenue).reduce((x, y) => x + (y || 0), 0) - (b.subtotal - b.discount)) < 0.02, `bill ${b.billId} revenue buckets`)
}
ok(true, `all ${d.bills.length} bills: total = engine(lines), paid + unpaid = total, revenue buckets sum to taxable`)
ok(new Set(d.bills.map((b) => b.billId)).size === d.bills.length && new Set(d.bills.map((b) => b.fullId)).size === d.bills.length, 'bill ids and full ids are unique')

// links
const cust = new Set(d.customers.map((c) => str(c._id))), prod = new Set(d.products.map((p) => str(p._id))), svc = new Set(d.services.map((s) => str(s._id)))
ok(d.bills.every((b) => cust.has(str(b.customerId))), 'every bill points at a real customer')
ok(d.bills.every((b) => b.items.every((i) => (i.type === 'product' || i.type === 'material' ? prod.has(str(i.refId)) : i.type === 'other' ? true : svc.has(str(i.refId))))), 'every line points at a real product / service')
const billIds = new Set(d.bills.map((b) => b.billId))
ok(d.sales.every((s) => billIds.has(s.billId) && prod.has(str(s.productId))), 'every Sale row links a real bill and product')

// stock: product.stock = Σ batch remaining; units sold/consumed match the bill lines; no negative stock
for (const p of d.products) {
  assert.equal(p.stock, Math.round(p.batches.reduce((x, b) => x + b.remainingQty, 0) * 1000) / 1000, `${p.name} stock = Σ batches`)
  const sold = d.bills.flatMap((b) => b.items).filter((i) => i.type === 'product' && str(i.refId) === str(p._id)).reduce((x, i) => x + i.qty, 0)
  const used = d.bills.flatMap((b) => b.items).filter((i) => i.type === 'material' && str(i.refId) === str(p._id)).reduce((x, i) => x + i.qty, 0)
  assert.equal(p.sold, sold, `${p.name} sold`); assert.equal(p.consumed, used, `${p.name} consumed`)
  assert.equal(r2(p.batches.reduce((x, b) => x + b.quantity, 0) - p.stock), r2(sold + used), `${p.name}: received − remaining = sold + consumed`)
}
ok(true, 'stock invariant: stock = Σ batch remaining, and received − remaining = sold + consumed, for every part')
ok(d.products.some((p) => !p.sellable) && d.products.some((p) => p.sellable), 'parts used only inside services are not sellable; counter parts are')

// ledger: every balance = Σ history; last balanceAfter = Udhar total; pending dues exist and so do cleared ones
for (const u of d.udhars) {
  const h = d.history.filter((x) => str(x.customerId) === str(u.customerId)).sort((a, b) => +a.date - +b.date)
  assert.equal(r2(h.reduce((x, e) => x + e.delta, 0)), u.totalAmount, `ledger sum ${u.customerName}`); assert.equal(h[h.length - 1].balanceAfter, u.totalAmount, `balanceAfter ${u.customerName}`)
}
ok(true, 'every ledger balance equals the sum of its history')
const owedByBills = (c) => d.bills.filter((b) => str(b.customerId) === str(c)).reduce((x, b) => x + b.unpaidAmount, 0)
ok(d.udhars.every((u) => u.totalAmount <= r2(owedByBills(u.customerId)) + 0.01), 'no customer owes more than their unpaid bills')
ok(d.udhars.some((u) => u.totalAmount > 0) && d.udhars.some((u) => u.totalAmount <= 0), 'pending dues and cleared accounts both exist')

// seed guard (production must be refused; opt-in auto-seed)
guardSelfTest(ok)
console.log(`\n${d.bills.length} bills · ${d.customers.length} customers · ${d.products.length} parts · ${d.udhars.filter((u) => u.totalAmount > 0).length} pending dues — all service seed tests passed`)
