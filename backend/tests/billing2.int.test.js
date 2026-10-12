// Universal Billing phase 2 — discounts, tax, charge modes, split payments, customer-safe document, drafts, analytics.
//   MONGODB_URI=mongodb://127.0.0.1:27018/bill2 node tests/billing2.int.test.js
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'test-secret'
const { default: app } = await import('../server.js')
const { default: mongoose } = await import('mongoose')
const { connectDB } = await import('../config/db.js')
const { default: BillCounter } = await import('../models/common/BillCounter.js')
const { default: Bill } = await import('../models/common/Bill.js')
const { default: Sale } = await import('../models/common/Sale.js')
{ const { assertDisposableDb } = await import('./_safeDb.js'); assertDisposableDb(process.env.MONGODB_URI, 'billing2.int') } // never drop a non-local database
await connectDB(); await mongoose.connection.dropDatabase()
let n = 0; BillCounter.findOneAndUpdate = async () => ({ series: 'B', count: 201 + n++ })
const server = app.listen(0); const base = `http://localhost:${server.address().port}`
const req = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let data = null; try { data = await r.json() } catch {} ; return { status: r.status, data }
}
const ok = (c, m) => { assert.ok(c, m); console.log('✅', m) }
const near = (a, b) => Math.abs(a - b) < 0.006
const T = (await req('POST', '/api/auth/register', { name: 'Raj', email: 'g@example.com', password: 'password123' })).data.token
let r = await req('POST', '/api/seller/start', { username: '@garage236', sellerType: 'shop', shopName: 'Raj Garage', ownerName: 'Raj', phone: '9876543210', category: 'Other', address: 'MG Road' }, T); assert.equal(r.status, 201, JSON.stringify(r.data))
const mk = async (b) => (await req('POST', '/api/seller/products', b, T)).data
const stock = async (id) => (await req('GET', '/api/seller/products', null, T)).data.find((p) => p._id === id).stock
const sell = (b) => req('POST', '/api/seller/sales', { paymentMode: 'full', ...b }, T)
const doc = async (id) => (await req('GET', `/api/seller/billing/bills/${id}/document`, null, T)).data
const SECRET_COSTS = [4713, 8291, 6101]
const oil = await mk({ name: 'Engine Oil', price: 500, costPrice: 4713, stock: 50, priceUnit: 'liter' })
const gas = await mk({ name: 'AC Gas', price: 300, costPrice: 8291, stock: 10, sellable: false })
const clean = await mk({ name: 'Cleaning Material', price: 80, costPrice: 6101, stock: 20, sellable: false })

// ── TEST 1: existing Grocery bill is unchanged (defaults: no discount/tax UI, no extra fields on the bill)
r = await sell({ customerName: 'Raj', items: [{ productId: oil._id, quantity: 2 }], paymentMethod: 'cash' })
ok(r.status === 201 && r.data.bill.totalAmount === 1000 && r.data.transactionType === 'sale' && r.data.bill.taxAmount === undefined && r.data.bill.subtotal === 1000 && r.data.bill.discount === 0, 'TEST 1 grocery: ₹1,000 Sale, no tax, no discount')
const groceryId = r.data.billId
r = await sell({ items: [{ productId: oil._id, quantity: 1 }], discount: { type: 'percent', value: 10 } }); ok(r.status === 400 && /Discount/.test(r.data.message), 'discount refused while the capability is off')
r = await sell({ items: [{ productId: oil._id, quantity: 1, discountValue: 5 }] }); ok(r.status === 400, 'item discount refused while the capability is off')
r = await sell({ items: [{ productId: oil._id, quantity: 1, rate: 1 }] }); ok(r.status === 201 && r.data.bill.totalAmount === 500, 'product rate override ignored unless editRate is on (inventory price stays ₹500)')

// ── configure: hybrid + discount + tax 18% + editRate + terms + vehicle context
r = await req('PUT', '/api/seller/billing/config', { products: true, services: true, materials: true, labour: true, otherCharges: true, discount: true, tax: false, editRate: true, taxRate: 18, taxName: 'GST', terms: 'Warranty 30 days.', context: [{ label: 'Vehicle number' }, { label: 'KM' }] }, T)
ok(r.status === 200 && r.data.capabilities.taxRate === 18 && r.data.capabilities.terms === 'Warranty 30 days.' && r.data.business.name === 'Raj Garage' && r.data.business.address === 'MG Road', 'config saved; business profile (name, address) comes from the real shop record')

