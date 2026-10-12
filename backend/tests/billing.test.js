// Universal Billing Engine — pure logic, no database.  node tests/billing.test.js
import assert from 'node:assert/strict'
import { deriveTransactionType as tt, computeBill, costBreakdown, resolveContext, cleanChargeLine } from '../utils/common/billing.js'
const subtotalOf = (l) => computeBill(l).subtotal
const applyDiscount = (sub, d) => { const c = computeBill([{ type: 'product', rate: sub, qty: 1 }], { discount: d }); return { discount: c.discount, total: c.total } }
const revenueBreakdown = (l, d = 0) => computeBill(l, { discount: d }).revenue
import { billingCapabilities, sanitizeCapabilities, enabledTypes } from '../utils/common/billingConfig.js'
const L = (type, rate, qty = 1, extra = {}) => ({ type, rate, qty, ...extra })

// transaction type is DERIVED from the line items
assert.equal(tt([L('product', 300), L('product', 300)]), 'sale')
assert.equal(tt([L('service', 500)]), 'service')
assert.equal(tt([L('labour', 1500)]), 'labour')
assert.equal(tt([L('service', 500), L('material', 200), L('labour', 300)]), 'mixed')
assert.equal(tt([L('product', 2000), L('service', 500)]), 'mixed')
assert.equal(tt([L('product', 1000), L('material', 500), L('service', 1000), L('labour', 800), L('other', 100)]), 'mixed')
assert.equal(tt([L('product', 100), L('other', 20)]), 'sale', 'an other-charge never turns a sale into mixed')
assert.equal(tt([L('service', 100), L('other', 20)]), 'service')
assert.equal(tt([L('product', 100), L('material', 20)]), 'sale')
console.log('✅ transaction type derived from line items')

// the brief's totals
assert.equal(subtotalOf([L('product', 60, 5), L('product', 150, 2)]), 600)                                   // grocery
assert.equal(subtotalOf([L('service', 500), L('material', 200), L('labour', 300)]), 1000)                    // AC service
assert.equal(subtotalOf([L('product', 1000), L('material', 500), L('service', 1000), L('labour', 800), L('other', 100)]), 3400) // mechanic
console.log('✅ brief totals: ₹600 · ₹1,000 · ₹3,400')

// product-only totals keep the legacy rule: sum raw, round once
assert.equal(subtotalOf([L('product', 99, 0.125)]), 12.38)
assert.equal(subtotalOf([L('product', 33.33, 0.333), L('product', 10.01, 0.777)]), Math.round((33.33 * 0.333 + 10.01 * 0.777) * 100) / 100)
console.log('✅ legacy rounding preserved')

// revenue split: service stays separate from other; buckets always sum to the total
let lines = [L('service', 500), L('material', 200), L('labour', 300)]
let rb = revenueBreakdown(lines, 0)
assert.deepEqual(rb, { product: 0, material: 200, service: 500, labour: 300, other: 0 })
lines = [L('product', 1000), L('material', 500), L('service', 1000), L('labour', 800), L('other', 100)]
rb = revenueBreakdown(lines, 0); assert.equal(rb.service, 1000); assert.equal(rb.other, 100); assert.equal(rb.labour, 800)
for (const d of [0, 1, 33.33, 100, 3400]) {
  const { total } = applyDiscount(subtotalOf(lines), d); const r = revenueBreakdown(lines, d)
  assert.equal(Math.round(Object.values(r).reduce((a, b) => a + b, 0) * 100) / 100, total, `buckets sum to total with discount ${d}`)
}
assert.equal(applyDiscount(100, 500).total, 0, 'discount can never exceed the subtotal')
assert.equal(applyDiscount(100, -5).discount, 0)
console.log('✅ revenue buckets (product/material/service/labour/other) sum to the bill total, with and without discount')

// cost snapshot
assert.deepEqual(costBreakdown([L('product', 100, 2, { cost: 40 }), L('material', 50, 1, { cost: 30 }), L('service', 500)]), { product: 80, material: 30 })
console.log('✅ cost split: product vs material')

// optional context is config-driven
const fields = [{ key: 'vehicle', label: 'Vehicle', required: true }, { key: 'note', label: 'Job ref', required: false }]
assert.match(resolveContext(fields, {}).error, /Vehicle is required/)
assert.deepEqual(resolveContext(fields, { vehicle: 'UP32 AB 1234' }).values, [{ key: 'vehicle', label: 'Vehicle', value: 'UP32 AB 1234' }])
assert.deepEqual(resolveContext([], { vehicle: 'x' }).values, [], 'a business with no context fields ignores context')
console.log('✅ context fields: required only when configured')

// pricing models
assert.equal(cleanChargeLine({ name: 'Visit', rate: 500 }, 'service').line.qty, 1)
let c = cleanChargeLine({ name: 'Wiring', pricing: 'hourly', qty: 2.5, rate: 300 }, 'labour').line
assert.equal(c.unit, 'hr'); assert.equal(c.qty * c.rate, 750)
c = cleanChargeLine({ name: 'Tiles', pricing: 'per_unit', qty: 12, unit: 'sqft', rate: 40 }, 'labour').line; assert.equal(c.unit, 'sqft')
assert.ok(cleanChargeLine({ name: '', rate: 5 }, 'service').error)
assert.ok(cleanChargeLine({ name: 'x', rate: 0 }, 'service').error)
assert.ok(cleanChargeLine({ name: 'x', pricing: 'hourly', qty: 0, rate: 5 }, 'labour').error)
assert.equal(cleanChargeLine({ name: 'Cleaning', pricing: 'hourly', qty: 3, rate: 100 }, 'other').line.qty, 1, 'other charge is always a flat amount')
console.log('✅ fixed / per-unit / hourly / custom pricing + validation')

// capabilities: defaults per account type, nothing keyed on trade or username
const shop = billingCapabilities({}, 'shop'); assert.deepEqual(enabledTypes(shop), ['product'])
const svc = billingCapabilities({}, 'service'); assert.deepEqual(enabledTypes(svc), ['service', 'labour'])
const hybrid = billingCapabilities({ billing: { capabilities: { products: true, services: true, materials: true, labour: true, otherCharges: true } } }, 'shop')
assert.deepEqual(enabledTypes(hybrid), ['product', 'service', 'material', 'labour', 'other'])
const off = billingCapabilities({ billing: { capabilities: { products: false } } }, 'shop'); assert.deepEqual(enabledTypes(off), ['product'], 'never left with nothing to bill')
assert.deepEqual(sanitizeCapabilities({ products: 'yes', evil: true, services: true }), { services: true }, 'unknown/non-boolean flags dropped')
assert.equal(sanitizeCapabilities({ context: [{ label: 'Vehicle' }, { label: 'Vehicle' }, { label: '' }] }).context.length, 1)
console.log('✅ capabilities: shop = Product · service = Service+Labour · hybrid = all five')
console.log('\nAll billing engine unit tests passed')
