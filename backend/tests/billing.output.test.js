// Pipeline + customer-facing outputs (80mm · A4 · WhatsApp · Telegram · SMS) — pure logic, no database.  node tests/billing.output.test.js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { computeBill, buildDocument, cleanDiscount, cleanChargeLine, cleanLineExtras, deriveTransactionType } from '../utils/common/billing.js'
import { thermalHtml, a4Html, whatsappText, telegramText, smsText, shareLinks } from '../../frontend/src/features/analytics/billOutput.js'
const L = (type, rate, qty = 1, x = {}) => ({ type, rate, qty, ...x })
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.006, `${m}: ${a} !== ${b}`)
const ok = (m) => console.log('✅', m)

// the frontend gets a byte-identical copy of the engine — one calculation source
assert.equal(fs.readFileSync(new URL('../utils/common/billing.js', import.meta.url), 'utf8'), fs.readFileSync(new URL('../../frontend/src/features/analytics/billCore.js', import.meta.url), 'utf8'))
ok('frontend billCore.js is byte-identical to the server engine (single calculation source)')

// ── discounts: the brief's examples
let c = computeBill([L('product', 5000)], { discount: { type: 'percent', value: 10 } }); assert.equal(c.discount, 500); assert.equal(c.total, 4500)
c = computeBill([L('product', 5000)], { discount: { type: 'fixed', value: 500 } }); assert.equal(c.discount, 500); assert.equal(c.total, 4500)
ok('Subtotal ₹5,000: 10% → ₹500 and fixed ₹500 → ₹500 (both total ₹4,500)')
assert.equal(computeBill([L('product', 100)], { discount: { type: 'percent', value: 250 } }).total, 0, '% capped at 100')
assert.equal(computeBill([L('product', 100)], { discount: { type: 'fixed', value: 999 } }).total, 0, 'fixed capped at subtotal')
assert.equal(cleanDiscount({ type: 'percent', value: -5 }).value, 0); assert.equal(cleanDiscount(50).type, 'fixed')
ok('discount edge cases: capped, negative ignored, bare number = fixed ₹')

// ── item-level discount + bill-level + tax, in the right ORDER (line disc → bill disc → tax)
c = computeBill([L('service', 1000, 1, { discountType: 'percent', discountValue: 10 }), L('product', 500, 2)], { discount: { type: 'fixed', value: 100 }, taxRate: 18 })
assert.equal(c.subtotal, 2000); assert.equal(c.lineDiscount, 100); assert.equal(c.billDiscount, 100); assert.equal(c.discount, 200); assert.equal(c.taxable, 1800)
assert.equal(c.taxAmount, 324); assert.equal(c.total, 2124)
assert.equal(c.lines[0].total, 900, 'service line net of its 10%'); assert.equal(c.lines[0].discount, 100)
near(Object.values(c.revenue).reduce((a, b) => a + b, 0), c.taxable, 'revenue buckets add to taxable (tax excluded)')
assert.equal(c.subtotal - c.discount, c.taxable)
ok('subtotal 2000 − line 100 − bill 100 = 1800; +18% tax 324 = ₹2,124; revenue (ex-tax) sums to ₹1,800')
assert.equal(computeBill([L('product', 100)], { taxRate: 0 }).taxAmount, 0)
assert.equal(computeBill([L('product', 99, 0.125)]).total, 12.38)
ok('tax 0 → no tax; legacy rounding unchanged')

// ── charge modes: chargeable / non-chargeable / included
c = computeBill([L('service', 500), L('material', 300, 1, { charge: 'charged' })]); assert.equal(c.total, 800)
c = computeBill([L('service', 500), L('material', 300, 1, { charge: 'internal' })]); assert.equal(c.total, 500); assert.equal(c.revenue.material, 0)
c = computeBill([L('service', 2000), L('material', 700, 1, { charge: 'included' }), L('labour', 400, 2, { charge: 'included' })]); assert.equal(c.total, 2000); assert.equal(c.revenue.service, 2000); assert.equal(c.revenue.labour, 0)
ok('chargeable adds ₹300 · non-chargeable adds ₹0 · included material+labour never double-charge (₹2,000 stays ₹2,000)')
assert.equal(cleanLineExtras({ charge: 'internal' }, 'service').charge, 'charged', 'a service can never be marked internal')
assert.equal(cleanLineExtras({ charge: 'included' }, 'material').charge, 'included')
assert.equal(cleanChargeLine({ name: 'Helper', charge: 'included' }, 'labour').line.rate, 0)
ok('only material/labour accept included/internal; included labour needs no rate')

