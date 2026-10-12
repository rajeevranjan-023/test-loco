// Pure-logic tests for the Study Center (no database needed):  node tests/study.logic.test.js
import assert from 'node:assert/strict'
import { buildSeatNames, normSlot, overlaps, findConflict, seatState, coveredMinutes, dueAge, dueText, addMonths, renewalStart, memberStatus, isExpired, applyDiscount, seatSort, slotLabel } from '../utils/library/studyLogic.js'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('✅', name) }
const W = { open: '08:00', close: '18:00' }
const S = (start, end) => normSlot({ start, end }, W).slot
const A = (start, end, extra = {}) => ({ _id: `${start}-${end}`, slot: S(start, end), releasedAt: null, ...extra })

t('naming: grid A1…B10', () => { const { names } = buildSeatNames({ mode: 'grid', rows: 2, perRow: 10 }); assert.equal(names.length, 20); assert.equal(names[0], 'A1'); assert.equal(names[10], 'B1'); assert.equal(names[19], 'B10') })
t('naming: grid past Z → AA1', () => { const { names } = buildSeatNames({ mode: 'grid', rows: 2, perRow: 1, startRow: 'Z' }); assert.deepEqual(names, ['Z1', 'AA1']) })
t('naming: plain numbers', () => { assert.deepEqual(buildSeatNames({ mode: 'sequence', start: 1, count: 3 }).names, ['1', '2', '3']) })
t('naming: 101, 102 …', () => { assert.deepEqual(buildSeatNames({ mode: 'sequence', start: 101, count: 3 }).names, ['101', '102', '103']) })
t('naming: Cabin-1, Cabin-2', () => { assert.deepEqual(buildSeatNames({ mode: 'sequence', prefix: 'Cabin-', start: 1, count: 2 }).names, ['Cabin-1', 'Cabin-2']) })
t('naming: zero padding', () => { assert.equal(buildSeatNames({ mode: 'sequence', prefix: 'S', start: 1, count: 1, pad: 3 }).names[0], 'S001') })
t('naming: custom list (comma / newline)', () => { assert.deepEqual(buildSeatNames({ mode: 'custom', names: 'Window-1, Corner\nVIP' }).names, ['Window-1', 'Corner', 'VIP']) })
t('naming: duplicates / empty / too many are rejected', () => {
  assert.ok(buildSeatNames({ mode: 'custom', names: ['A', 'a'] }).error)
  assert.ok(buildSeatNames({ mode: 'custom', names: [] }).error)
  assert.ok(buildSeatNames({ mode: 'grid', rows: 100, perRow: 100 }).error)
  assert.ok(buildSeatNames({ mode: 'nope' }).error)
})
t('natural sort', () => assert.deepEqual(['A10', 'A2', 'B1', 'A1'].sort(seatSort), ['A1', 'A2', 'A10', 'B1']))

t('slots: validation', () => {
  assert.ok(normSlot({ start: '12:00', end: '08:00' }, W).error)
  assert.ok(normSlot({ start: 'x', end: '08:00' }, W).error)
  assert.equal(normSlot({ fullDay: true }, W).slot.fullDay, true)
  assert.equal(slotLabel(S('08:00', '12:00')), '08:00 AM – 12:00 PM')
})
t('conflict: adjacent slots are valid (08–12 then 12–16)', () => { assert.equal(overlaps(S('08:00', '12:00'), S('12:00', '16:00')), false); assert.equal(findConflict([A('08:00', '12:00')], S('12:00', '16:00')), null) })
t('conflict: 08–12 vs 09–11 is rejected', () => { assert.ok(findConflict([A('08:00', '12:00')], S('09:00', '11:00'))) })
t('conflict: full day clashes with any slot; released assignments never clash', () => {
  assert.ok(findConflict([A('08:00', '12:00')], normSlot({ fullDay: true }, W).slot))
  assert.equal(findConflict([A('08:00', '12:00', { releasedAt: new Date() })], S('09:00', '10:00')), null)
})
t('conflict: editing an assignment ignores itself', () => { const a = A('08:00', '12:00'); assert.equal(findConflict([a], S('09:00', '11:00'), a._id), null) })

