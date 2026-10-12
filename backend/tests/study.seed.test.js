// Verifies the generated Bright Study Center data (no database): designed edge cases, relationships, seat states, due ages.
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { generateStudy } from '../seed/studyData.js'
import { seatState, dueAge, DEFAULT_WINDOW, memberStatus } from '../utils/library/studyLogic.js'

const NOW = Date.now(), centerId = new mongoose.Types.ObjectId()
const d = generateStudy({ centerId, now: NOW })
const S = Object.fromEntries(d.seats.map((s) => [s.name, s]))
const act = (name) => d.assignments.filter((a) => String(a.seatId) === String(S[name]._id) && !a.releasedAt)
const state = (n) => seatState(S[n], act(n), DEFAULT_WINDOW)
const memberOfSeat = (n) => d.members.find((m) => String(m._id) === String(act(n)[0].memberId))
const dueOf = (m) => d.udhars.find((u) => String(u.customerId) === String(m.customerId))
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✅', name) }

t('60 seats, 4 naming patterns, 1 unavailable', () => { assert.equal(d.seats.length, 60); assert.ok(S.A1 && S['Cabin-3'] && S.R2 && S.P1); assert.equal(state('Cabin-10'), 'unavailable') })
t('A3: membership expired, ₹500 due 5d, seat still GREEN (occupied)', () => {
  const m = memberOfSeat('A3'); assert.equal(m.name, 'Riya Verma'); assert.equal(state('A3'), 'occupied')
  const ms = d.memberships.filter((x) => String(x.memberId) === String(m._id)).sort((a, b) => b.endDate - a.endDate)[0]
  assert.ok(+ms.endDate < NOW); const u = dueOf(m); assert.equal(u.totalAmount, 500); assert.equal(dueAge(u.pendingSince, NOW), '5d')
})
t('B3 partial (08–12 occupied) → ORANGE · C5 empty → RED', () => { assert.equal(state('B3'), 'partial'); assert.equal(act('B3')[0].slot.start, '08:00'); assert.equal(state('C5'), 'empty') })
t('C2: two valid adjacent slots (08–12, 12–16) → partial', () => { assert.equal(act('C2').length, 2); assert.equal(state('C2'), 'partial') })
t('B9: two half-days cover the whole day → occupied', () => { assert.equal(act('B9').length, 2); assert.equal(state('B9'), 'occupied') })
t('due ages: 12d · 1m · 2m · 3d · 10d', () => {
  const age = (seat) => dueAge(dueOf(memberOfSeat(seat)).pendingSince, NOW)
  assert.equal(age('A8'), '12d'); assert.equal(age('B6'), '1m'); assert.equal(age('D4'), '2m'); assert.equal(age('C7'), '3d'); assert.equal(age('D7'), '10d')
})
t('partial payment: Raj ₹1,000 paid ₹700 due ₹300', () => { const m = d.members.find((x) => x.name === 'Raj Malhotra'); const b = d.bills.find((x) => String(x.customerId) === String(m.customerId) && x.items[0].type === 'membership'); assert.equal(b.totalAmount, 1000); assert.equal(b.paidAmount, 700); assert.equal(b.unpaidAmount, 300); assert.equal(dueOf(m).totalAmount, 300) })
t('full pending payment: Vikram paid ₹0', () => { const m = d.members.find((x) => x.name === 'Vikram Dubey'); const b = d.bills.find((x) => String(x.customerId) === String(m.customerId)); assert.equal(b.paidAmount, 0); assert.equal(b.paymentStatus, 'unpaid') })
t('expired membership with NO due still holds its seat (R1)', () => { const m = memberOfSeat('R1'); assert.equal(m.name, 'Preeti Agarwal'); assert.equal(dueOf(m), undefined); assert.equal(state('R1'), 'occupied') })
t('released seats keep history and are empty again', () => {
  const rel = d.assignments.filter((a) => a.releasedAt); assert.ok(rel.length >= 2); assert.equal(state('C5'), 'empty'); assert.equal(state('D1'), 'empty')
  assert.ok(rel.every((a) => a.releasedBy)); assert.ok(d.members.find((m) => m.name === 'Tarun Bhatia').leftAt)
})
t('renewed members have a renewal chain (history preserved)', () => {
  const m = d.members.find((x) => x.name === 'Aarav Sharma'); const list = d.memberships.filter((x) => String(x.memberId) === String(m._id)).sort((a, b) => a.startDate - b.startDate)
  assert.equal(list.length, 3); assert.equal(list[0].kind, 'new'); assert.equal(list[1].kind, 'renewal'); assert.equal(String(list[2].renewsId), String(list[1]._id)); assert.ok(+list[1].startDate === +list[0].endDate)
})
t('discounts: 10% on a 3-month plan, ₹200 fixed', () => {
  const b = (nm) => d.bills.find((x) => x.customerName === nm && x.items[0].type === 'membership')
  assert.equal(b('Sakshi Rao').discount, 280); assert.equal(b('Sakshi Rao').totalAmount, 2520); assert.equal(b('Tanmay Soni').totalAmount, 2600)
})
t('every bill type exists: membership · course · book · fine · registration · other', () => { const types = new Set(d.bills.flatMap((b) => b.items.map((i) => i.type))); for (const k of ['membership', 'course', 'book', 'fine', 'registration', 'other']) assert.ok(types.has(k), k) })
t('bill totals add up; revenue split sums to total; ids unique', () => {
  const ids = new Set(); for (const b of d.bills) { assert.ok(!ids.has(b.billId)); ids.add(b.billId); assert.equal(Math.round((b.paidAmount + b.unpaidAmount) * 100), Math.round(b.totalAmount * 100)); assert.equal(Math.round(Object.values(b.revenue).reduce((a, c) => a + c, 0) * 100), Math.round(b.totalAmount * 100)) }
})
t('relationships: every membership / assignment / bill points at a real member, seat, customer', () => {
  const mem = new Set(d.members.map((m) => String(m._id))), seat = new Set(d.seats.map((s) => String(s._id))), cust = new Set(d.customers.map((c) => String(c._id)))
  for (const a of d.assignments) { assert.ok(mem.has(String(a.memberId)) && seat.has(String(a.seatId)) && cust.has(String(a.customerId))) }
  for (const m of d.memberships) assert.ok(mem.has(String(m.memberId)))
  for (const b of d.bills) assert.ok(cust.has(String(b.customerId)))
  for (const e of d.enrollments) assert.ok(d.courses.some((c) => String(c._id) === String(e.courseId)) && e.billId)
})
t('every ledger balance equals the sum of its history; unique member codes & phones', () => {
  for (const u of d.udhars) { const sum = d.history.filter((h) => String(h.customerId) === String(u.customerId)).reduce((a, h) => a + h.delta, 0); assert.ok(Math.abs(sum - u.totalAmount) < 0.01) }
  assert.equal(new Set(d.members.map((m) => m.memberCode)).size, d.members.length); assert.equal(new Set(d.members.map((m) => m.phone)).size, d.members.length)
})
t('inactive member exists; statuses cover Active · Expired · Pending · Partially Active · Released · Inactive', () => {
  const latest = (m) => d.memberships.filter((x) => String(x.memberId) === String(m._id)).sort((a, b) => b.endDate - a.endDate)[0]
  const set = new Set(d.members.map((m) => { const as = d.assignments.filter((a) => String(a.memberId) === String(m._id) && !a.releasedAt), u = dueOf(m), ms = latest(m); return memberStatus({ released: !as.length && !!m.leftAt, inactive: m.inactive, endDate: ms?.endDate, due: u?.totalAmount || 0, fullDay: !as.length || as.every((a) => a.slot.fullDay), hasMembership: !!ms }, new Date(NOW)) }))
  for (const k of ['Active', 'Membership Expired', 'Pending Payment', 'Partially Active', 'Released', 'Inactive']) assert.ok(set.has(k), `${k} missing: ${[...set]}`)
})
const sum = { occupied: 0, partial: 0, empty: 0, unavailable: 0 }; d.seats.forEach((s) => sum[state(s.name)]++)
console.log(`\n${n} seed tests passed · members ${d.members.length} · bills ${d.bills.length} · seats`, sum, '· drafts', d.drafts.length)

