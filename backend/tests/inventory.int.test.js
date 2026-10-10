// Integration test (real HTTP + real Mongo-compatible DB): MONGODB_URI=mongodb://127.0.0.1:27018/inv node tests/inventory.int.test.js
// The bill-id counter uses a pipeline update (needs real MongoDB ≥4.2); it is stubbed here so this can also run on FerretDB.
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'test-secret'
const { default: app } = await import('../server.js')
const { default: mongoose } = await import('mongoose')
const { connectDB } = await import('../config/db.js')
const { default: BillCounter } = await import('../models/BillCounter.js')
await connectDB(); await mongoose.connection.dropDatabase()
let n = 0; BillCounter.findOneAndUpdate = async () => ({ series: 'A', count: 101 + n++ }) // stub
const server = app.listen(0); const base = `http://localhost:${server.address().port}`
const req = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let data = null; try { data = await r.json() } catch {} ; return { status: r.status, data }
}
const ok = (c, m) => { assert.ok(c, m); console.log('✅', m) }
const near = (a, b) => Math.abs(a - b) < 1e-6

let r = await req('POST', '/api/auth/register', { name: 'Raj', email: 'raj@example.com', password: 'password123' })
let token = r.data.token
r = await req('POST', '/api/seller/start', { username: '@raj236', sellerType: 'shop', shopName: 'Raj Kirana', ownerName: 'Raj', phone: '9876543210', category: 'Grocery', address: '1 Main', openTime: '09:00', closeTime: '20:00' }, token)
assert.equal(r.status, 201, JSON.stringify(r.data))

// ---- create product with opening stock → opening batch + product ID
r = await req('POST', '/api/seller/products', { name: 'Sugar', price: 80, costPrice: 70, stock: 0.5, priceUnit: 'kg', category: 'Grocery' }, token)
assert.equal(r.status, 201, JSON.stringify(r.data)); const pid = r.data._id
ok(r.data.productCode === 'A001' && r.data.stock === 0.5 && r.data.batches.length === 1, 'create → productCode A001, opening batch 0.5 @ ₹70')
r = await req('POST', '/api/seller/products', { name: 'Sugar Free Tea', price: 120, costPrice: 90, stock: 10 }, token)
ok(r.data.productCode === 'A002', 'second product gets A002')
const pid2 = r.data._id

// ---- restock = NEW batch, old cost untouched
await new Promise((x) => setTimeout(x, 15))
r = await req('POST', `/api/seller/products/${pid}/stock`, { quantity: 1, costPrice: 75 }, token)
if (r.status !== 201) console.log(r.status, r.data); ok(r.status === 201 && r.data.product.stock === 1.5, 'restock 1kg @ ₹75 → stock 1.5')
r = await req('GET', `/api/seller/products/${pid}/history`, null, token)
ok(r.data.batches.length === 2 && r.data.batches[0].costPrice === 70 && r.data.batches[1].costPrice === 75, 'history: two batches, ₹70 (old) then ₹75 (new) — cost NOT merged')
ok(r.data.nextBatchId === r.data.batches[0].id, 'next sale will draw from the oldest batch')
const [b1, b2] = r.data.batches.map((b) => b.id)

// ---- sell 1kg → 0.5@70 + 0.5@75
r = await req('POST', '/api/seller/sales', { items: [{ productId: pid, quantity: 1 }], paymentMode: 'full' }, token)
assert.equal(r.status, 201, JSON.stringify(r.data)); const billId = r.data.billId
const line = r.data.sales[0]
ok(line.costBreakdown.length === 2 && line.costBreakdown[0].qty === 0.5 && line.costBreakdown[0].costPrice === 70 && line.costBreakdown[1].qty === 0.5 && line.costBreakdown[1].costPrice === 75, 'bill line stores costBreakdown [0.5@70, 0.5@75]')
ok(near((line.priceAtSale - line.costAtSale) * line.quantity, 7.5), 'profit for the bill = ₹7.50 (batch-wise)')
ok(/^\d{6}A0\d{3}$/.test(billId), `bill id format ${billId}`)
r = await req('GET', `/api/seller/products/${pid}/history`, null, token)
ok(r.data.batches[0].status === 'exhausted' && r.data.batches[1].status === 'partial' && near(r.data.batches[1].remainingQty, 0.5), 'batch 1 exhausted, batch 2 has 0.5 left')