// ── TEST 7/8: percentage + fixed discount (tax still off)
r = await sell({ customerName: 'Raj', discount: { type: 'percent', value: 10 }, items: [{ type: 'service', name: 'Full Service', rate: 5000 }] })
ok(r.data.bill.totalAmount === 4500 && r.data.bill.discount === 500 && r.data.bill.discountType === 'percent' && r.data.bill.discountValue === 10 && r.data.bill.subtotal === 5000 && r.data.bill.revenue.service === 4500, 'TEST 7 percentage: ₹5,000 − 10% = ₹4,500; discount stored as entered')
r = await sell({ customerName: 'Raj', discount: { type: 'fixed', value: 500 }, items: [{ type: 'service', name: 'Full Service', rate: 5000 }] })
ok(r.data.bill.totalAmount === 4500 && r.data.bill.discountType === 'fixed', 'TEST 8 fixed: ₹5,000 − ₹500 = ₹4,500')
r = await sell({ customerName: 'Raj', items: [{ type: 'service', name: 'Alignment', rate: 1000, discountType: 'percent', discountValue: 20 }, { productId: oil._id, quantity: 2, discountValue: 100 }] })
ok(r.data.bill.totalAmount === 1700 && r.data.bill.items[0].discount === 200 && r.data.bill.items[1].discount === 100 && r.data.bill.discount === 300, 'item-level discount: service −20% (₹200) + oil −₹100 → ₹1,700')

// ── tax
await req('PUT', '/api/seller/billing/config', { tax: true }, T)
r = await sell({ customerName: 'Raj', discount: { type: 'fixed', value: 100 }, items: [{ type: 'service', name: 'AC Service', rate: 1000 }, { type: 'labour', name: 'Fitting', rate: 1100 }] })
ok(r.data.bill.subtotal === 2100 && r.data.bill.discount === 100 && r.data.bill.taxAmount === 360 && r.data.bill.taxRate === 18 && r.data.bill.totalAmount === 2360, 'tax 18% on (2,100 − 100) = ₹360 → total ₹2,360')
ok(near(r.data.bill.revenue.service + r.data.bill.revenue.labour, 2000) && r.data.bill.revenue.other === 0, 'revenue buckets exclude tax (₹2,000)')
const taxBill = r.data.billId
await req('PUT', '/api/seller/billing/config', { tax: false }, T)
r = await sell({ items: [{ type: 'service', name: 'No tax', rate: 100 }] }); ok(r.data.bill.totalAmount === 100 && r.data.bill.taxAmount === undefined, 'tax disabled → no tax applied')
await req('PUT', '/api/seller/billing/config', { tax: true }, T)

// ── TEST 4: Service + Material (chargeable) — AC Service 500 + Gas 300
let g0 = await stock(gas._id)
r = await sell({ customerName: 'Raj', items: [{ type: 'service', name: 'AC Service', rate: 500 }, { type: 'material', productId: gas._id, quantity: 1, rate: 300 }] })
ok(r.data.bill.totalAmount === 944 && r.data.bill.items[1].charge === 'charged' && r.data.bill.revenue.material === 300 && r.data.bill.revenue.service === 500 && await stock(gas._id) === g0 - 1, 'TEST 8 chargeable material: (500 + 300) + 18% = ₹944; gas stock −1')

// ── TEST 11: NON-chargeable material — stock drops, customer not charged
let c0 = await stock(clean._id)
r = await sell({ customerName: 'Raj', items: [{ type: 'service', name: 'AC Service', rate: 500 }, { type: 'material', productId: clean._id, quantity: 2, charge: 'internal' }] })
const nonCharge = r.data
ok(r.data.bill.totalAmount === 590 && r.data.bill.revenue.material === 0 && r.data.bill.items[1].total === 0, 'TEST 11 non-chargeable: customer pays 500 + 18% = ₹590 only')
ok(await stock(clean._id) === c0 - 2 && r.data.bill.items[1].costBreakdown.length === 1 && r.data.bill.cost.material === 6101 * 2, 'non-chargeable material STILL reduces stock (−2), keeps FIFO batch + cost ₹12,202 internally')
let d = await doc(r.data.billId)
ok(!d.sections.some((s) => s.key === 'material') && d.totals.total === 590, 'customer document hides the internal-use material and its total')
const v = await req('GET', `/api/seller/billing/bills/${r.data.billId}`, null, T)
ok(v.data.lines.find((l) => l.type === 'material').charge === 'internal', 'owner Bill View still lists it (flagged not charged)')

