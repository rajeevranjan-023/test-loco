// Universal Billing — integration (real HTTP + Mongo-compatible DB):
//   MONGODB_URI=mongodb://127.0.0.1:27018/bill node tests/billing.int.test.js
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'test-secret'
const { default: app } = await import('../server.js')
const { default: mongoose } = await import('mongoose')
const { connectDB } = await import('../config/db.js')
const { default: BillCounter } = await import('../models/common/BillCounter.js')
const { default: Bill } = await import('../models/common/Bill.js')
const { default: Sale } = await import('../models/common/Sale.js')
{ const { assertDisposableDb } = await import('./_safeDb.js'); assertDisposableDb(process.env.MONGODB_URI, 'billing.int') } // never drop a non-local database
await connectDB(); await mongoose.connection.dropDatabase()
let n = 0; BillCounter.findOneAndUpdate = async () => ({ series: 'A', count: 101 + n++ }) // stub (needs real MongoDB ≥4.2 otherwise)
const server = app.listen(0); const base = `http://localhost:${server.address().port}`
const req = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let data = null; try { data = await r.json() } catch {} ; return { status: r.status, data }
}
const ok = (c, m) => { assert.ok(c, m); console.log('✅', m) }
const near = (a, b) => Math.abs(a - b) < 0.006

// ───────── accounts: one shop (will become a hybrid/mechanic), one service provider ─────────
const reg = async (name, email) => (await req('POST', '/api/auth/register', { name, email, password: 'password123' })).data.token
const T = await reg('Raj', 'raj@example.com'), P = await reg('Pro', 'pro@example.com')
let r = await req('POST', '/api/seller/start', { username: '@raj236', sellerType: 'shop', shopName: 'Raj Garage', ownerName: 'Raj', phone: '9876543210', category: 'Other', address: 'Main road' }, T); assert.equal(r.status, 201, JSON.stringify(r.data))
r = await req('POST', '/api/seller/start', { username: '@acpro481', sellerType: 'service', name: 'AC Pro', phone: '9876500000', workType: 'AC Repair', priceAmount: 500 }, P); assert.equal(r.status, 201, JSON.stringify(r.data))

const mk = async (tok, body) => (await req('POST', '/api/seller/products', body, tok)).data
const stockOf = async (tok, id) => (await req('GET', '/api/seller/products', null, tok)).data.find((p) => p._id === id).stock
const sell = (tok, body) => req('POST', '/api/seller/sales', { paymentMode: 'full', ...body }, tok)
const detail = (tok, id) => req('GET', `/api/seller/billing/bills/${id}`, null, tok)

// ───────── 14. existing Grocery / Seller billing (default config: Product only) ─────────
r = await req('GET', '/api/seller/billing/config', null, T)
ok(r.data.lineTypes.length === 1 && r.data.lineTypes[0].type === 'product', 'shop default: only “Product” is offered (UI stays the plain grocery screen)')
const rice = await mk(T, { name: 'Rice', price: 60, costPrice: 50, stock: 100, priceUnit: 'kg' })
const oil = await mk(T, { name: 'Oil', price: 150, costPrice: 120, stock: 50, priceUnit: 'liter' })
r = await sell(T, { items: [{ productId: rice._id, quantity: 5 }, { productId: oil._id, quantity: 2 }], customerName: 'Raj', paymentMethod: 'cash' })
assert.equal(r.status, 201, JSON.stringify(r.data))
ok(r.data.bill.totalAmount === 600 && r.data.transactionType === 'sale' && r.data.sales.length === 2, 'Example 1 Grocery: Rice 5kg + Oil 2L = ₹600, Sale, 2 Sale rows')
ok(await stockOf(T, rice._id) === 95 && await stockOf(T, oil._id) === 48, 'Example 1: inventory decreased (Rice 95, Oil 48)')
ok(r.data.bill.revenue.product === 600 && r.data.bill.revenue.service === 0, 'revenue split: product 600')
ok(/^\d{6}A0\d{3}$/.test(r.data.billId), `existing bill-ID system used (${r.data.billId})`)
const groceryBill = r.data.billId
r = await req('GET', '/api/seller/analytics', null, T)
ok(r.data.totals.totalSales === 600 && r.data.totals.totalUnitsSold === 7, 'existing seller analytics unchanged: sales ₹600, 7 units')
r = await req('POST', '/api/seller/sales', { items: [{ type: 'service', name: 'X', rate: 10 }] }) // no token
ok(r.status === 401, 'unauthenticated billing refused')
r = await sell(T, { items: [{ type: 'service', name: 'AC Service', rate: 500 }] })
ok(r.status === 400 && /not enabled/.test(r.data.message), 'Service line refused while the business has not enabled Services (server enforces config)')
r = await sell(T, { items: [{ productId: rice._id, quantity: 1 }], discount: 10 })
ok(r.status === 400 && /Discount/.test(r.data.message), 'discount refused while disabled')