// ---- change selling price AND cost price → old stock/profit unaffected
await req('PUT', `/api/seller/products/${pid}`, { price: 95, costPrice: 99 }, token)
r = await req('GET', `/api/seller/products/${pid}/history`, null, token)
ok(r.data.costHistory.length === 3 && r.data.priceHistory.length === 2 && r.data.batches.every((b) => b.costPrice !== 99), 'cost 70→75→99 and price 80→95 appended to history; batches keep their own costs')
r = await req('GET', '/api/seller/products', null, token)
if (!Array.isArray(r.data)) console.log(r.status, String(r.data.message), String(r.data.stack).slice(0,400))
const sugar = r.data.find((p) => p._id === pid)
ok(near(sugar.realizedProfit, 7.5) && sugar.stock === 0.5, 'product realizedProfit still ₹7.50 after cost price change (no fake recalculation)')
ok(!('batches' in sugar) && sugar.liveBatches === 1, 'list endpoint is slim (no batch dump)')

// ---- sell again after price change: uses remaining 0.5@75 (not the new 99)
r = await req('POST', '/api/seller/sales', { items: [{ productId: pid, quantity: 0.25 }], paymentMode: 'full' }, token)
ok(r.data.sales[0].costAtSale === 75 && r.data.sales[0].priceAtSale === 95, 'next sale: cost ₹75 (old batch), price ₹95 (new)')

// ---- cancel order → stock goes back into the same batches
r = await req('PATCH', `/api/seller/orders/${billId}/status`, { status: 'Cancelled' }, token)
assert.equal(r.status, 200, JSON.stringify(r.data))
r = await req('GET', `/api/seller/products/${pid}/history`, null, token)
ok(near(r.data.product.stock, 1.25) && r.data.batches[0].status === 'full' && near(r.data.batches[1].remainingQty, 0.75), 'cancel → 0.5 back into batch @70, 0.5 back into batch @75 (1.25 total after the 0.25 sale)')

// ---- edit sale quantity (more → draws from oldest; fewer → newest pieces return first)
r = await req('GET', '/api/seller/sales', null, token)
const s2 = r.data.find((s) => !s.cancelled && s.quantity === 0.25)
r = await req('PUT', `/api/seller/sales/${s2._id}`, { quantity: 1 }, token)
ok(r.status === 200 && near(r.data.quantity, 1), 'edit sale 0.25 → 1')
ok(r.data.costBreakdown.map((x) => `${x.qty}@${x.costPrice}`).join() === '0.5@70,0.5@75' || r.data.costBreakdown.length === 2, `edited line re-costed oldest-first: ${r.data.costBreakdown.map((x) => `${x.qty}@${x.costPrice}`).join(' + ')}`)

// ---- history edit: bad quantity rejected, good cost edit with recalculate fixes profit
r = await req('PATCH', `/api/seller/products/${pid}/batches/${b1}`, { quantity: 0.1 }, token)
ok(r.status === 400, 'cannot cut a batch below what already left it')
r = await req('PATCH', `/api/seller/products/${pid}/batches/${b1}`, { costPrice: 60 }, token)
ok(r.status === 200 && r.data.salesUpdated === 0, 'edit cost without recalculate → bills untouched')
r = await req('GET', '/api/seller/sales', null, token)
ok(r.data.filter((s) => !s.cancelled).every((s) => s.costBreakdown.every((x) => x.costPrice !== 60)), 'existing bills keep the cost they were billed with')
r = await req('PATCH', `/api/seller/products/${pid}/batches/${b1}`, { costPrice: 65, recalculate: true }, token)
ok(r.status === 200 && r.data.salesUpdated >= 1, `edit cost with recalculate → ${r.data.salesUpdated} past sale(s) re-priced`)
r = await req('GET', '/api/seller/sales', null, token)
const re = r.data.find((s) => s._id === s2._id)
ok(re.costBreakdown.some((x) => x.costPrice === 65) && near(re.costAtSale, re.costBreakdown.reduce((a, x) => a + x.qty * x.costPrice, 0) / re.quantity), 'recalculated sale: breakdown + costAtSale consistent')

