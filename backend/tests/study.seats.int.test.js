// Study-centre Billing: switchable Billing Items · the two seat rules (time-based) · seat-number search · membership & seat renewal.
// Runs against a real MongoDB-compatible server (disposable local DB only). Every ✅ below is an assertion that actually executed.
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'test-secret'
const { default: app } = await import('../server.js')
const { default: mongoose } = await import('mongoose')
const { connectDB } = await import('../config/db.js')
const { default: BillCounter } = await import('../models/BillCounter.js')
const { default: Membership } = await import('../models/Membership.js')
const { default: SeatAssignment } = await import('../models/SeatAssignment.js')
const { default: Bill } = await import('../models/Bill.js')
{ const { assertDisposableDb } = await import('./_safeDb.js'); assertDisposableDb(process.env.MONGODB_URI, 'study.seats.int') }
await connectDB(); await mongoose.connection.dropDatabase()
{ const { default: AssignmentLock } = await import('../models/AssignmentLock.js'); await AssignmentLock.syncIndexes() } // the drop above also dropped the unique index the lock depends on — rebuild it (production never drops the DB)
let n = 0; BillCounter.findOneAndUpdate = async () => ({ series: 'A', count: 101 + n++ }) // stub (needs real MongoDB ≥4.2 otherwise)
{ // test-DB limitation (FerretDB cannot project inside findAndModify; real MongoDB can): ignore that projection for the pre-existing member-counter call
  const { default: SC } = await import('../models/StudyCenter.js'); const orig = SC.findOneAndUpdate
  SC.findOneAndUpdate = function (...a) { const q = orig.apply(this, a); q.select = () => q; return q }
}
const server = app.listen(0); const base = `http://localhost:${server.address().port}`
const req = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let data = null; try { data = await r.json() } catch {}; return { status: r.status, data }
}
const ok = (c, m) => { if (!c) console.log('LAST RESPONSE:', JSON.stringify(typeof r === 'undefined' ? null : r).slice(0, 700)); assert.ok(c, m); console.log('✅', m) }
const DAY = 864e5

// ───────── two study centres ─────────
const reg = async (name, email) => (await req('POST', '/api/auth/register', { name, email, password: 'password123' })).data.token
const TA = await reg('Owner A', 'a@example.com'), TB = await reg('Owner B', 'b@example.com')
for (const [t, u, nm] of [[TA, '@centera1', 'Alpha Library'], [TB, '@centerb1', 'Beta Library']]) {
  const r = await req('POST', '/api/seller/start', { username: u, sellerType: 'study_center', centerName: nm, ownerName: 'Owner', phone: '9876500001', address: 'Main road' }, t)
  assert.equal(r.status, 201, JSON.stringify(r.data))
}
for (const t of [TA, TB]) assert.equal((await req('POST', '/api/seller/study/seats', { naming: { mode: 'grid', rows: 2, perRow: 12 } }, t)).status, 201)
const catalog = async (t) => (await req('GET', '/api/seller/study/billing/catalog', null, t)).data
const seatId = async (t, name) => (await catalog(t)).seats.find((s) => s.name === name).id
const A12 = await seatId(TA, 'A12'), A11 = await seatId(TA, 'A11'), A10 = await seatId(TA, 'A10'), B1 = await seatId(TA, 'B1')
const B_A12 = await seatId(TB, 'A12')

let phone = 9100000000
const people = {}
const member = (name) => (people[name] ||= { name, phone: String(phone++) })
const T = (id) => ({ start: id.split('-')[0], end: id.split('-')[1] })
const memLine = (seat, slot, extra = {}, planKey = '1m', rate = 1000) => ({ type: 'membership', name: planKey === '1m' ? '1 Month' : planKey, quantity: 1, rate, meta: { planKey, ...(seat ? { seatId: seat } : {}), ...(slot ? { slot: T(slot) } : {}), ...extra } })
const bill = (tok, who, items, extra = {}) => req('POST', '/api/seller/sales', { paymentMode: 'full', paymentMethod: 'cash', customerName: member(who).name, customerPhone: member(who).phone, items, ...extra }, tok)
const holds = async (centerTok, seat) => (await catalog(centerTok)).seats.find((s) => s.id === seat).busy
const activeCount = (q) => SeatAssignment.countDocuments({ releasedAt: null, ...q })
const memberDoc = async (tok, who) => { const l = (await req('GET', `/api/seller/study/members?q=${encodeURIComponent(who)}`, null, tok)).data; return (l.members || l).find((m) => m.name === who) }

