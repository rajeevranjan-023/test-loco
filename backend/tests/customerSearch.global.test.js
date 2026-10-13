// Billing customer search → global-directory suggestion → select → create new → counts.
// Runs the REAL controllers (searchCustomers · selectGlobalCustomer · addCustomer) and the REAL touchGlobalUser against small
// in-memory stand-ins for the Mongoose models, so it needs no database:   node tests/customerSearch.global.test.js
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'test-secret'
const { default: Customer } = await import('../models/Customer.js')
const { default: GlobalUser } = await import('../models/GlobalUser.js')
const { default: Udhar } = await import('../models/Udhar.js')
const { searchCustomers, selectGlobalCustomer, addCustomer } = await import('../controllers/billingController.js')
const { touchGlobalUser, totalUses, mostUsedName } = await import('../utils/globalUser.js')

const ok = (c, m) => { assert.ok(c, m); console.log('✅', m) }

// ───────── in-memory stand-ins ─────────
let customers, globals, ledger, calls, seq
const reset = () => { customers = []; globals = []; ledger = []; seq = 0; calls = { globalFind: 0, globalCreate: 0 } }
const id = (p) => `${p}${++seq}`
const same = (a, b) => String(a) === String(b)
const query = (get) => { const run = async () => get(); const q = { then: (a, b) => run().then(a, b), catch: (f) => run().catch(f), lean: () => run(), limit: () => q, select: () => q }; return q }
const matchC = (f) => (c) => (f.shopId === undefined || same(c.shopId, f.shopId)) && (f.phone === undefined || (f.phone instanceof RegExp ? f.phone.test(c.phone) : c.phone === f.phone)) && (f.name === undefined || (f.name instanceof RegExp ? f.name.test(c.name) : c.name === f.name))
const doc = (o) => Object.assign(o, { save: async () => {} })

Customer.find = (f) => query(() => customers.filter(matchC(f)))
Customer.findOne = (f) => query(() => customers.find(matchC(f)) || null)
Customer.create = async (o) => { const c = doc({ _id: id('c'), usageCount: 0, globalUserId: null, creditBalance: 0, ...o }); customers.push(c); return c }
Customer.findOneAndUpdate = async (f, u) => { let c = customers.find(matchC(f)); if (!c) c = await Customer.create({ ...u.$setOnInsert }); Object.assign(c, u.$set || {}); return c }
Udhar.find = () => query(() => ledger)
GlobalUser.findOne = (f) => query(() => { calls.globalFind++; return globals.find((g) => g.phone === f.phone) || null })
GlobalUser.findById = (i) => query(() => globals.find((g) => same(g._id, i)) || null)
GlobalUser.findOneAndUpdate = async (f, u, o = {}) => { // exactly the two shapes touchGlobalUser uses
  let g = globals.find((x) => x.phone === f.phone && (!f['names.key'] || x.names.some((n) => n.key === f['names.key'])))
  if (g && u.$inc) { const n = g.names.find((n) => n.key === f['names.key']); n.count += u.$inc['names.$.count']; return g }
  if (!g && f['names.key']) return null
  g = globals.find((x) => x.phone === f.phone)
  if (!g) { if (!o.upsert) return null; g = { _id: id('g'), phone: f.phone, names: [] }; globals.push(g); calls.globalCreate++ }
  if (u.$push) g.names.push({ ...u.$push.names })
  return g
}

const reqOf = (shopId, extra = {}) => ({ query: {}, body: {}, sellerAccount: { _id: shopId }, sellerType: 'shop', ...extra })
const run = async (fn, req) => { const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }; await fn(req, res, (e) => { throw e }); return res }
const search = (shop, q) => run(searchCustomers, reqOf(shop, { query: { q } }))
const P = '9876543210'
const seedGlobal = () => { globals.push({ _id: 'g-ravi', phone: P, names: [{ name: 'Ravi', key: 'ravi', count: 7 }, { name: 'Ravinder', key: 'ravinder', count: 1 }] }) }
const snap = () => JSON.stringify(globals)

// ───────── 1 · search: shop first, then global — name only ─────────
reset(); seedGlobal()
let before = snap()
let r = await search('shopA', P)
ok(r.body.length === 1 && r.body[0].source === 'global' && r.body[0].name === 'Ravi', 'number unknown to the shop → the global user appears as a suggestion, under their most-used name')
ok(JSON.stringify(Object.keys(r.body[0]).sort()) === JSON.stringify(['exact', 'globalUserId', 'name', 'phone', 'source']), 'the suggestion carries only: name, the id the existing select endpoint needs, the number that was typed — no usage count, no other names, no balances')
ok(!JSON.stringify(r.body).includes('Ravinder') && !('usageCount' in r.body[0]), 'other names / usage counts of the global user are not exposed')
await search('shopA', P); await search('shopB', P)
ok(snap() === before, 'searching (even repeatedly, from several shops) never changes the global user or its counts')
ok(globals.length === 1 && calls.globalCreate === 0, 'searching never creates a global user')

// ───────── 2 · the shop's own customer wins; no global lookup at all ─────────
reset(); seedGlobal()
await Customer.create({ shopId: 'shopA', name: 'Asha', phone: P, usageCount: 3 })
r = await search('shopA', P)
ok(r.body.length === 1 && r.body[0].source === 'local' && r.body[0].name === 'Asha' && r.body[0].usageCount === 3, 'shop already has the number → only its own customer is returned, with its details')
ok(calls.globalFind === 0, 'the global directory is not even queried when the shop already has the number')