t('seat state: no assignments → empty (red)', () => assert.equal(seatState({}, [], W), 'empty'))
t('seat state: full day → occupied (green)', () => assert.equal(seatState({}, [{ slot: normSlot({ fullDay: true }, W).slot, releasedAt: null }], W), 'occupied'))
t('seat state: B3 — 08–12 taken, 12–18 free → partial (orange)', () => { assert.equal(seatState({}, [A('08:00', '12:00')], W), 'partial'); assert.equal(coveredMinutes([A('08:00', '12:00')], W), 240) })
t('seat state: two slots that together cover the day → occupied', () => assert.equal(seatState({}, [A('08:00', '12:00'), A('12:00', '18:00')], W), 'occupied'))
t('seat state: disabled → unavailable (gray)', () => assert.equal(seatState({ disabled: true }, [], W), 'unavailable'))
t('seat state: released assignment frees the seat', () => assert.equal(seatState({}, [A('08:00', '18:00', { releasedAt: new Date() })], W), 'empty'))
t('seat state is independent of membership expiry and dues', () => {
  const expired = [{ ...A('08:00', '18:00'), membership: { endDate: new Date(Date.now() - 5 * 864e5) }, due: 500 }]
  assert.equal(seatState({}, expired, W), 'occupied') // A3: expired + ₹500 due → still green
})

const NOW = new Date('2026-10-08T12:00:00Z')
t('due age: 5d / 12d / 29d', () => { assert.equal(dueAge(new Date('2026-10-03T12:00:00Z'), NOW), '5d'); assert.equal(dueAge(new Date('2026-09-26T12:00:00Z'), NOW), '12d'); assert.equal(dueAge(new Date('2026-09-09T12:00:00Z'), NOW), '29d') })
t('due age: months (1m at 30d, 2m at 60d)', () => { assert.equal(dueAge(new Date('2026-09-08T12:00:00Z'), NOW), '1m'); assert.equal(dueAge(new Date('2026-08-08T12:00:00Z'), NOW), '2m') })
t('due text', () => { assert.equal(dueText(500, new Date('2026-10-03T12:00:00Z'), NOW), '₹500 · 5d'); assert.equal(dueText(1200, new Date('2026-08-08T12:00:00Z'), NOW), '₹1,200 · 2m'); assert.equal(dueText(0, null, NOW), '') })

t('membership: addMonths handles month ends', () => { assert.equal(addMonths(new Date(2026, 0, 31), 1).getDate(), 28); assert.equal(addMonths(new Date(2026, 9, 8), 12).getFullYear(), 2027) })
t('renewal starts at the old end when still ahead, else today', () => {
  assert.equal(+renewalStart(new Date('2026-10-20'), NOW), +new Date('2026-10-20'))
  assert.equal(+renewalStart(new Date('2026-09-01'), NOW), +NOW)
})
t('member status order', () => {
  const live = new Date(+NOW + 864e5 * 10), dead = new Date(+NOW - 864e5)
  assert.equal(memberStatus({ released: true, endDate: live }, NOW), 'Released')
  assert.equal(memberStatus({ inactive: true, endDate: live }, NOW), 'Inactive')
  assert.equal(memberStatus({ endDate: dead, due: 500 }, NOW), 'Membership Expired') // expired wins; the due is shown separately
  assert.equal(memberStatus({ endDate: live, due: 300 }, NOW), 'Pending Payment')
  assert.equal(memberStatus({ endDate: live, fullDay: false }, NOW), 'Partially Active')
  assert.equal(memberStatus({ endDate: live }, NOW), 'Active')
  assert.equal(isExpired(dead, NOW), true)
})
t('discount: 10% of ₹2,500 = ₹250 · fixed ₹200 · never above the base', () => {
  assert.equal(applyDiscount(2500, { type: 'percent', value: 10 }), 250)
  assert.equal(applyDiscount(2500, { type: 'fixed', value: 200 }), 200)
  assert.equal(applyDiscount(100, { type: 'fixed', value: 500 }), 100)
})
console.log(`\n${n} study logic tests passed`)
