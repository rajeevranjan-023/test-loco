// Billing Items (study centre) — the REAL config controllers + the REAL recordSale gate, with fake req/res and in-memory "accounts" (no database).
//   node tests/billing.items.test.js
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'
const { getBillingConfig, updateBillingConfig } = await import('../controllers/billingController.js')
const { recordSale } = await import('../controllers/salesController.js')
const ok = (m) => console.log('✅', m)

// a centre account the way Mongoose hands it to the controller: has .billing, .save(), .markModified()
const centre = (name) => ({ _id: name, centerName: name, billing: undefined, saved: 0, markModified() {}, async save() { this.saved++ } })
const A = centre('A'), B = centre('B')
const run = async (handler, account, body = {}, sellerType = 'study_center') => {
  let out = { status: 200, body: null }
  const res = { status(c) { out.status = c; return this }, json(b) { out.body = b; return this } }
  await Promise.race([handler({ sellerAccount: account, sellerType, body, query: {}, user: { _id: 'u' } }, res, (e) => { out.error = e }), new Promise((r) => setTimeout(r, 400))])
  return out
}
const put = (acc, body) => run(updateBillingConfig, acc, body)
const get = (acc) => run(getBillingConfig, acc)
const KEYS = ['membership', 'books', 'courses', 'fines', 'otherCharges', 'registration', 'seatFees']
const types = (o) => o.body.lineTypes.map((l) => l.type)

// 1 ─ all seven are on for a new centre, in the Billing-page order, with the right "+ Add …" labels
{
  const g = await get(A)
  for (const k of KEYS) assert.equal(g.body.capabilities[k], true, k)
  assert.deepEqual(types(g), ['membership', 'book', 'course', 'fine', 'other', 'registration', 'seat'])
  assert.deepEqual(g.body.lineTypes.map((l) => l.addLabel), ['Add Membership', 'Add Book/Material', 'Add Course Fee', 'Add Fine', 'Add Other Charge', 'Add Registration', 'Add Seat Fee'])
  ok('all seven items are on by default and listed in Billing order with their "Add …" labels')
}
// 2 ─ each one switches independently (config API → buttons list)
for (const [k, type] of [['membership', 'membership'], ['books', 'book'], ['courses', 'course'], ['fines', 'fine'], ['otherCharges', 'other'], ['registration', 'registration'], ['seatFees', 'seat']]) {
  const off = await put(A, { [k]: false })
  assert.equal(off.status, 200); assert.equal(off.body.capabilities[k], false); assert.ok(!types(off).includes(type)); assert.equal(types(off).length, 6)
  for (const o of KEYS) if (o !== k) assert.equal(off.body.capabilities[o], true, `${k} off must not touch ${o}`)
  const back = await put(A, { [k]: true }); assert.ok(types(back).includes(type)); assert.equal(types(back).length, 7)
}
ok('each of the seven switches off and on on its own; the other six never move')

// 3 ─ saved on the account (persists) and independent per centre
{
  await put(A, { fines: false, seatFees: false })
  assert.equal(A.billing.capabilities.fines, false); assert.ok(A.saved > 0, 'save() was called')   // what a refresh / re-login reads back
  assert.deepEqual(types(await get(A)), ['membership', 'book', 'course', 'other', 'registration'])
  assert.equal(B.billing, undefined, 'centre B untouched'); assert.deepEqual(types(await get(B)), ['membership', 'book', 'course', 'fine', 'other', 'registration', 'seat'])
  await put(B, { membership: false }); assert.ok(types(await get(A)).includes('membership')); assert.ok(!types(await get(B)).includes('membership'))
  ok('flags live on each centre\'s own account: A\'s changes never reach B and vice-versa; save() persists them')
}
// 4 ─ junk in the PUT cannot invent flags or flip non-booleans
{
  const r = await put(A, { fines: 'no', bogus: true, seatFees: true })
  assert.equal(r.body.capabilities.fines, false, 'a non-boolean is ignored'); assert.equal(r.body.capabilities.bogus, undefined); assert.equal(r.body.capabilities.seatFees, true)
  ok('only known boolean flags are accepted by the config API')
}
// 5 ─ a disabled item type is refused by the real sales API (direct request, no UI involved); nothing is created
{
  const sale = (type, acc) => run(recordSale, acc, { items: [{ type, name: 'x', rate: 100, quantity: 1 }], paymentMode: 'full', paymentMethod: 'cash' })
  await put(A, { fines: false, courses: false, books: false, otherCharges: false, registration: false, seatFees: false, membership: true })
  for (const [type, label] of [['fine', 'Fine'], ['course', 'Course Fee'], ['book', 'Book / Material'], ['other', 'Other Charge'], ['registration', 'Registration Fee'], ['seat', 'Seat Fee']]) {
    const r = await sale(type, A)
    assert.equal(r.status, 400, type); assert.match(r.body.message, new RegExp(`${label.replace(/[/]/g, '.')} billing is not enabled`))
  }
  ok('POST /api/seller/sales with a disabled item type → 400 "<item> billing is not enabled for this business" (all six checked)')
  // an enabled type is NOT stopped by the gate (it goes on to the database, which this test has none of — so it must not answer 400 "not enabled")
  const pass = await sale('membership', A)
  assert.ok(!(pass.status === 400 && /not enabled/.test(pass.body?.message || '')), 'enabled item passes the gate')
  // the other centre (everything still on except membership) still accepts a Fine
  const b = await sale('fine', B); assert.ok(!(b.status === 400 && /not enabled/.test(b.body?.message || '')))
  ok('an enabled type passes the gate, and the same type on another centre is unaffected')
}
// 6 ─ switching everything off never leaves a centre unable to bill
{
  const C = centre('C'); await put(C, Object.fromEntries(KEYS.map((k) => [k, false])))
  assert.ok(types(await get(C)).length > 0, 'falls back to the defaults instead of an empty billing screen')
  ok('all items off → the server falls back to defaults (the Settings screen also refuses to switch off the last one)')
}
console.log('\nAll billing-items backend tests passed'); process.exit(0)