// ── TEST 12: included material/labour in a service price — Full Car Service ₹2,000
let o0 = await stock(oil._id)
r = await sell({ customerName: 'Raj', items: [{ type: 'service', name: 'Full Car Service', rate: 2000 }, { type: 'material', productId: oil._id, quantity: 4, charge: 'included' }, { type: 'labour', name: 'Mechanic time', pricing: 'hourly', qty: 3, charge: 'included' }] })
ok(r.status === 201 && r.data.bill.subtotal === 2000 && r.data.bill.totalAmount === 2360 && r.data.bill.revenue.service === 2000 && r.data.bill.revenue.labour === 0, 'TEST 12 included: Full Car Service ₹2,000 (+18% = ₹2,360); oil and labour NOT charged again')
ok(await stock(oil._id) === o0 - 4 && r.data.bill.items[1].cost === 4713, 'included Engine Oil (4 L) still deducted from inventory')
d = await doc(r.data.billId)
ok(d.sections.find((s) => s.key === 'material').items[0].included === true && d.sections.find((s) => s.key === 'labour').items[0].included === true, 'customer sees “included in service” lines with no extra price')

// ── product rate edit (bill only)
r = await sell({ items: [{ productId: oil._id, quantity: 1, rate: 450 }] })
ok(r.data.bill.items[0].rate === 450 && (await req('GET', '/api/seller/products', null, T)).data.find((p) => p._id === oil._id).price === 500, 'rate change applies to the bill only; inventory master price still ₹500')

// ── TEST 6: Product + Service + Material + Labour + other, with description + vehicle context
r = await sell({ customerName: 'Raj', context: { vehicle_number: 'UP32 AB 1234', km: '45,000' }, items: [
  { productId: oil._id, quantity: 2, description: 'Synthetic 5W-30' }, { type: 'material', productId: gas._id, quantity: 1, rate: 500 },
  { type: 'service', name: 'AC Service', rate: 500, description: 'Full check' }, { type: 'labour', name: 'Repair Labour', pricing: 'hourly', qty: 2, rate: 300 }, { type: 'other', name: 'Cleaning', rate: 100 }] })
ok(r.status === 201 && r.data.bill.subtotal === 2700 && r.data.bill.totalAmount === 3186 && r.data.transactionType === 'mixed', 'TEST 6 all five types: 1000+500+500+600+100 = ₹2,700 + 18% = ₹3,186, Mixed')
ok(r.data.bill.context.length === 2 && r.data.bill.items[0].description === 'Synthetic 5W-30', 'description + context snapshotted')
const hybridId = r.data.billId

// ── TEST 9/10 + multi-payment: ₹3,000 = cash 1,000 + UPI 1,000 + due 1,000
await req('PUT', '/api/seller/billing/config', { tax: false }, T)
r = await sell({ customerName: 'Mohan', customerPhone: '9000000001', addRemainingToUdhar: true, payments: [{ method: 'cash', amount: 1000 }, { method: 'upi', amount: 1000 }], items: [{ type: 'service', name: 'Big job', rate: 3000 }] })
ok(r.status === 201 && r.data.bill.paidAmount === 2000 && r.data.bill.unpaidAmount === 1000 && r.data.bill.paymentStatus === 'partial' && r.data.bill.payments.length === 2, 'TEST 17 multi-payment: ₹3,000 = cash 1,000 + UPI 1,000 + due 1,000 → partial')
const splitId = r.data.billId
d = await doc(splitId)
ok(d.payment.payments.length === 2 && d.payment.method === 'Cash + UPI' && d.payment.status === 'Partial' && d.totals.due === 1000, 'payment history keeps each method separately; document says “Cash + UPI · Partial · due ₹1,000”')
r = await req('POST', `/api/bills/${splitId}/payment`, { amount: 400, paymentType: 'card' }, T)
d = await doc(splitId); ok(d.payment.payments.length === 3 && d.payment.payments[2].method === 'Card' && d.totals.due === 600 && d.payment.status === 'Partial', 'later instalment (Card ₹400) appended to history; due ₹600, still Partial')
r = await req('GET', `/api/bills/${splitId}`, null, T); ok(r.data.payments.length === 3 && r.data.summary.unpaid === 600, 'Bill View API returns the full payment history')
r = await sell({ customerName: 'Mohan', payments: [{ method: 'bitcoin', amount: 5 }], items: [{ type: 'service', name: 'x', rate: 10 }] }); ok(r.status === 400, 'unknown payment method rejected')
r = await sell({ customerName: 'Sita', paymentMethod: 'udhar', receivedAmount: 0, returnedAmount: 0, addRemainingToUdhar: true, items: [{ type: 'service', name: 'Wiring', rate: 800 }] })
ok(r.data.bill.paymentStatus === 'unpaid' && r.data.bill.unpaidAmount === 800, 'TEST 10 Udhar: ₹800 outstanding')
d = await doc(r.data.billId); ok(d.payment.status === 'Udhar' && d.payment.method === 'Udhar' && d.totals.paid === 0, 'document status “Udhar”')
r = await sell({ customerName: 'Mohan', paymentMethod: 'cash', receivedAmount: 300, returnedAmount: 0, addRemainingToUdhar: true, items: [{ type: 'labour', name: 'Help', rate: 1000 }] })
ok(r.data.bill.paymentStatus === 'partial' && r.data.bill.paidAmount === 300 && r.data.bill.unpaidAmount === 700, 'TEST 9 partial: 300 received, 700 outstanding')
const partialId = r.data.billId