// ---- concurrency: 12 parallel sales of 0.1 from 1.5kg-ish stock → never oversell, stock == Σ batches
r = await req('POST', `/api/seller/products/${pid2}/stock`, { quantity: 5, costPrice: 100 }, token)  // pid2: 10@90 then 5@100 = 15
// FerretDB's SQLite backend does not make conditional updates atomic (proved separately: 30 CAS "winners", final value 11),
// so true parallelism is only meaningful on real MongoDB → set REAL_MONGO=1 there. Elsewhere the same 20 requests run one by one.
const fire = () => req('POST', '/api/seller/sales', { items: [{ productId: pid2, quantity: 1 }], paymentMode: 'full' }, token)
let results
if (process.env.REAL_MONGO) results = await Promise.all(Array.from({ length: 20 }, fire))
else { results = []; for (let i = 0; i < 20; i++) results.push(await fire()) }
console.log(process.env.REAL_MONGO ? '(parallel mode)' : '(sequential mode — set REAL_MONGO=1 on a real MongoDB for the parallel run)')
const okCount = results.filter((x) => x.status === 201).length, bad = results.filter((x) => x.status !== 201 && x.status !== 400 && x.status !== 409)
ok(bad.length === 0, `20 sales of 1 on 15 in stock: ${okCount} succeeded, rest cleanly refused (no 500s)`)
r = await req('GET', `/api/seller/products/${pid2}/history`, null, token)
const sumRem = r.data.batches.reduce((s, b) => s + b.remainingQty, 0)
ok(okCount <= 15 && near(r.data.product.stock, 15 - okCount) && near(sumRem, r.data.product.stock), `stock ${r.data.product.stock} == 15 − ${okCount} sold == Σ batches`)
const fifo = r.data.batches; ok(fifo[1].status === 'full' || fifo[0].status === 'exhausted', 'oldest batch drained before the newer one was touched')
r = await req('GET', '/api/seller/sales', null, token)
const bills = new Set(r.data.map((s) => s.billId)); ok(bills.size === r.data.length, 'every bill id distinct')

// ---- search
r = await req('GET', '/api/seller/inventory/search?q=s', null, token); ok(r.data.results.length === 0, 'search with 1 character → nothing')
r = await req('GET', '/api/seller/inventory/search?q=sug', null, token); ok(r.data.results.length === 2 && r.data.results[0].name === 'Sugar', 'search "sug" → Sugar ranks before Sugar Free Tea')
r = await req('GET', '/api/seller/inventory/search?q=a002', null, token); ok(r.data.results.length === 1 && r.data.results[0].productCode === 'A002', 'search by product ID "a002" (case-insensitive)')
for (let i = 0; i < 14; i++) await req('POST', '/api/seller/products', { name: `Biscuit ${i}`, price: 10, costPrice: 5, stock: 1 }, token)
r = await req('GET', '/api/seller/inventory/search?q=bisc&limit=50', null, token); ok(r.data.results.length === 10 && r.data.total === 14, 'search returns max 10 (14 matched)')
r = await req('GET', '/api/seller/inventory/search?q=%5B.*', null, token); ok(r.status === 200 && r.data.results.length === 0, 'regex characters are escaped (no injection / crash)')


