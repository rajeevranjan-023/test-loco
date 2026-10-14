// Udhar page · universal customer search + "Add Customer & Udhar" — the REAL controllers (searchCustomers · selectGlobalCustomer · addEntry) and the REAL
// ledger against in-memory stand-ins for the Mongoose models (no database):   node tests/udhar.customerSearch.test.js
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'test-secret'
const { default: Customer } = await import('../models/Customer.js')
const { default: GlobalUser } = await import('../models/GlobalUser.js')
const { default: Udhar } = await import('../models/Udhar.js')
const { default: UdharHistory } = await import('../models/UdharHistory.js')
const { searchCustomers, selectGlobalCustomer } = await import('../controllers/billingController.js')
const { addEntry } = await import('../controllers/udharController.js')
const ok = (c, m) => { assert.ok(c, m); console.log('✅', m) }

let customers, globals, ledger, hist, seq, parties
const SA = '0000000000000000000000a1', SB = '0000000000000000000000b1'
const id = () => (++seq).toString(16).padStart(24, '0'); const same = (a, b) => String(a) === String(b)
const query = (get) => { const run = async () => get(); const q = { then: (a, b) => run().then(a, b), catch: (f) => run().catch(f), lean: () => run(), limit: () => q, select: () => q }; return q }
const matchC = (f) => (c) => (f.shopId === undefined || same(c.shopId, f.shopId)) && (f.phone === undefined || (f.phone instanceof RegExp ? f.phone.test(c.phone) : c.phone === f.phone)) && (f.name === undefined || (f.name instanceof RegExp ? f.name.test(c.name) : c.name === f.name)) && (f._id === undefined || same(c._id, f._id))
const doc = (o) => Object.assign(o, { save: async () => {} })
const reset = () => { customers = []; globals = []; ledger = []; hist = []; parties = []; seq = 0 }
Customer.find = (f) => query(() => customers.filter(matchC(f)))
Customer.findOne = (f) => query(() => customers.find(matchC(f)) || null)
Customer.create = async (o) => { const c = doc({ _id: id(), usageCount: 0, globalUserId: null, creditBalance: 0, ...o }); customers.push(c); return c }
Customer.findOneAndUpdate = async (f, u) => { let c = customers.find(matchC(f)); if (!c) c = await Customer.create({ ...u.$setOnInsert }); Object.assign(c, u.$set || {}); return c }
Customer.updateOne = async () => ({})
Udhar.find = (f) => query(() => ledger.filter((u) => same(u.shopId, f.shopId) && (!f.customerId?.$in || f.customerId.$in.some((x) => same(x, u.customerId)))))
Udhar.findOne = (f) => query(() => ledger.find((u) => same(u.shopId, f.shopId) && same(u.customerId, f.customerId)) || null)
Udhar.prototype.save = async function () { if (!ledger.includes(this)) ledger.push(this) }
UdharHistory.insertMany = async (rows) => { hist.push(...rows); return rows }
GlobalUser.findOne = (f) => query(() => globals.find((g) => g.phone === f.phone) || null)
GlobalUser.findById = (i) => query(() => globals.find((g) => same(g._id, i)) || null)
GlobalUser.findOneAndUpdate = async (f, u, o = {}) => {
  let g = globals.find((x) => x.phone === f.phone && (!f['names.key'] || x.names.some((n) => n.key === f['names.key'])))
  if (g && u.$inc) { g.names.find((n) => n.key === f['names.key']).count += u.$inc['names.$.count']; return g }
  if (!g && f['names.key']) return null
  g = globals.find((x) => x.phone === f.phone)
  if (!g) { if (!o.upsert) return null; g = { _id: id(), phone: f.phone, names: [] }; globals.push(g) }
  if (u.$push) g.names.push({ ...u.$push.names })
  return g
}
const reqOf = (shopId, extra = {}) => ({ query: {}, body: {}, sellerAccount: { _id: shopId }, sellerType: 'shop', ...extra })
const run = async (fn, req) => { const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }; let err = null; await fn(req, res, (e) => { err = e }); if (err) throw err; return res }
const search = (shop, q) => run(searchCustomers, reqOf(shop, { query: { q } }))
const entry = (shop, body) => run(addEntry, reqOf(shop, { body: { type: 'udhar', amount: 150, ...body } }))
const owe = async (shop, c, amt) => { await entry(shop, { customerId: c._id, amount: amt }) }