// ── document: whitelist only
const bill = {
  displayId: '#261007A0101', createdAt: new Date('2026-10-07T20:26:00+05:30'), customerName: 'Raj', customerPhone: '9876543210', status: 'udhar', paymentMethod: 'cash', transactionType: 'mixed',
  context: [{ key: 'v', label: 'Vehicle', value: 'UP32 AB 1234' }],
  notes: 'INTERNAL-NOTE-DO-NOT-SHOW', supplier: 'SUPPLIER-SECRET', margin: 'MARGIN-SECRET',
  items: [
    { type: 'service', name: 'AC Service', qty: 1, unit: '', rate: 500, total: 500, discount: 0, cost: 0 },
    { type: 'product', name: 'Engine Oil', qty: 2, unit: 'L', rate: 500, total: 1000, discount: 0, cost: 4713, costBreakdown: [{ costPrice: 4713 }], description: 'Synthetic 5W-30' },
    { type: 'material', name: 'Oil Filter', qty: 1, unit: '', rate: 500, total: 500, discount: 0, cost: 8291, charge: 'charged' },
    { type: 'material', name: 'Cleaning Spray', qty: 1, unit: '', rate: 0, total: 0, cost: 6101, charge: 'internal' },
    { type: 'material', name: 'Gasket', qty: 1, unit: '', rate: 0, total: 0, cost: 5207, charge: 'included' },
    { type: 'labour', name: 'Repair Labour', qty: 2, unit: 'hr', rate: 300, total: 600, discount: 0 },
  ],
  subtotal: 2600, discount: 260, taxAmount: 0, totalAmount: 2340, paidAmount: 1500, unpaidAmount: 840,
}
const doc = buildDocument({ business: { name: 'Grocery Corner', phone: '9000000000', address: '1 Main Rd', logoUrl: '' }, bill, payments: [{ method: 'cash', amount: 1500 }], terms: 'Goods once sold are not returnable.' })
assert.deepEqual(doc.sections.map((s) => s.key), ['product', 'service', 'material', 'labour'])
assert.ok(!doc.sections.find((s) => s.key === 'material').items.some((i) => i.name === 'Cleaning Spray'), 'internal (non-chargeable) material is not on the customer bill')
assert.ok(doc.sections.find((s) => s.key === 'material').items.find((i) => i.name === 'Gasket').included, 'included material is shown as included')
assert.equal(doc.payment.status, 'Partial'); assert.equal(doc.totals.due, 840); assert.equal(doc.payment.method, 'Cash')
ok('document: categorized (products/services/materials/labour), internal material hidden, included flagged, status Partial, due ₹840')

const outputs = { thermal: thermalHtml(doc), a4: a4Html(doc), whatsapp: whatsappText(doc), telegram: telegramText(doc), sms: smsText(doc), links: JSON.stringify(shareLinks(doc)), docjson: JSON.stringify(doc) }
for (const [k, v] of Object.entries(outputs)) {
  for (const secret of ['INTERNAL-NOTE', 'SUPPLIER-SECRET', 'MARGIN-SECRET', 'Cleaning Spray', '4713', '8291', '6101', '5207', 'costBreakdown', 'costPrice', 'profit', 'Profit']) {
    assert.ok(!(k === 'links' ? decodeURIComponent(v) : v).includes(secret), `${k} leaks "${secret}"`)
  }
}
ok('customer-facing security: no cost price, supplier, margin, internal note or internal-use material in 80mm / A4 / WhatsApp / Telegram / SMS / share links / document')