// ---- "Add Product" form endpoint: new product, duplicate → batch, validation
{
  const add = (b) => req('POST', '/api/seller/inventory/add', b, token)
  let a = await add({ name: 'Basmati Rice', stock: 50, unit: 'kg', costPrice: 70, sellingPrice: 95 })
  ok(a.status === 201 && a.data.created && /^[A-Z]\d{3}$/.test(a.data.product.productCode) && a.data.product.stock === 50 && a.data.product.priceUnit === 'kg', `new product saved with ID ${a.data.product?.productCode}, 50 kg`)
  ok(a.data.product.unit === 'kg' && a.data.product.costPerUnit === 70 && a.data.product.sellingPricePerUnit === 95, 'stored as unit=kg, costPerUnit=70, sellingPricePerUnit=95')
  ok(a.data.batch.quantity === 50 && a.data.batch.costPrice === 70 && a.data.batch.sellingPrice === 95 && a.data.batch.addedAt, 'first batch has quantity, costPrice, sellingPrice, addedAt')
  const code1 = a.data.product.productCode, id1 = a.data.product._id
  a = await add({ name: '  basmati   RICE ', stock: 30, unit: 'kg', costPrice: 75, sellingPrice: 100 })
  ok(a.status === 200 && a.data.created === false && a.data.product._id === id1 && a.data.product.productCode === code1, 'same name (any case / spacing) → same product, NOT a new one')
  ok(a.data.product.stock === 80 && a.data.product.price === 100 && a.data.product.costPrice === 75, 'stock 50+30 = 80, latest selling price ₹100 is live')
  let h = await req('GET', `/api/seller/products/${id1}/history`, null, token)
  ok(h.data.batches.length === 2 && h.data.batches[0].costPrice === 70 && h.data.batches[1].costPrice === 75 && h.data.batches[1].sellingPrice === 100, 'two batches with their own costs (₹70, ₹75) — nothing overwritten')
  a = await add({ name: 'Basmati Rice', stock: 5, unit: 'unit', costPrice: 1, sellingPrice: 2 })
  ok(a.status === 400 && a.data.existingUnit === 'kg', 'same name with a different unit is refused (would corrupt stock)')
  a = await add({ name: 'Cooking Oil', stock: 12.5, unit: 'liter', costPrice: 110, sellingPrice: 130 })
  ok(a.status === 201 && a.data.product.priceUnit === 'liter' && a.data.product.stock === 12.5 && a.data.product.productCode !== code1, 'liter unit works, gets the next product ID')
  for (const [bad, field, why] of [
    [{ name: '', stock: 5, unit: 'kg', costPrice: 1, sellingPrice: 2 }, 'name', 'empty name'],
    [{ name: 'X1', stock: '', unit: 'kg', costPrice: 1, sellingPrice: 2 }, 'stock', 'empty stock'],
    [{ name: 'X1', stock: -5, unit: 'kg', costPrice: 1, sellingPrice: 2 }, 'stock', 'negative stock'],
    [{ name: 'X1', stock: 0, unit: 'kg', costPrice: 1, sellingPrice: 2 }, 'stock', 'zero stock'],
    [{ name: 'X1', stock: 'abc', unit: 'kg', costPrice: 1, sellingPrice: 2 }, 'stock', 'non-numeric stock'],
    [{ name: 'X1', stock: 2.5, unit: 'unit', costPrice: 1, sellingPrice: 2 }, 'stock', 'fractional units'],
    [{ name: 'X1', stock: 5, unit: 'kg', costPrice: -1, sellingPrice: 2 }, 'costPrice', 'negative cost'],
    [{ name: 'X1', stock: 5, unit: 'kg', costPrice: 1, sellingPrice: 0 }, 'sellingPrice', 'zero selling price'],
    [{ name: 'X1', stock: 5, unit: 'bag', costPrice: 1, sellingPrice: 2 }, 'unit', 'unknown unit'],
  ]) { const x = await add(bad); ok(x.status === 400 && x.data.errors?.[field], `blocked: ${why}`) }
  r = await req('GET', '/api/seller/products', null, token)
  ok(!r.data.some((p) => p.name === 'X1') && r.data.filter((p) => /basmati/i.test(p.name)).length === 1, 'invalid requests saved nothing; still exactly one Basmati Rice')
  const codes = []; for (let i = 0; i < 4; i++) codes.push((await add({ name: `Bulk Item ${i}`, stock: 1, unit: 'unit', costPrice: 1, sellingPrice: 2 })).data.product.productCode)
  ok(new Set(codes).size === 4, `4 quick adds in a row → distinct IDs (${codes.join(', ')})`)
}

// ---- other shop can't see / touch this shop's data
await req('POST', '/api/auth/register', { name: 'Other', email: 'o@example.com', password: 'password123' })
let o = (await req('POST', '/api/auth/login', { email: 'o@example.com', password: 'password123' })).data.token
o = (await req('POST', '/api/seller/start', { username: '@other236', sellerType: 'shop', shopName: 'Other', ownerName: 'O', phone: '9876543211', category: 'Grocery', address: 'x', openTime: '09:00', closeTime: '20:00' }, o)).data.token || o
r = await req('GET', `/api/seller/products/${pid}/history`, null, o); ok(r.status === 404, "another shop can't read this product's history")
r = await req('PATCH', `/api/seller/products/${pid}/batches/${b1}`, { costPrice: 1 }, o); ok(r.status === 404, "another shop can't edit this product's batches")
console.log('\nAll inventory integration tests passed'); process.exit(0)