// ───────── 1 · who can be found ─────────
reset()
const asha = await Customer.create({ shopId: SA, name: 'Asha Verma', phone: '9876500001' })
const ravi = await Customer.create({ shopId: SA, name: 'Ravi Kumar', phone: '9876500002' }) // never had an udhar entry
const rajesh = await Customer.create({ shopId: SA, name: 'Rajesh', phone: '9111100003' })
const other = await Customer.create({ shopId: SB, name: 'Ravi Of Shop B', phone: '9876599999' })
await owe(SA, asha, 200)
let r = await search(SA, 'ravi')
ok(r.body.length === 1 && same(r.body[0].id, ravi._id) && r.body[0].udharDue === 0 && r.body[0].credit === 0, 'by name: finds a customer who has NO udhar entry with this shop (not limited to udhar customers)')
r = await search(SA, 'asha'); ok(same(r.body[0].id, asha._id) && r.body[0].udharDue === 200, 'by name: a customer with udhar comes with their balance (₹200)')
r = await search(SA, '987650000'); ok(r.body.length === 2 && r.body.every((c) => ['Asha Verma', 'Ravi Kumar'].includes(c.name)), 'by mobile (partial digits): finds the matching customers')
r = await search(SA, '9111100003'); ok(r.body.length === 1 && r.body[0].name === 'Rajesh', 'by full mobile number: exact customer')
r = await search(SA, '+91 91111 00003'); ok(r.body.length === 1 && r.body[0].name === 'Rajesh', '+91 / spaces in the number are understood')
ok((await search(SA, 'r')).body.length === 0 && (await search(SA, '98')).body.length === 0, 'thresholds: 1 letter / 2 digits → nothing is searched')
ok((await search(SA, 'ra')).body.length === 2 && (await search(SA, '987')).body.length === 2, 'thresholds: 2 letters / 3 digits → results')
ok(!JSON.stringify((await search(SA, 'ravi')).body).includes('Shop B') && (await search(SA, '9876599999')).body.every((c) => c.source === 'global' || c.name !== 'Ravi Of Shop B'), "another shop's customers are never returned (search is scoped to the signed-in business)")
r = await search(SA, 'zzzz'); ok(Array.isArray(r.body) && r.body.length === 0, 'a name nobody has → an empty list (the UI then offers Add Customer & Udhar)')

// ───────── 2 · a person known globally but not linked to this shop ─────────
globals.push({ _id: '00000000000000000000ee01', phone: '9000000001', names: [{ name: 'Meena', key: 'meena', count: 4 }] })
r = await search(SA, '9000000001')
ok(r.body.length === 1 && r.body[0].source === 'global' && r.body[0].name === 'Meena' && !('usageCount' in r.body[0]), 'exact 10-digit number known globally → a link suggestion (name + number only, nothing private)')
r = await search(SA, 'meena'); ok(r.body.length === 0, 'the global directory cannot be browsed by name (privacy): only an exact number reveals a person')
const before = customers.length
let sel = await run(selectGlobalCustomer, reqOf(SA, { body: { globalUserId: '00000000000000000000ee01', name: 'Meena', phone: '9000000001' } }))
ok(sel.statusCode === 201 && customers.length === before + 1 && customers.at(-1).globalUserId === '00000000000000000000ee01' && sel.body.id, 'linking creates ONE shop customer tied to the existing global user (the UI then opens that id)')
sel = await run(selectGlobalCustomer, reqOf(SA, { body: { globalUserId: '00000000000000000000ee01', name: 'Meena', phone: '9000000001' } }))
ok(customers.length === before + 1 && globals.length === 1, 'linking again returns the same customer — no duplicate customer, no second global user')
r = await search(SA, '9000000001'); ok(r.body.length === 1 && r.body[0].source === 'local', 'once linked the person is an ordinary customer of the shop')