// ═════════ FEATURE 1 — Billing Items (settings) ═════════
let r = await req('GET', '/api/seller/billing/config', null, TA)
ok(r.data.billingItems?.map((i) => i.label).join('|') === 'Membership|Book / Material|Course Fee|Fine|Other Charge|Registration|Seat Fee', 'Settings lists all 7 Billing Items in the documented order')
const enabledNow = (d) => d.lineTypes.map((t) => t.type).sort().join(',')
const defaults = enabledNow(r.data)
ok(r.data.billingItems.every((i) => typeof i.enabled === 'boolean'), 'each Billing Item has its own enabled switch')
// 1) enable only Membership, Seat Fee and Fine
r = await req('PUT', '/api/seller/billing/config', { membership: true, seatFees: true, fines: true, courses: false, books: false, registration: false, otherCharges: false }, TA)
assert.equal(r.status, 200, JSON.stringify(r.data))
r = await req('GET', '/api/seller/billing/config', null, TA)
ok(enabledNow(r.data) === 'fine,membership,seat', 'only Membership, Seat Fee and Fine are offered under “Add Item”')
// 2) persists (a fresh request = a page refresh; also verified straight from the database)
r = await req('GET', '/api/seller/billing/config', null, TA); ok(enabledNow(r.data) === 'fine,membership,seat', 'setting survives a refresh (fresh request)')
const { default: StudyCenter } = await import('../models/StudyCenter.js')
const dbA = await StudyCenter.findOne({ username: '@centera1' }).lean()
ok(dbA.billing?.capabilities?.membership === true && dbA.billing?.capabilities?.books === false, 'persisted in the database on the centre record')
// 3) other centre untouched
r = await req('GET', '/api/seller/billing/config', null, TB); ok(enabledNow(r.data) === defaults, 'a different centre keeps its own (default) items — settings are per centre')
// 4) disabled items are refused by the BACKEND
r = await bill(TA, 'Rahul', [{ type: 'book', name: 'Novel', quantity: 1, rate: 50 }]); ok(r.status === 400 && /not enabled/i.test(r.data.message), 'Book / Material refused by the server while disabled')
r = await bill(TA, 'Rahul', [{ type: 'course', name: 'Maths', quantity: 1, rate: 500 }]); ok(r.status === 400, 'Course Fee refused by the server while disabled')
r = await bill(TA, 'Rahul', [{ type: 'registration', name: 'Registration Fee', quantity: 1, rate: 200 }]); ok(r.status === 400, 'Registration refused by the server while disabled')
r = await bill(TA, 'Rahul', [{ type: 'other', name: 'Misc', quantity: 1, rate: 10 }]); ok(r.status === 400, 'Other Charge refused by the server while disabled')
// ...while enabled ones still bill, and history is never touched
r = await bill(TA, 'Rahul', [{ type: 'fine', name: 'Late Fee', quantity: 1, rate: 50 }]); ok(r.status === 201 && r.data.bill.totalAmount === 50, 'an enabled item (Fine) still bills normally')
const fineBill = r.data.billId
// everything off is honoured (no silent re-enable) and the page can say so
r = await req('PUT', '/api/seller/billing/config', { membership: false, seatFees: false, fines: false }, TA)
r = await req('GET', '/api/seller/billing/config', null, TA); ok(r.data.lineTypes.length === 0, 'all items off → nothing is offered (no hidden fallback)')
r = await req('GET', `/api/seller/billing/bills/${fineBill}`, null, TA); ok(r.status === 200 && r.data.lines.length === 1 && r.data.lines[0].type === 'fine' && r.data.total === 50, 'disabling an item keeps the historical bill and its line items')
r = await req('PUT', '/api/seller/billing/config', { membership: true, seatFees: true, fines: true, courses: true, books: true, registration: true, otherCharges: true }, TA)
r = await req('GET', '/api/seller/billing/config', null, TA); ok(enabledNow(r.data).split(',').length === 7, 'all 7 can be switched back on')