// ── 80mm
const t = outputs.thermal
assert.match(t, /@page\{size:80mm auto;margin:0\}/); assert.match(t, /width:72mm/)
for (const s of ['GROCERY CORNER', 'Bill:', '#261007A0101', 'Customer:', 'Raj', 'Vehicle:', 'PRODUCTS', 'SERVICES', 'MATERIALS', 'LABOUR', '2 L × ₹500', '2 hr × ₹300', 'Subtotal', '₹2,600', 'Discount', '-₹260', 'TOTAL', '₹2,340', 'Paid', '₹1,500', 'Due', '₹840', 'Payment: Cash', 'Status: Partial', 'Thank you!', 'Synthetic 5W-30', 'included in service']) assert.ok(t.includes(s), `80mm missing "${s}"`)
assert.ok(!/<table/.test(t), '80mm uses compact rows, not a wide table'); assert.ok(!/@page\{size:A4/.test(t))
ok('80mm: 72mm column, @page 80mm auto, compact rows, all required fields, categorized, no table')

// ── A4
const a = outputs.a4
assert.match(a, /@page\{size:A4;margin:14mm\}/); assert.match(a, /<table/); assert.match(a, /INVOICE/)
for (const s of ['Grocery Corner', '1 Main Rd', '9000000000', '#261007A0101', 'BILLED TO', 'Raj', '9876543210', 'Vehicle', 'UP32 AB 1234', 'PRODUCTS', 'SERVICES', 'MATERIALS', 'LABOUR', 'Synthetic 5W-30', 'Disc.', 'Subtotal', 'Grand Total', '₹2,340', 'Amount Paid', 'Outstanding', '₹840', 'Partial', 'Goods once sold', 'Thank you for choosing Grocery Corner']) assert.ok(a.includes(s), `A4 missing "${s}"`)
assert.ok(!/width:72mm/.test(a) && !/80mm/.test(a)); assert.ok(a.length > t.length)
ok('A4: own layout (@page A4, header/INVOICE/billed-to/section tables/summary/footer terms) — not the 80mm receipt stretched')

// ── WhatsApp / Telegram
const w = outputs.whatsapp
for (const s of ['🧾 GROCERY CORNER', '━━━━━━━━━━━━━━━━━━', 'Bill: #261007A0101', 'Date: 07 Oct 2026', 'Customer: Raj', 'Vehicle: UP32 AB 1234', '📦 PRODUCTS', '• Engine Oil', '  2 L × ₹500 = ₹1,000', '🔧 SERVICES', '  1 × ₹500 = ₹500', '🧰 MATERIALS', '👷 LABOUR', '  2 hr × ₹300 = ₹600', 'Subtotal: ₹2,600', 'Discount: -₹260', 'Total: ₹2,340', 'Paid: ₹1,500', 'Due: ₹840', 'Payment: Cash', 'Status: Partial', 'Thank you for choosing Grocery Corner.']) assert.ok(w.includes(s), `WhatsApp missing "${s}"`)
assert.equal(outputs.telegram, w)
ok('WhatsApp + Telegram: structured categorized text with totals, paid, due, payment, status, thank-you')
const lk = shareLinks(doc)
assert.ok(lk.WhatsApp.startsWith('https://wa.me/919876543210?text=')); assert.ok(lk.SMS.startsWith('sms:9876543210?body=')); assert.ok(lk.Telegram.startsWith('https://t.me/share/url'))
assert.ok(shareLinks(doc, true).SMS.startsWith('sms:9876543210&body='))
ok('share links: wa.me with customer number, sms: (iOS "&"), Telegram')

// ── SMS
const sm = outputs.sms
for (const s of ['Grocery Corner - Bill #261007A0101', 'Customer: Raj', 'Products: ₹1,000', 'Services: ₹500', 'Materials: ₹500', 'Labour: ₹600', 'Subtotal: ₹2,600', 'Discount: ₹260', 'Total: ₹2,340', 'Paid: ₹1,500', 'Due: ₹840', 'Payment: Cash', 'Status: Partial']) assert.ok(sm.includes(s), `SMS missing "${s}"`)
assert.ok(sm.length < w.length / 1.6 && sm.length < 320, `SMS compact (${sm.length} chars vs ${w.length})`)
ok(`SMS: compact category totals (${sm.length} chars vs ${w.length} for WhatsApp), same totals/due/status`)

// ── dynamic, not hard-coded: a different bill produces different text; paid bill has no Due; tax & multi-payment appear
const doc2 = buildDocument({ business: { name: 'Raj Garage' }, bill: { displayId: '#X1', createdAt: new Date('2026-01-02'), customerName: '', items: [{ type: 'labour', name: 'Fitting', qty: 1, unit: '', rate: 1500, total: 1500 }], subtotal: 1500, discount: 0, taxName: 'GST', taxRate: 18, taxAmount: 270, totalAmount: 1770, paidAmount: 1770, unpaidAmount: 0, status: 'paid', paymentMethod: 'cash' }, payments: [{ method: 'cash', amount: 1000 }, { method: 'upi', amount: 770 }] })
const w2 = whatsappText(doc2), t2 = thermalHtml(doc2), s2 = smsText(doc2)
assert.ok(w2.includes('GST (18%): ₹270') && w2.includes('Total: ₹1,770') && !w2.includes('Due:') && w2.includes('Status: Paid') && w2.includes('Payment: Cash + UPI') && w2.includes('Customer: Walk-in') && !w2.includes('PRODUCTS') && w2.includes('LABOUR'))
assert.ok(t2.includes('GST (18%)') && t2.includes('Cash') && t2.includes('UPI') && !t2.includes('>Due<') && s2.includes('GST (18%): ₹270') && !s2.includes('Due'))
assert.equal(doc2.payment.payments.length, 2)
ok('dynamic: another bill → Paid / no Due / GST line / "Cash + UPI" / Walk-in / only the sections it has')
const doc3 = buildDocument({ business: { name: 'X' }, bill: { ...bill, status: 'udhar', paidAmount: 0, unpaidAmount: 2340 }, payments: [] }); assert.equal(doc3.payment.status, 'Udhar')
const doc4 = buildDocument({ business: { name: 'X' }, bill: { ...bill, status: 'paid', paidAmount: 0, unpaidAmount: 2340 }, payments: [] }); assert.equal(doc4.payment.status, 'Unpaid')
ok('status labels: Paid · Partial · Unpaid · Udhar')
assert.equal(deriveTransactionType([L('product', 1), L('service', 1)]), 'mixed')
console.log('\nAll billing pipeline + output tests passed')