// ───────── 3 · fallback only for a COMPLETE number; names / partial numbers never touch the global directory ─────────
reset(); seedGlobal()
await search('shopA', '98765'); await search('shopA', 'Ravi'); await search('shopA', '+91 98765')
ok(calls.globalFind === 0, 'name search and partial numbers never query the global directory (existing behaviour kept)')
r = await search('shopA', '+91 98765 43210')
ok(r.body.length === 1 && r.body[0].source === 'global' && r.body[0].phone === P, '“+91 98765 43210” is normalised to the 10-digit number before the fallback')
r = await search('shopA', '9'); ok(r.body.length === 0, 'search threshold unchanged: 1 digit → nothing')
r = await search('shopA', 'R'); ok(r.body.length === 0, 'search threshold unchanged: 1 letter → nothing')
reset(); r = await search('shopA', P); ok(r.body.length === 0, 'number unknown everywhere → empty result (the seller just creates the customer)')
reset(); for (let i = 0; i < 8; i++) await Customer.create({ shopId: 'shopA', name: `Ravi ${i}`, phone: `98000000${i}0` })
r = await search('shopA', 'Ravi'); ok(r.body.length === 5, 'maximum suggestion count unchanged (5)')

// ───────── 4 · selecting the global suggestion ─────────
reset(); seedGlobal(); before = snap()
r = await run(selectGlobalCustomer, reqOf('shopA', { body: { globalUserId: 'g-ravi', name: 'Ravi', phone: P } }))
ok(r.statusCode === 201 && r.body.source === 'local' && r.body.name === 'Ravi' && r.body.phone === P && r.body.globalUserId === 'g-ravi', 'selecting links a new customer of THIS shop to the existing global user')
ok(customers.length === 1 && customers[0].usageCount === totalUses(globals[0]), 'existing rule kept: the shop customer starts from the global total')
ok(snap() === before && globals.length === 1 && calls.globalCreate === 0, 'selecting changes nothing on the global user and creates no duplicate global user')
const again = await run(selectGlobalCustomer, reqOf('shopA', { body: { globalUserId: 'g-ravi', name: 'Ravi', phone: P } }))
ok(customers.length === 1 && again.body.id === customers[0]._id, 'selecting it again returns the same customer — no duplicate customer')
r = await run(selectGlobalCustomer, reqOf('shopB', { body: { globalUserId: 'g-ravi', name: 'Ravi', phone: '9000000000' } }))
ok(r.statusCode === 400 && customers.length === 1, 'an id/number pair that does not match is refused')
await Customer.create({ shopId: 'shopC', name: 'Ravi', phone: '9111111111' })
r = await run(selectGlobalCustomer, reqOf('shopC', { body: { globalUserId: 'g-ravi', name: 'Ravi', phone: P } }))
ok(r.statusCode === 409 && /Change the name/.test(r.body.message), 'the shop already has another “Ravi” → 409 so the seller can change the name (the UI opens the confirm form)')

// ───────── 5 · ignoring the suggestion: new customer, custom name, counts ─────────
reset(); seedGlobal(); before = snap()
r = await run(addCustomer, reqOf('shopA', { body: { name: 'Ravi Kumar', phone: P } }))
ok(r.statusCode === 201 && r.body.name === 'Ravi Kumar' && customers.length === 1 && customers[0].globalUserId === 'g-ravi', 'new customer saved through the existing flow, linked to the SAME global user (found by number)')
ok(globals.length === 1 && calls.globalCreate === 0, 'no duplicate global user')
const g = globals[0]
ok(g.names.find((n) => n.key === 'ravi').count === 7 && g.names.find((n) => n.key === 'ravinder').count === 1, 'the suggested name’s count (and the others) did not move just because it appeared in search results / a new name was typed')
ok(g.names.find((n) => n.key === 'ravi kumar')?.count === 0 && totalUses(g) === 8, 'the new name is registered with count 0 — nothing is counted until a bill exists')
ok(mostUsedName(g) === 'Ravi', 'the suggestion name does not change by creating a customer')
// what salesController does after a real bill is saved:  touchGlobalUser(cust.phone, cust.name)
await touchGlobalUser(customers[0].phone, customers[0].name)
ok(globals[0].names.find((n) => n.key === 'ravi kumar').count === 1 && globals[0].names.find((n) => n.key === 'ravi').count === 7 && totalUses(globals[0]) === 9, 'the first bill counts once, on the name that was billed — the global suggestion’s own name stays at 7')
await run(addCustomer, reqOf('shopB', { body: { name: 'Ravi', phone: P } }))
ok(globals[0].names.find((n) => n.key === 'ravi').count === 7, 'creating a customer with the SAME name as the suggestion does not bump its count either (only a bill does)')

// ───────── 6 · brand-new number → one global user, count 0 ─────────
reset()
await run(addCustomer, reqOf('shopA', { body: { name: 'Meena', phone: '9123456780' } }))
await run(addCustomer, reqOf('shopA', { body: { name: 'Meena', phone: '9123456780' } }))
ok(customers.length === 1, 'quick-add twice with the same name → still one customer (no duplicate)')
ok(globals.length === 1 && calls.globalCreate === 1 && totalUses(globals[0]) === 0, 'a new number creates exactly one global user, counted 0 until a bill')
r = await run(addCustomer, reqOf('shopA', { body: { name: 'Bad', phone: '123' } })); ok(r.statusCode === 400, 'invalid number still refused')

console.log('\nAll customer-search / global-user checks passed')