// ── TEST 17/18/20 customer-safe document: no cost anywhere in the API response either
d = await doc(hybridId)
const json = JSON.stringify(d)
ok(!json.includes('4713') && !/cost|supplier|batch|margin|profit/i.test(json.replace(/ordered|Cost/g, '')), 'document API response contains no cost / supplier / batch / margin / profit')
ok(d.business.name === 'Raj Garage' && d.business.address === 'MG Road' && d.terms === 'Warranty 30 days.' && d.customer.name === 'Raj' && d.context[0].value === 'UP32 AB 1234', 'document uses REAL business, terms, customer and context from the database')
ok(d.sections.map((s) => s.key).join() === 'product,service,material,labour,other', 'categorized: products, services, materials, labour, other')
ok(d.totals.subtotal === 2700 && d.totals.tax.amount === 486 && d.totals.total === 3186, 'document totals match the stored bill (2,700 + GST ₹486 = ₹3,186)')
ok(!(await req('GET', `/api/seller/billing/bills/${hybridId}/document`)).data?.sections, 'document endpoint needs login')

// ── TEST 13 draft → resume → finalize (nothing deducted by the draft)
const s0 = await stock(gas._id)
const state = { items: [{ key: 'c1', type: 'service', name: 'Install', price: 1000, qty: 1, pricing: 'fixed', description: 'Split AC', discountType: 'percent', discountValue: '10' }, { key: 'm1', type: 'material', id: gas._id, name: 'AC Gas', price: 0, qty: 1, charge: 'internal' }], method: 'Cash', discount: '50', discountType: 'fixed', split: { cash: '500', upi: '200', card: '' }, notes: 'internal', context: { km: '1000' } }
r = await req('POST', '/api/seller/billing/drafts', { customer: { name: 'Raj' }, total: 850, itemCount: 2, state }, T); const did = r.data.id
r = await req('GET', `/api/seller/billing/drafts/${did}`, null, T)
ok(JSON.stringify(r.data.state.items) === JSON.stringify(state.items) && r.data.state.discountType === 'fixed' && r.data.state.split.upi === '200' && r.data.state.context.km === '1000', 'TEST 13 draft preserves item discount/description/charge mode, bill discount + type, split payment, context')
ok(await stock(gas._id) === s0, 'draft did not touch inventory')
r = await sell({ draftId: did, customerName: 'Raj', discount: { type: 'fixed', value: 50 }, payments: [{ method: 'cash', amount: 500 }, { method: 'upi', amount: 200 }], addRemainingToUdhar: true, items: [{ type: 'service', name: 'Install', rate: 1000, description: 'Split AC', discountType: 'percent', discountValue: 10 }, { type: 'material', productId: gas._id, quantity: 1, charge: 'internal' }] })
ok(r.status === 201 && r.data.bill.totalAmount === 850 && r.data.bill.paidAmount === 700 && r.data.bill.unpaidAmount === 150 && await stock(gas._id) === s0 - 1, 'draft finalized: ₹1,000 −10% −₹50 = ₹850; paid 700 (cash+UPI), due 150; gas −1 only now')
ok((await req('GET', '/api/seller/billing/drafts', null, T)).data.length === 0, 'draft consumed')