// ═════════ FEATURE 2 — seat rules (time-based) ═════════
// Rule 2: one seat, several members, NON-overlapping slots (end exclusive)
r = await bill(TA, 'Anita', [memLine(A12, '06:00-12:00')]); ok(r.status === 201, `Anita → A12 06:00–12:00 · ${JSON.stringify(r.data).slice(0, 0)}accepted`)
if (r.status !== 201) console.log(r.data)
r = await bill(TA, 'Bharat', [memLine(A12, '12:00-18:00')]); ok(r.status === 201, 'Bharat → A12 12:00–18:00 accepted (touching boundary is fine: end is exclusive)')
r = await bill(TA, 'Chitra', [memLine(A12, '18:00-22:00')]); ok(r.status === 201, 'Chitra → A12 18:00–22:00 accepted (three members share one seat in different slots)')
ok((await activeCount({ seatId: A12 })) === 3, 'database holds 3 active assignments on seat A12')
const billsBefore = await Bill.countDocuments({}), msBefore = await Membership.countDocuments({})
r = await bill(TA, 'Deepak', [memLine(A12, '10:00-14:00')])
ok(r.status === 409 && r.data.code === 'SEAT_SLOT_CONFLICT' && r.data.message === 'This seat is already assigned to another member during the selected time slot. Please select another seat or time slot.', 'overlapping slot (10:00–14:00) refused with the exact required message + code')
ok((await Bill.countDocuments({})) === billsBefore && (await Membership.countDocuments({})) === msBefore, 'a refused assignment leaves no bill and no half-made membership')
r = await bill(TA, 'Deepak', [memLine(A12, '11:59-12:01')]); ok(r.status === 409, 'even a 2-minute overlap is refused')
r = await bill(TA, 'Deepak', [memLine(A12)]); ok(r.status === 409 && r.data.code === 'SEAT_SLOT_CONFLICT', 'a full-day booking of a seat that others use part-time is refused')
// other centre's seat with the same name is independent
r = await bill(TB, 'Esha', [memLine(B_A12, '06:00-12:00')]); ok(r.status === 201, 'another centre can use its own “A12” at the same time (centres are independent)')
// Rule 1: one active seat per member
r = await bill(TA, 'Anita', [memLine(A11, '06:00-12:00')]); ok(r.status === 409 && r.data.code === 'MEMBER_HAS_SEAT' && r.data.message === 'This member already has an active seat assigned. Please remove or change the existing assignment before assigning another seat.', 'a member who has a seat cannot silently get a second one (exact message + code)')
ok((await activeCount({ customerId: (await memberDoc(TA, 'Anita')).customerId })) === 1, 'Anita still has exactly one active seat')
r = await bill(TA, 'Anita', [memLine(A12, '06:00-12:00')]); ok(r.status === 201, 'renewing the SAME seat/slot is allowed')
ok((await activeCount({ seatId: A12 })) === 3, 'renewal created no second assignment (still 3 on A12)')
// explicit change = move (old one released, never two active)
const anitaAssign = await SeatAssignment.findOne({ seatId: A12, releasedAt: null, 'slot.start': '06:00' }).lean()
r = await bill(TA, 'Anita', [memLine(A11, '06:00-12:00', { replaceAssignmentId: String(anitaAssign._id) })]); ok(r.status === 201, 'an explicit “change seat” moves the member to A11')
const aniActive = await SeatAssignment.find({ releasedAt: null, customerId: (await memberDoc(TA, 'Anita')).customerId }).lean()
ok(aniActive.length === 1 && String(aniActive[0].seatId) === A11, 'Anita now holds exactly one active seat (A11); the old assignment is released, not deleted')
ok((await SeatAssignment.countDocuments({ _id: anitaAssign._id, releasedBy: 'reassigned' })) === 1, 'old assignment kept as history (releasedBy reassigned)')
ok((await holds(TA, A12)).length === 2, 'A12 freed Anita’s 06:00–12:00 slot — only Bharat and Chitra remain on it')
// a change into an occupied slot is refused AND changes nothing
const bharat = await SeatAssignment.findOne({ seatId: A12, releasedAt: null, 'slot.start': '12:00' }).lean()
r = await bill(TA, 'Bharat', [memLine(A11, '08:00-10:00', { replaceAssignmentId: String(bharat._id) })]); ok(r.status === 409 && r.data.code === 'SEAT_SLOT_CONFLICT', 'a change into a slot taken by someone else is refused')
ok((await SeatAssignment.countDocuments({ _id: bharat._id, releasedAt: null })) === 1, 'the refused change left Bharat on his original seat')
// Seat Fee line follows the same rules
r = await bill(TA, 'Farah', [{ type: 'seat', name: 'Seat Fee', quantity: 1, rate: 300, meta: { seatId: A10, slot: T('06:00-12:00') } }]); ok(r.status === 201, 'Seat Fee with a seat books it for a member with no seat')
r = await bill(TA, 'Gopal', [{ type: 'seat', name: 'Seat Fee', quantity: 1, rate: 300, meta: { seatId: A10, slot: T('09:00-11:00') } }]); ok(r.status === 409 && r.data.code === 'SEAT_SLOT_CONFLICT', 'Seat Fee obeys the time-overlap rule')
r = await bill(TA, 'Farah', [{ type: 'seat', name: 'Seat Fee', quantity: 1, rate: 300, meta: { seatId: B1, slot: T('06:00-12:00') } }]); ok(r.status === 409 && r.data.code === 'MEMBER_HAS_SEAT', 'Seat Fee obeys the one-seat-per-member rule')
r = await bill(TA, 'Farah', [memLine(A10, '06:00-12:00'), { type: 'seat', name: 'Seat Fee', quantity: 1, rate: 100, meta: { seatId: B1, slot: T('06:00-12:00') } }]); ok(r.status === 409, 'two different seats on one bill are refused')