// ───────── configure the shop as a hybrid (Mechanic) ─────────
r = await req('PUT', '/api/seller/billing/config', { products: true, services: true, materials: true, labour: true, otherCharges: true, discount: true, context: [{ label: 'Vehicle', required: false }] }, T)
ok(r.data.lineTypes.map((t) => t.type).join() === 'product,service,material,labour,other', 'hybrid config → Product, Service, Material, Labour, Other Charge')

// inventory: Engine Oil (sellable AND consumable), Oil Filter + Capacitor (service parts, not sold directly), Brake Pad
const engineOil = await mk(T, { name: 'Engine Oil', price: 1000, costPrice: 700, stock: 10, priceUnit: 'unit' })
const filter = await mk(T, { name: 'Oil Filter', price: 500, costPrice: 300, stock: 10, sellable: false })
const cap = await mk(T, { name: 'Capacitor', price: 200, costPrice: 120, stock: 5, sellable: false })
const brake = await mk(T, { name: 'Brake Pad', price: 2000, costPrice: 1500, stock: 4 })

// ───────── 2/6. Service + Material + Labour (AC service) ─────────
r = await sell(T, { customerName: 'Raj', items: [
  { type: 'service', name: 'AC General Service', rate: 500 },
  { type: 'material', productId: cap._id, quantity: 1 },
  { type: 'labour', name: 'Technician Labour', rate: 300 }] })
assert.equal(r.status, 201, JSON.stringify(r.data))
let b = r.data.bill
ok(b.totalAmount === 1000 && r.data.transactionType === 'mixed', 'Example 2 AC Service: ₹1,000, Mixed')
ok(await stockOf(T, cap._id) === 4, 'Example 2: Capacitor stock decreased 5 → 4')
ok(r.data.sales.length === 0, 'material consumption creates NO Sale row (keeps product analytics clean)')
ok(b.revenue.service === 500 && b.revenue.labour === 300 && b.revenue.material === 200 && b.revenue.other === 0, 'Service / Labour / Material revenue kept separate')
const capLine = b.items.find((i) => i.type === 'material')
ok(capLine.costBreakdown.length === 1 && capLine.costBreakdown[0].costPrice === 120 && capLine.cost === 120, 'exact batch consumed + cost recorded on the line')
const acBill = r.data.billId

// ───────── 1. product-only (done) · 2. service-only · 3. labour-only ─────────
r = await sell(T, { items: [{ type: 'service', name: 'AC Gas Refill', rate: 1800 }] })
ok(r.data.transactionType === 'service' && r.data.bill.totalAmount === 1800 && r.data.bill.revenue.service === 1800, 'Service-only → Service')
r = await sell(T, { customerName: 'Raj', items: [{ type: 'labour', name: 'Furniture Installation', rate: 1500 }] })
ok(r.data.transactionType === 'labour' && r.data.bill.totalAmount === 1500 && r.data.bill.revenue.labour === 1500, 'Example 4 Labour-only: ₹1,500, Labour, no inventory needed')

// ───────── 4. Product + Service (brake) ─────────
r = await sell(T, { customerName: 'Raj', items: [{ productId: brake._id, quantity: 1 }, { type: 'service', name: 'Brake Replacement', rate: 500 }] })
ok(r.data.transactionType === 'mixed' && r.data.bill.totalAmount === 2500 && await stockOf(T, brake._id) === 3 && r.data.sales.length === 1, 'Example 5 Product + Service: ₹2,500, Mixed, Brake Pad 4 → 3')

// ───────── 7. Product + Service + Labour + Material + Other (Car mechanic, with vehicle context) ─────────
r = await sell(T, { customerName: 'Raj', context: { vehicle: 'UP32 AB 1234' }, items: [
  { productId: engineOil._id, quantity: 1 },
  { type: 'material', productId: filter._id, quantity: 1 },
  { type: 'service', name: 'Engine Service', rate: 1000 },
  { type: 'labour', name: 'Repair Labour', rate: 800 },
  { type: 'other', name: 'Cleaning', rate: 100 }] })