// ── historical snapshot + legacy
await req('PUT', `/api/seller/products/${oil._id}`, { name: 'Renamed Oil', price: 999 }, T)
d = await doc(hybridId); ok(d.sections[0].items[0].name === 'Engine Oil' && d.sections[0].items[0].rate === 500 && d.totals.total === 3186, 'TEST 22 snapshot: old bill still “Engine Oil ₹500” after rename + price change')
d = await doc(groceryId); ok(d.sections.length === 1 && d.sections[0].items[0].name === 'Engine Oil' && d.totals.total === 1000 && d.payment.status === 'Paid', 'grocery bill document correct (Paid, ₹1,000)')
const legacyShop = (await Bill.findOne({ billId: groceryId })).shopId
await Bill.collection.insertOne({ shopId: legacyShop, billId: '260101B0001', customerName: 'Old', totalAmount: 300, paidAmount: 300, unpaidAmount: 0, paymentStatus: 'paid', paymentMethod: 'upi', status: 'paid', orderStatus: 'Delivered', createdAt: new Date(), updatedAt: new Date() })
d = await doc('260101B0001'); ok(d.totals.total === 300 && d.totals.subtotal === 300 && d.payment.status === 'Paid' && d.payment.method === 'UPI', 'pre-universal bill → document works (subtotal derived, method UPI)')

// ── cancel returns internal / included material too
const c1 = await stock(clean._id)
r = await req('PATCH', `/api/seller/orders/${nonCharge.billId}/status`, { status: 'Cancelled' }, T)
ok(r.status === 200 && await stock(clean._id) === c1 + 2, 'cancelling a bill with non-chargeable material returns the stock (+2)')

// ── cancellation reverses the financial record too (udhar balance) and keeps the bill for audit
const { default: Udhar } = await import('../models/common/Udhar.js'); const { default: Customer } = await import('../models/common/Customer.js')
const sita = await Customer.findOne({ name: 'Sita' }); const beforeU = (await Udhar.findOne({ customerId: sita._id }))?.totalAmount
r = await req('GET', '/api/seller/billing/recent', null, T); const sitaBill = r.data.find((x) => x.customer === 'Sita')
r = await req('PATCH', `/api/seller/orders/${sitaBill.billId}/status`, { status: 'Cancelled' }, T)
const afterU = (await Udhar.findOne({ customerId: sita._id }))?.totalAmount ?? 0
ok(beforeU === 800 && afterU === 0, 'cancelling an Udhar bill reverses the customer balance (₹800 → ₹0)')
ok((await Bill.findOne({ billId: sitaBill.billId })).orderStatus === 'Cancelled', 'cancelled bill is kept (status Cancelled), not deleted')
r = await req('GET', '/api/seller/billing/summary?days=30', null, T); ok(r.data.bills === (await Bill.countDocuments({ orderStatus: { $ne: 'Cancelled' } })), 'cancelled bills are excluded from analytics')

// ── TEST 20 analytics
r = await req('GET', '/api/seller/billing/summary?days=30', null, T); const s = r.data
const bucketSum = Object.values(s.revenue).reduce((a, b) => a + b, 0)
ok(near(s.totalRevenue, bucketSum) && s.grandTotal > s.totalRevenue && s.tax > 0 && s.discount > 0, `summary: revenue ₹${s.totalRevenue} (ex-tax) · grand total ₹${s.grandTotal} · discount ₹${s.discount} · tax ₹${s.tax}`)
ok(s.revenue.product > 0 && s.revenue.service > 0 && s.revenue.labour > 0 && s.revenue.other === 100 && s.revenue.material > 0, 'product / service / labour / other / material revenue each reported separately')
ok(s.materialCost > 0 && s.productCost > 0 && s.inventoryConsumed > 0 && s.materialUnits > 0, 'cost + inventory consumption recorded (incl. non-chargeable & included materials)')
ok(s.outstanding > 0 && s.udharBills >= 1 && s.paid > 0 && s.transactions.mixed >= 2 && s.transactions.service >= 2, `paid ₹${s.paid} · outstanding ₹${s.outstanding} (${s.udharBills} bills) · counts ${JSON.stringify(s.transactions)}`)
const expectedGross = s.totalRevenue - s.productCost - s.materialCost
ok(near(s.grossProfit, expectedGross), 'gross profit = revenue − product cost − material cost')
r = await req('GET', '/api/seller/analytics', null, T); ok(r.status === 200 && r.data.totals.totalSales > 0, 'existing seller analytics endpoint still works')
// the partial bill from earlier still shows Partial in Recent Bills
r = await req('GET', '/api/seller/billing/recent', null, T); ok(r.data.find((x) => x.billId === partialId).status === 'Partial' && r.data.find((x) => x.billId === splitId).status === 'Partial', 'Recent Bills: Partial for part-paid bills')

console.log('\nAll universal billing phase-2 integration tests passed')
server.close(); await mongoose.disconnect(); process.exit(0)