// ── every generated document must pass its real Mongoose schema ──
const { default: User } = await import('../models/common/User.js')
const models = { seats: 'Seat', members: 'StudyMember', memberships: 'Membership', assignments: 'SeatAssignment', courses: 'Course', enrollments: 'Enrollment', customers: 'Customer', bills: 'Bill', udhars: 'Udhar', history: 'UdharHistory', drafts: 'BillDraft', billCounters: 'BillCounter' }
const modelDir = { Seat: 'library/', StudyMember: 'library/', Membership: 'library/', SeatAssignment: 'library/', Course: 'library/', Enrollment: 'library/', Customer: 'common/', Bill: 'common/', Udhar: 'common/', UdharHistory: 'common/', BillDraft: 'common/', BillCounter: 'common/' } // models now live in models/<module>/
for (const [key, name] of Object.entries(models)) {
  const { default: M } = await import(`../models/${modelDir[name] || ''}${name}.js`)
  let bad = 0
  for (const doc of d[key]) { const err = new M(doc).validateSync(); if (err) { bad++; if (bad === 1) console.error(name, Object.values(err.errors).map((e) => e.message)) } }
  assert.equal(bad, 0, `${name}: ${bad} invalid documents`)
  console.log('✅ schema-valid:', name, d[key].length)
}
const { default: Center } = await import('../models/library/StudyCenter.js')
const cErr = new Center({ userId: new mongoose.Types.ObjectId(), username: '@brightstudy238', centerName: 'Bright Study Center', ownerName: 'x', phone: '9876500102', config: d.config }).validateSync()
assert.ok(!cErr, 'StudyCenter doc'); console.log('✅ schema-valid: StudyCenter')
const u = new User({ name: 'Rajeev Kumar', email: 'demo.study@example.com', username: '@brightstudy238', password: 'StudyCenter@123', role: 'seller', sellerType: 'study_center' })
assert.ok(!u.validateSync(), 'User doc with sellerType study_center'); console.log('✅ schema-valid: User (sellerType study_center)')

// due ages must not depend on the clock time the seed runs at (a due "5 days ago" is 5d at 00:05 and at 23:58)
for (const iso of ['2026-10-08T00:05:00', '2026-10-08T06:30:00', '2026-10-08T14:59:00', '2026-10-08T23:58:00']) {
  const now = +new Date(iso), g = generateStudy({ centerId: new mongoose.Types.ObjectId(), now })
  const age = (nm) => { const m = g.members.find((x) => x.name === nm); return dueAge(g.udhars.find((x) => String(x.customerId) === String(m.customerId)).pendingSince, now) }
  assert.equal(['Riya Verma', 'Meera Joshi', 'Aditya Kumar', 'Sneha Patel', 'Pooja Sharma'].map(age).join(','), '5d,12d,1m,3d,2m', iso)
}
console.log('✅ due ages exact at every time of day')