assert.equal(r.status, 201, JSON.stringify(r.data))
ok(r.data.bill.totalAmount === 3400 && r.data.transactionType === 'mixed', 'Example 3 Car mechanic: ₹3,400, Mixed')
ok(r.data.bill.revenue.other === 100 && r.data.bill.revenue.service === 1000, 'Other charge (₹100) stays separate from Service (₹1,000)')
ok(r.data.bill.context[0].label === 'Vehicle' && r.data.bill.context[0].value === 'UP32 AB 1234', 'optional vehicle context saved')
ok(await stockOf(T, engineOil._id) === 9 && await stockOf(T, filter._id) === 9, 'Engine Oil (sold) and Oil Filter (material) both deducted')
const mechBill = r.data.billId

// same inventory item as Product AND Material in one bill — stock is checked together, nothing half-saved
const before = await stockOf(T, engineOil._id)
r = await sell(T, { items: [{ productId: engineOil._id, quantity: 6 }, { type: 'material', productId: engineOil._id, quantity: 5 }] })
ok(r.status === 400 && /Only 9/.test(r.data.message) && await stockOf(T, engineOil._id) === before, 'one item sold + used as material is limited by ONE shared stock; refused with no partial change')
r = await sell(T, { items: [{ productId: engineOil._id, quantity: 2 }, { type: 'material', productId: engineOil._id, quantity: 3, rate: 800 }] })
ok(r.status === 201 && await stockOf(T, engineOil._id) === before - 5 && r.data.bill.items[1].rate === 800, 'same Engine Oil item works as Product (₹1,000) AND Material (negotiated ₹800)')
r = await sell(T, { items: [{ type: 'material', productId: filter._id, quantity: 1 }] }); r = await sell(T, { items: [{ productId: filter._id, quantity: 1 }] })
ok(r.status === 400 && /service material/.test(r.data.message), 'service-only part cannot be sold from the Product list')
r = await sell(T, { items: [{ type: 'service', name: 'Service', rate: 100 }], context: {} }); ok(r.status === 201, 'context optional by default')
await req('PUT', '/api/seller/billing/config', { context: [{ label: 'Vehicle', required: true }] }, T)
r = await sell(T, { items: [{ type: 'service', name: 'Service', rate: 100 }] }); ok(r.status === 400 && /Vehicle is required/.test(r.data.message), 'required context enforced only when configured')
await req('PUT', '/api/seller/billing/config', { context: [{ label: 'Vehicle', required: false }] }, T)

// ───────── discount ─────────
r = await sell(T, { items: [{ type: 'service', name: 'Alignment', rate: 1000 }, { type: 'labour', name: 'Help', rate: 1000 }], discount: 200 })
ok(r.data.bill.totalAmount === 1800 && near(r.data.bill.revenue.service + r.data.bill.revenue.labour, 1800), 'discount ₹200: total ₹1,800 and revenue buckets still add up')