// concurrency: many simultaneous requests for the same seat/slot → exactly one wins
const race = await Promise.all(['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((w) => bill(TA, w, [memLine(B1, '06:00-10:00')])))
const won = race.filter((x) => x.status === 201), lost = race.filter((x) => x.status === 409)
ok(won.length === 1 && lost.length === 5, `6 simultaneous requests for one seat/slot → exactly 1 accepted, 5 refused (${won.length}/${lost.length})`)
ok(lost.every((x) => x.data.code === 'SEAT_SLOT_CONFLICT'), 'every loser got the seat-conflict message')
ok((await activeCount({ seatId: B1 })) === 1, 'database has exactly ONE active assignment for B1 (no duplicate)')
// …and the same MEMBER asking for two different seats at once
const A9 = await seatId(TA, 'A9'), A8 = await seatId(TA, 'A8')
const race2 = await Promise.all([bill(TA, 'Hari', [memLine(A9, '06:00-12:00')]), bill(TA, 'Hari', [memLine(A8, '06:00-12:00')])])
ok(race2.filter((x) => x.status === 201).length === 1 && race2.filter((x) => x.status === 409).length === 1, 'one member asking for two seats simultaneously gets exactly one')
ok((await activeCount({ customerId: (await memberDoc(TA, 'Hari')).customerId })) === 1, 'Hari has exactly one active seat in the database')
// non-overlapping requests at the same instant all succeed (sharing still works under load)
const A7 = await seatId(TA, 'A7')
const race3 = await Promise.all([['06:00-10:00'], ['10:00-14:00'], ['14:00-18:00'], ['18:00-22:00']].map(([s], i) => bill(TA, `S${i}`, [memLine(A7, s)])))
ok(race3.every((x) => x.status === 201), 'four simultaneous NON-overlapping slots on one seat all succeed')
// Seats-page flows enforce the same rules
const hariId = (await memberDoc(TA, 'Hari')).id || (await memberDoc(TA, 'Hari'))._id
r = await req('POST', `/api/seller/study/seats/${A8}/assign`, { memberId: hariId, slot: T('06:00-12:00') }, TA); ok(r.status === 409 && r.data.code === 'MEMBER_HAS_SEAT', 'Seats page: assigning a second seat to a member is refused')
const gopal = (await bill(TA, 'Gopal', [{ type: 'fine', name: 'Late Fee', quantity: 1, rate: 10 }])).data
const gopalId = (await memberDoc(TA, 'Gopal')).id || (await memberDoc(TA, 'Gopal'))._id
r = await req('POST', `/api/seller/study/seats/${A12}/assign`, { memberId: gopalId, slot: T('11:00-13:00') }, TA); ok(r.status === 409 && r.data.code === 'SEAT_SLOT_CONFLICT', 'Seats page: overlapping assignment is refused')
// legacy conflicts are REPORTED, never auto-changed
await SeatAssignment.create({ centerId: dbA._id, seatId: A12, memberId: gopalId, customerId: (await memberDoc(TA, 'Gopal')).customerId, slot: { start: '12:00', end: '15:00', fullDay: false, label: 'x' }, startedAt: new Date() }) // simulate old data that breaks the rules
r = await req('GET', '/api/seller/study/seat-conflicts', null, TA)
ok(r.status === 200 && r.data.ok === false && r.data.overlappingSeatAssignments.length >= 1, 'pre-existing overlapping data is reported by the conflict report')
const before = await SeatAssignment.countDocuments({ releasedAt: null })
await req('GET', '/api/seller/study/seat-conflicts', null, TA)
ok((await SeatAssignment.countDocuments({ releasedAt: null })) === before, 'the report changed nothing (no automatic release)')
await SeatAssignment.deleteMany({ memberId: gopalId })

// ═════════ FEATURE 3 — search by seat number ═════════
const search = async (t, q) => (await req('GET', `/api/customers/search?q=${encodeURIComponent(q)}`, null, t)).data
let s1 = await search(TA, 'Chitra'); ok(s1.some((x) => x.name === 'Chitra') && s1[0].memberCode, 'search by name finds the member (with member ID)')
s1 = await search(TA, member('Chitra').phone); ok(s1.some((x) => x.name === 'Chitra'), 'search by mobile number finds the member')
s1 = await search(TA, 'A12'); ok(s1.map((x) => x.name).sort().join() === 'Bharat,Chitra' && s1.every((x) => x.matchedSeat?.seat === 'A12' && x.matchedSeat.slot), 'search “A12” returns the ACTIVE holders of A12 with their slots (shared seat → both members)')
s1 = await search(TA, 'a11'); ok(s1.length === 1 && s1[0].name === 'Anita', 'seat search is case-insensitive and follows the move (A11 → Anita)')
s1 = await search(TA, 'A5'); ok(s1.length === 1 && s1[0].empty === true && s1[0].message === 'No active member assigned to this seat.' && !s1[0]._id && !s1[0].id, 'unoccupied seat → one non-selectable “No active member assigned to this seat.” row')
s1 = await search(TA, 'Z99'); ok(s1.length === 0, 'unknown seat number matches nothing (no unrelated member selected)')
s1 = await search(TB, 'A12'); ok(s1.length === 1 && s1[0].name === 'Esha', 'centre B’s “A12” search sees only centre B’s member')
s1 = await search(TB, 'B1'); ok(s1.length === 1 && s1[0].empty === true, 'centre B cannot see centre A’s holder of B1 (isolation)')
ok(!JSON.stringify(await search(TB, 'Chitra')).includes('Chitra'), 'centre B cannot find centre A’s members by name either')
await req('POST', `/api/seller/study/assignments/${(await SeatAssignment.findOne({ seatId: A10, releasedAt: null }))._id}/release`, {}, TA)
s1 = await search(TA, 'A10'); ok(s1.length === 1 && s1[0].empty === true, 'a released seat no longer returns its old member')

// ═════════ FEATURE 4 — renewal ═════════
const statusOf = async (t, who) => (await req('GET', `/api/seller/study/members/${(await memberDoc(t, who)).id || (await memberDoc(t, who))._id}/billing-status`, null, t)).data
let st = await statusOf(TA, 'Bharat')
ok(st.membership && st.membership.expired === false && st.seat?.name === 'A12' && st.renewal?.renewsId, 'billing-status shows Bharat: running membership, seat A12, and a renewal offer')
// A) renew an EXPIRED membership
const bharatMs = await Membership.findOne({ memberId: st.memberId }).sort({ endDate: -1 })
const oldEnd = new Date(Date.now() - 10 * DAY)
await Membership.updateOne({ _id: bharatMs._id }, { $set: { startDate: new Date(+oldEnd - 30 * DAY), endDate: oldEnd } })
st = await statusOf(TA, 'Bharat'); ok(st.membership.expired === true && st.seat?.name === 'A12', 'expired membership is reported as expired; seat is STILL held (expiry does not free a seat)')
r = await bill(TA, 'Bharat', [memLine(A12, '12:00-18:00', { renewsId: String(bharatMs._id) })]); ok(r.status === 201, 'renewing the expired membership (same seat) succeeds')
const ms2 = await Membership.find({ memberId: st.memberId }).sort({ endDate: 1 }).lean()
ok(ms2.length === 2 && ms2[1].kind === 'renewal' && String(ms2[1].renewsId) === String(bharatMs._id), 'one new renewal record chained to the old one (no duplicate active membership)')
ok(Math.abs(+ms2[1].startDate - Date.now()) < 5 * 60e3, 'expired → new period starts NOW (not from the stale end date)')
ok(Math.abs(+ms2[1].endDate - (+ms2[1].startDate + 28 * DAY)) < 4 * DAY, 'expiry = start + 1 month')
ok((await activeCount({ customerId: ms2[0].customerId })) === 1, 'still exactly one active seat after renewing both')
// still-running membership renews from the old END (no lost days)
r = await bill(TA, 'Chitra', [memLine(null, null, {})]); ok(r.status === 201, 'Membership billed for a member who already has one RENEWS it (no second membership)')
const cm = await Membership.find({ customerId: (await memberDoc(TA, 'Chitra')).customerId }).sort({ endDate: 1 }).lean()
ok(cm.length === 2 && +cm[1].startDate === +cm[0].endDate, 'still-running membership: renewal starts exactly when the old one ends (no days lost or double-counted)')
ok((await holds(TA, A12)).some((b) => b.start === '18:00'), 'Chitra kept her seat/slot through the renewal')
// stale / wrong renewsId
r = await bill(TA, 'Bharat', [memLine(A12, '12:00-18:00', { renewsId: String(bharatMs._id) })]); ok(r.status === 409 && r.data.code === 'MEMBERSHIP_ALREADY_RENEWED', 'renewing an already-renewed membership is refused (would extend wrong dates)')
r = await bill(TA, 'Chitra', [memLine(null, null, { renewsId: String(bharatMs._id) })]); ok(r.status === 404, 'renewsId of ANOTHER member is refused')
// B) seat-only renewal via Seat Fee, membership expired: seat stays held, no extra assignment, no date change
const aniMs = await Membership.findOne({ customerId: (await memberDoc(TA, 'Anita')).customerId }).sort({ endDate: -1 }).lean() // her LATEST membership
const aniCount0 = await Membership.countDocuments({ customerId: aniMs.customerId })
{ // move Anita's WHOLE chain into the past together (order preserved) so her latest membership ended 3 days ago
  const shift = +aniMs.endDate - (Date.now() - 3 * DAY)
  for (const m of await Membership.find({ customerId: aniMs.customerId }).lean()) await Membership.updateOne({ _id: m._id }, { $set: { startDate: new Date(+m.startDate - shift), endDate: new Date(+m.endDate - shift) } })
}
r = await bill(TA, 'Anita', [{ type: 'seat', name: 'Seat Fee', quantity: 1, rate: 300, meta: { seatId: A11, slot: T('06:00-12:00') } }]); ok(r.status === 201, 'Seat Fee for the SAME seat (expired membership) is accepted as a renewal of that seat')
ok((await activeCount({ customerId: aniMs.customerId })) === 1, 'no second assignment was created')
const aniMs2 = await Membership.findById(aniMs._id).lean(); ok(+aniMs2.endDate < Date.now() && +aniMs2.endDate === +(await Membership.findOne({ customerId: aniMs.customerId }).sort({ endDate: -1 }).lean()).endDate, 'a Seat Fee alone never extends the membership expiry (seat validity follows the membership)')
r = await bill(TA, 'Ivan', [memLine(A11, '08:00-10:00')]); ok(r.status === 409, 'a seat held by a member with an EXPIRED membership is still occupied (only Release frees it)')
// C) membership + seat renewal in ONE bill
r = await bill(TA, 'Anita', [memLine(A11, '06:00-12:00', { renewsId: String(aniMs._id) }), { type: 'seat', name: 'Seat Fee', quantity: 1, rate: 300, meta: { seatId: A11, slot: T('06:00-12:00') } }])
ok(r.status === 201 && r.data.bill.totalAmount === 1300, 'membership renewal + seat fee in one bill (₹1000 + ₹300)')
const aniAll = await Membership.find({ customerId: aniMs.customerId }).sort({ endDate: 1 }).lean()
const aniNew = aniAll[aniAll.length - 1]
ok(aniAll.length === aniCount0 + 1 && aniNew.kind === 'renewal' && String(aniNew.renewsId) === String(aniMs._id) && (await activeCount({ customerId: aniMs.customerId })) === 1, 'exactly one new renewal record (chained to the latest), one active seat — no duplicates')
ok(aniNew.amountPaid === 1000 && aniNew.pending === 0, 'membership record carries its own paid amount (₹1000), not the seat fee')
// D) released seat is available again — by the existing rule (release), not by expiry
r = await req('POST', `/api/seller/study/assignments/${(await SeatAssignment.findOne({ seatId: A11, releasedAt: null }))._id}/release`, {}, TA)
r = await bill(TA, 'Ivan', [memLine(A11, '08:00-10:00')]); ok(r.status === 201, 'after Release the seat can be given to someone else')
// payments / history consistent
const b1 = (await req('GET', `/api/seller/billing/bills/${r.data.billId}`, null, TA)).data
ok(r.data.bill.paidAmount === 1000 && r.data.bill.unpaidAmount === 0, 'payment record: ₹1000 paid, ₹0 pending')
// part payment on a renewal records the pending amount on the membership
r = await bill(TA, 'Chitra', [memLine(null, null, {})], { paymentMode: 'custom', amountPaid: 400, addRemainingToUdhar: true })
ok(r.status === 201 && r.data.bill.unpaidAmount === 600, 'renewal with part payment → ₹600 pending')
const last = await Membership.findOne({ customerId: (await memberDoc(TA, 'Chitra')).customerId }).sort({ endDate: -1 }).lean()
ok(last.amountPaid === 400 && last.pending === 600, 'membership record shows paid ₹400 / pending ₹600')
// a bill that fails half-way is undone exactly (no ghost membership / seat)
const ms0 = await Membership.countDocuments({}), as0 = await SeatAssignment.countDocuments({})
r = await bill(TA, 'Jaya', [memLine(A12, '10:00-14:00')]); ok(r.status === 409 && (await Membership.countDocuments({})) === ms0 && (await SeatAssignment.countDocuments({})) === as0, 'refused bill leaves no membership and no assignment behind')

console.log('\nAll study-centre billing / seat integration tests passed')
server.close(); await mongoose.disconnect(); process.exit(0)