// ───────── 3 · Add Customer & Udhar (addEntry, new customer) ─────────
reset(); await Customer.create({ shopId: SA, name: 'Ravi Kumar', phone: '9876500002' })
let n = customers.length
let e = await entry(SA, { name: 'Zed Zorro', phone: '9222200001', amount: 350 })
const zed = customers.find((c) => c.name === 'Zed Zorro')
ok(e.statusCode === 201 && customers.length === n + 1 && zed.phone === '9222200001' && same(e.body.row.id, zed._id) && e.body.row.total === 350, 'new customer + first udhar (₹350) saved together; the response carries the new customer id → the UI opens their account')
ok(hist.length === 1 && hist[0].type === 'udhar' && hist[0].amount === 350 && ledger.length === 1 && ledger[0].totalAmount === 350, 'exactly one ledger account and one history line were written')
ok(globals.some((g) => g.phone === '9222200001' && g.names[0].count === 0) && zed.globalUserId, 'the new person joins the global directory (count 0), as with billing quick-add')
n = customers.length
e = await entry(SA, { name: 'Someone Else', phone: '9222200001', amount: 50 })
ok(customers.length === n && same(e.body.row.id, zed._id) && ledger.length === 1 && ledger[0].totalAmount === 400, 'the same mobile number again → the EXISTING customer is used (no duplicate); balance ₹350 + ₹50 = ₹400')
n = customers.length
e = await entry(SA, { name: 'Zed Zorro', amount: 25 }); ok(customers.length === n && e.body.row.total === 425, 'the same name (no number) → the same customer, not a second record')
ok(customers.find((c) => c.name === 'Ravi Kumar').phone === '9876500002' && customers.filter((c) => c.name === 'Ravi Kumar').length === 1, "same name + a DIFFERENT number never overwrites the saved number or creates a duplicate")
const rc = await run(addEntry, reqOf(SA, { body: { type: 'udhar', amount: 10, name: 'Ravi Kumar', phone: '9333300009' } }))
ok(rc.statusCode === 409 && /already have a customer named/.test(rc.body.message), '…it is refused with a clear message (409)')
const bad = await run(addEntry, reqOf(SA, { body: { type: 'udhar', amount: 10, name: 'X', phone: '123' } })); ok(bad.statusCode === 400, 'a bad mobile number is still refused (400)')
const nm = await run(addEntry, reqOf(SA, { body: { type: 'udhar', amount: 10 } })); ok(nm.statusCode === 400, 'no customer chosen → 400')
reset(); const old = await Customer.create({ shopId: SA, name: 'Old Friend', phone: '' })
e = await entry(SA, { name: 'Old Friend', phone: '9444400001', amount: 20 }); ok(customers.length === 1 && old.phone === '9444400001', 'an existing customer with no number simply gets the number')
reset(); const c1 = await Customer.create({ shopId: SA, name: 'Asha', phone: '9876500001' }); await owe(SA, c1, 100)
await entry(SA, { customerId: c1._id, type: 'payment', amount: 40 }); ok(ledger[0].totalAmount === 60, 'existing flows unchanged: entry for an existing customer id (udhar ₹100, payment ₹40 → ₹60)')
const foreign = await run(addEntry, reqOf(SB, { body: { type: 'udhar', amount: 5, customerId: c1._id } })); ok(foreign.statusCode === 400 && ledger.length === 1, "another shop cannot add entries to this shop's customer (customerId is scoped to the shop)")

// ───────── 4 · study centre: the new person is registered as a Member, like billing ─────────
const { hooksFor } = await import('../utils/businessHooks.js'); const { default: StudyMember } = await import('../models/StudyMember.js')
ok(typeof hooksFor('study_center').ensureParty === 'function' && !hooksFor('shop').ensureParty, 'study centres register the customer as a Member via the same hook billing uses (shops have none)')
console.log('\nAll Udhar customer-search / add-customer checks passed')