// ───────── 8/9/10. Paid · Partial · Udhar — independent of transaction type ─────────
r = await sell(T, { customerName: 'Mohan', customerPhone: '9000000001', paymentMethod: 'upi', receivedAmount: 1000, returnedAmount: 0, items: [{ type: 'service', name: 'Fan Repair', rate: 1000 }] })
ok(r.data.bill.paymentStatus === 'paid' && r.data.status === 'Cleared' && r.data.bill.paymentMethod === 'upi', 'Service + Paid (UPI)')
r = await sell(T, { customerName: 'Mohan', paymentMethod: 'cash', receivedAmount: 400, returnedAmount: 0, addRemainingToUdhar: true, items: [{ type: 'service', name: 'Geyser Repair', rate: 600 }, { type: 'labour', name: 'Labour', rate: 400 }] })
const partial = r.data.bill
ok(partial.totalAmount === 1000 && partial.paidAmount === 400 && partial.unpaidAmount === 600 && partial.paymentStatus === 'partial', 'Mixed + Partial: total 1000 · received 400 · outstanding 600')
let led = await req('GET', '/api/seller/udhar/overview', null, T)
r = await req('GET', '/api/seller/billing/recent', null, T)
const rec = r.data.find((x) => x.billId === partial.billId)
ok(rec.status === 'Partial' && rec.transactionType === 'mixed' && rec.items === 2, 'Recent Bills row: Partial · Mixed · 2 items (partial is NOT shown as Cleared)')
r = await sell(T, { customerName: 'Sita', paymentMethod: 'udhar', receivedAmount: 0, returnedAmount: 0, addRemainingToUdhar: true, items: [{ productId: brake._id, quantity: 1 }, { type: 'labour', name: 'Fitting', rate: 500 }] })
ok(r.data.bill.paymentStatus === 'unpaid' && r.data.bill.unpaidAmount === 2500 && r.data.status === 'Pending', 'Mixed + Udhar: ₹2,500 outstanding')
r = await sell(T, { customerName: 'Ravi', paymentMethod: 'udhar', receivedAmount: 0, returnedAmount: 0, addRemainingToUdhar: true, items: [{ productId: rice._id, quantity: 1 }] })
ok(r.data.bill.paymentStatus === 'unpaid' && r.data.transactionType === 'sale', 'Sale + Udhar')
// pay the partial bill in two instalments (payment history) — must not clear early
r = await req('POST', `/api/bills/${partial.billId}/payment`, { amount: 250, paymentType: 'cash' }, T)
ok(r.status === 200 && r.data.paid === 650 && r.data.unpaid === 350 && r.data.paymentStatus === 'partial', 'instalment ₹250 → paid 650, ₹350 still outstanding, still “partial” (not cleared)')
r = await req('POST', `/api/bills/${partial.billId}/payment`, { amount: 350, paymentType: 'upi' }, T)
ok(r.data.unpaid === 0 && r.data.paymentStatus === 'paid', 'final ₹350 → fully paid')
r = await req('GET', `/api/bills/${partial.billId}`, null, T)
ok(r.data.ledger.filter((e) => e.type === 'payment').length === 2 && r.data.summary.unpaid === 0 && r.data.transactionType === 'mixed', 'payment history lists both instalments; bill page also returns transaction type')

// ───────── 11. Draft & resume (no stock effect) ─────────
const stockBeforeDraft = await stockOf(T, cap._id)
const state = { items: [{ key: 'c:1', type: 'service', name: 'AC Install', price: 2000, qty: 1, pricing: 'fixed' }, { key: 'm:' + cap._id, type: 'material', id: cap._id, name: 'Capacitor', price: 200, qty: 2 }, { key: 'c:2', type: 'labour', name: 'Labour', price: 250, qty: 3, unit: 'hr', pricing: 'hourly' }], method: 'UPI', recv: '1000', notes: 'call before coming', discount: '50', context: { vehicle: 'Scooter' }, mode: 'labour' }
r = await req('POST', '/api/seller/billing/drafts', { customer: { name: 'Raj' }, total: 3100, itemCount: 3, state }, T); assert.equal(r.status, 201, JSON.stringify(r.data))
const did = r.data.id
r = await req('GET', `/api/seller/billing/drafts/${did}`, null, T)
ok(JSON.stringify(r.data.state.items) === JSON.stringify(state.items) && r.data.state.context.vehicle === 'Scooter' && r.data.state.discount === '50' && r.data.state.notes === 'call before coming' && r.data.state.method === 'UPI', 'Draft resume restores customer, typed lines, hours/rates, notes, payment, discount, context')
ok(await stockOf(T, cap._id) === stockBeforeDraft, 'a draft never touches inventory')
r = await sell(T, { draftId: did, customerName: 'Raj', items: [{ type: 'service', name: 'AC Install', rate: 2000 }] })
r = await req('GET', '/api/seller/billing/drafts', null, T); ok(r.data.length === 0, 'generating the bill consumes the draft')

// ───────── 12. FIFO inventory deduction through a material line ─────────
await req('POST', `/api/seller/products/${cap._id}/stock`, { quantity: 10, costPrice: 150 }, T) // 2nd batch @150 (first batch 4 left @120)
r = await sell(T, { items: [{ type: 'service', name: 'Compressor job', rate: 100 }, { type: 'material', productId: cap._id, quantity: 6 }] })
const compBill = r.data.billId
const ml = r.data.bill.items.find((i) => i.type === 'material')
ok(ml.costBreakdown.length === 2 && ml.costBreakdown[0].qty === 4 && ml.costBreakdown[0].costPrice === 120 && ml.costBreakdown[1].qty === 2 && ml.costBreakdown[1].costPrice === 150, 'material drains the OLDEST batch first (4 @ ₹120, then 2 @ ₹150)')
ok(near(ml.cost, (4 * 120 + 2 * 150) / 6), 'weighted cost snapshot recorded')
r = await req('GET', `/api/seller/products/${cap._id}/history`, null, T)
ok(r.data.batches[0].status === 'exhausted' && near(r.data.batches[1].remainingQty, 8), 'inventory history/batches updated (batch 1 exhausted, batch 2 has 8)')

// ───────── atomicity: a failure after stock was taken leaves nothing behind ─────────
const stockA = await stockOf(T, brake._id), billsA = await Bill.countDocuments({}), salesA = await Sale.countDocuments({})
const realCreate = Bill.create.bind(Bill); Bill.create = async () => { throw new Error('simulated DB failure') }
r = await sell(T, { customerName: 'Raj', items: [{ productId: brake._id, quantity: 1 }, { type: 'material', productId: cap._id, quantity: 1 }, { type: 'service', name: 'x', rate: 10 }] })
Bill.create = realCreate
ok(r.status >= 500 && await stockOf(T, brake._id) === stockA && await Bill.countDocuments({}) === billsA && await Sale.countDocuments({}) === salesA, 'simulated failure → stock fully restored, no Bill, no Sale rows (no partial bill)')
ok(await stockOf(T, cap._id) === 8, 'material stock restored after the failed bill (still 8)')

// ───────── 13. Historical correctness ─────────
await req('PUT', `/api/seller/products/${engineOil._id}`, { name: 'Premium Engine Oil 5W', price: 1500 }, T)
await req('POST', '/api/seller/billing/services', { kind: 'service', name: 'Engine Service', rate: 2500 }, T)
r = await detail(T, mechBill)
const names = r.data.lines.map((l) => `${l.name}@${l.price}`)
ok(names.includes('Engine Oil@1000') && names.includes('Engine Service@1000') && r.data.total === 3400, 'old bill still reads “Engine Oil ₹1,000” after rename + price change; ₹3,400 unchanged')
ok(r.data.transactionType === 'mixed' && r.data.context[0].value === 'UP32 AB 1234', 'bill view returns transaction type + context')
r = await detail(T, groceryBill); ok(r.data.lines.length === 2 && r.data.total === 600 && r.data.lines[0].name === 'Rice', 'legacy-shaped grocery bill view still correct')
// a bill written BEFORE universal billing (no items/revenue/transactionType) still shows + counts
const legacy = await Bill.collection.insertOne({ shopId: (await Bill.findOne({ billId: groceryBill })).shopId, billId: '261001A0001', customerName: 'Old', totalAmount: 300, paidAmount: 300, unpaidAmount: 0, paymentStatus: 'paid', paymentMethod: 'cash', status: 'paid', orderStatus: 'Delivered', createdAt: new Date(), updatedAt: new Date() })
r = await detail(T, '261001A0001'); ok(r.status === 200 && r.data.transactionType === 'sale' && r.data.lines.length === 0 && r.data.total === 300, 'pre-universal bill (no items field) still opens as a Sale')

// ───────── cancel returns material + product stock ─────────
const capBefore = await stockOf(T, cap._id), filterBefore = await stockOf(T, filter._id), engBefore = await stockOf(T, engineOil._id)
r = await req('PATCH', `/api/seller/orders/${mechBill}/status`, { status: 'Cancelled' }, T)
ok(r.status === 200 && await stockOf(T, filter._id) === filterBefore + 1 && await stockOf(T, engineOil._id) === engBefore + 1, 'cancelling the Mechanic bill returns the Oil Filter (material) AND the Engine Oil (product)')
r = await req('PATCH', `/api/seller/orders/${compBill}/status`, { status: 'Cancelled' }, T)
ok(await stockOf(T, cap._id) === capBefore + 6, 'cancelling the Compressor bill returns 6 capacitors to their batches')
r = await req('GET', `/api/seller/products/${cap._id}/history`, null, T); ok(near(r.data.batches[0].remainingQty, 4) && near(r.data.batches[1].remainingQty, 10), 'capacitors went back into the very batches they came from (4 @ ₹120, 10 @ ₹150)')

// ───────── 15. analytics pipeline ─────────
r = await req('GET', '/api/seller/billing/summary?days=30', null, T); const s = r.data
ok(s.bills > 5 && near(s.totalRevenue, Object.values(s.revenue).reduce((a, b) => a + b, 0)), 'summary: revenue buckets add up to total revenue')
ok(s.revenue.service > 0 && s.revenue.labour > 0 && s.revenue.other === 0 && s.revenue.product > 0, 'summary separates product / service / labour / other revenue (other: cancelled ₹100 bill excluded)')
ok(s.transactions.sale >= 2 && s.transactions.service >= 2 && s.transactions.labour >= 1 && s.transactions.mixed >= 3, `summary counts: sale ${s.transactions.sale} · service ${s.transactions.service} · labour ${s.transactions.labour} · mixed ${s.transactions.mixed}`)
ok(s.outstanding === 2560 && s.udharBills === 2, 'summary: outstanding ₹2,560 (Sita 2,500 + Ravi 60) on 2 udhar bills; the part-paid bill is fully settled')
ok(s.paid > 0 && s.productCost > 0 && s.materialCost > 0 && s.inventoryConsumed > 0, 'summary carries paid, product cost, material cost and inventory consumed')

// ───────── a Service Provider account uses the SAME engine / customers / inventory ─────────
r = await req('GET', '/api/seller/billing/config', null, P)
ok(r.data.lineTypes.map((t) => t.type).join() === 'service,labour', 'service-provider default: Service + Labour only (no Product / Material noise)')
r = await sell(P, { customerName: 'Raj', items: [{ type: 'service', name: 'AC General Service', rate: 500 }, { type: 'labour', name: 'Technician', pricing: 'hourly', qty: 2, rate: 150 }] })
assert.equal(r.status, 201, JSON.stringify(r.data))
ok(r.data.bill.totalAmount === 800 && r.data.transactionType === 'mixed' && r.data.bill.items[1].unit === 'hr', 'provider bills Service (fixed) + Labour (2 hr × ₹150) = ₹800')
r = await sell(P, { items: [{ type: 'material', productId: cap._id, quantity: 1 }] }); ok(r.status === 400 && /not enabled/.test(r.data.message), 'provider cannot bill Material until it enables it')
r = await req('PUT', '/api/seller/billing/config', { materials: true, otherCharges: true }, P)
const pcap = (await req('POST', '/api/seller/products', { name: 'Gas Cylinder', price: 900, costPrice: 600, stock: 3, sellable: false }, P)).data
ok(pcap._id && pcap.sellable === false, 'provider can keep inventory (same inventory system)')
r = await sell(P, { customerName: 'Raj', items: [{ type: 'service', name: 'Gas Refill', rate: 400 }, { type: 'material', productId: pcap._id, quantity: 1 }, { type: 'other', name: 'Visit', rate: 100 }] })
ok(r.status === 201 && await stockOf(P, pcap._id) === 2 && r.data.bill.totalAmount === 1400, 'Service + Material + Other: inventory drops 3 → 2')
r = await req('GET', '/api/seller/billing/recent', null, P); ok(r.status === 200 && r.data.length === 2, 'provider Recent Bills works')
// FerretDB lacks $group/$first (pre-existing popularity query) — stub just that aggregate so the endpoint's own mapping still runs
const realAgg = Sale.aggregate.bind(Sale); Sale.aggregate = async () => []
r = await req('GET', '/api/seller/billing/products', null, T); Sale.aggregate = realAgg
ok(!r.data.some((p) => p.name === 'Gas Cylinder'), 'one account\'s inventory is invisible to another')
ok(r.data.find((p) => p.name === 'Oil Filter').sellable === false && r.data.find((p) => p.name === 'Brake Pad').sellable === true, 'billing product list exposes the sellable flag (Oil Filter = material-only)')
r = await req('GET', '/api/seller/billing/services?kind=service', null, P); ok(r.data.some((x) => x.name === 'AC General Service' && x.rate === 500), 'typed service remembered as a quick-pick (for next time)')
r = await req('GET', '/api/seller/billing/services', null, T); ok(!r.data.some((x) => x.name === 'Gas Refill'), 'quick-picks are per business')

console.log('\nAll universal billing integration tests passed')
server.close(); await mongoose.disconnect(); process.exit(0)
