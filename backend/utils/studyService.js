import crypto from 'node:crypto'
import mongoose from 'mongoose'
import Customer from '../models/Customer.js'
import Udhar from '../models/Udhar.js'
import Seat from '../models/Seat.js'
import AssignmentLock from '../models/AssignmentLock.js'
import StudyMember from '../models/StudyMember.js'
import Membership from '../models/Membership.js'
import SeatAssignment from '../models/SeatAssignment.js'
import StudyCenter from '../models/StudyCenter.js'
import { normSlot, findConflict, overlaps, seatState, seatSort, dueAge, memberStatus, DEFAULT_WINDOW, slotLabel, addMonths, renewalStart, STATE_COLOR } from './studyLogic.js'

const oid = (x) => (x && x._id ? x._id : x)
const fail = (status, message, code) => Object.assign(new Error(message), { status, expose: true, ...(code ? { code } : {}) }) // expose → errorHandler returns this message + status (+ a stable `code` the UI can act on) to the client
export const windowOf = (center) => ({ open: center?.config?.operatingHours?.open || DEFAULT_WINDOW.open, close: center?.config?.operatingHours?.close || DEFAULT_WINDOW.close })

export async function nextMemberCode(center) {
  const c = await StudyCenter.findOneAndUpdate({ _id: center._id }, { $inc: { 'config.memberCounter': 1 } }, { new: true }).select('config.memberCounter config.memberPrefix').lean()
  return `${c?.config?.memberPrefix || 'STU'}${String(c?.config?.memberCounter || 1).padStart(3, '0')}`
}

// Every person a centre bills or registers is a shared Customer (ledger, bills, global phone directory) PLUS a StudyMember profile.
export async function ensureMember(center, customer, extra = {}) {
  let m = await StudyMember.findOne({ centerId: center._id, customerId: customer._id })
  if (m) return m
  const memberCode = await nextMemberCode(center)
  try {
    m = await StudyMember.create({ centerId: center._id, customerId: customer._id, memberCode, name: customer.name, phone: customer.phone || '', joinedAt: extra.joinedAt || new Date(), email: extra.email || '', className: extra.className || '', notes: extra.notes || '' })
  } catch (e) { if (e.code === 11000) return StudyMember.findOne({ centerId: center._id, customerId: customer._id }); throw e }
  return m
}

// ───────── dues (the shared udhar ledger, read as "Pending Dues") ─────────
export async function duesOf(centerId, customerIds) {
  if (!customerIds.length) return new Map()
  const rows = await Udhar.find({ shopId: centerId, customerId: { $in: customerIds }, totalAmount: { $gt: 0.005 } }).select('customerId totalAmount pendingSince').lean()
  return new Map(rows.map((u) => [String(u.customerId), { amount: u.totalAmount, since: u.pendingSince }]))
}

// ───────── seat board ─────────
export async function seatBoard(center, { now = new Date() } = {}) {
  const win = windowOf(center)
  const [seats, active] = await Promise.all([
    Seat.find({ centerId: center._id }).lean(),
    SeatAssignment.find({ centerId: center._id, releasedAt: null }).lean(),
  ])
  const memberIds = [...new Set(active.map((a) => String(a.memberId)))]
  const [members, memberships] = await Promise.all([
    StudyMember.find({ _id: { $in: memberIds } }).lean(),
    Membership.find({ centerId: center._id, memberId: { $in: memberIds } }).sort({ endDate: -1 }).lean(),
  ])
  const mById = new Map(members.map((m) => [String(m._id), m]))
  const latest = new Map() // memberId → latest membership
  for (const ms of memberships) if (!latest.has(String(ms.memberId))) latest.set(String(ms.memberId), ms)
  const dues = await duesOf(center._id, members.map((m) => m.customerId))
  const byMs = new Map(memberships.map((ms) => [String(ms._id), ms]))

  const bySeat = new Map()
  for (const a of active) { const k = String(a.seatId); (bySeat.get(k) || bySeat.set(k, []).get(k)).push(a) }
  const zoneName = Object.fromEntries((center.config?.zones || []).map((z) => [z.key, z.name]))
  const typeName = Object.fromEntries((center.config?.seatTypes || []).map((t) => [t.key, t.name]))

  const rows = seats.sort((a, b) => seatSort(a.name, b.name)).map((s) => {
    const list = (bySeat.get(String(s._id)) || []).sort((x, y) => x.slot.start.localeCompare(y.slot.start))
    const state = seatState(s, list, win)
    const people = list.map((a) => {
      const m = mById.get(String(a.memberId)), ms = (a.membershipId && byMs.get(String(a.membershipId))) || latest.get(String(a.memberId)), d = dues.get(String(m?.customerId)) || null
      return { assignmentId: a._id, memberId: a.memberId, name: m?.name || '—', phone: m?.phone || '', memberCode: m?.memberCode || '', slot: a.slot, slotLabel: slotLabel(a.slot), validTill: ms?.endDate || null, expired: !!ms && +new Date(ms.endDate) < +now, due: d ? d.amount : 0, dueSince: d?.since || null, releaseRequestedAt: a.releaseRequestedAt || null }
    })
    // a seat's due is the sum over its DISTINCT members (two slots by the same member count once)
    const seen = new Set(), dueRows = people.filter((p) => p.due > 0 && !seen.has(String(p.memberId)) && seen.add(String(p.memberId)))
    const dueAmount = Math.round(dueRows.reduce((t, p) => t + p.due, 0) * 100) / 100
    const since = dueRows.map((p) => p.dueSince).filter(Boolean).sort((a, b) => +new Date(a) - +new Date(b))[0] || null
    return {
      id: s._id, name: s.name, zone: s.zone, zoneName: zoneName[s.zone] || s.zone || '', type: s.type, typeName: typeName[s.type] || s.type || '', disabled: !!s.disabled, note: s.note || '',
      state, color: STATE_COLOR[state], people, member: people[0] || null,
      validTill: people.map((p) => p.validTill).filter(Boolean).sort((a, b) => +new Date(b) - +new Date(a))[0] || null,
      due: dueAmount ? { amount: dueAmount, age: dueAge(since, now), since } : null,
    }
  })
  const count = (st) => rows.filter((r) => r.state === st).length
  const usable = rows.filter((r) => r.state !== 'unavailable').length
  const pct = (n) => (usable ? Math.round((n / usable) * 100) : 0)
  const dueMembers = new Map()
  for (const r of rows) for (const p of r.people) if (p.due > 0) dueMembers.set(String(p.memberId), p.due)
  return {
    window: win, seats: rows,
    summary: {
      total: rows.length, occupied: count('occupied'), partial: count('partial'), empty: count('empty'), unavailable: count('unavailable'),
      occupiedPct: pct(count('occupied')), partialPct: pct(count('partial')), emptyPct: pct(count('empty')),
      pendingAmount: Math.round([...dueMembers.values()].reduce((a, b) => a + b, 0) * 100) / 100, pendingMembers: dueMembers.size,
    },
  }
}

// ───────── assignment ─────────
// THE TWO SEAT RULES (enforced here, on the server, for every flow that can put a member on a seat — billing, Seats page, reassign):
//   1. A member has at most ONE active seat assignment. Renewing keeps it; moving to another seat/slot is an explicit "change" that releases the old one.
//   2. A seat can be shared by several members ONLY in slots that do not overlap (end time exclusive: 06:00–12:00 and 12:00–18:00 are fine).
// "Active" is the project's existing meaning: releasedAt is null. An expired membership does NOT free a seat — only Release does.
export const MSG_SEAT_TAKEN = 'This seat is already assigned to another member during the selected time slot. Please select another seat or time slot.'
export const MSG_MEMBER_HAS_SEAT = 'This member already has an active seat assigned. Please remove or change the existing assignment before assigning another seat.'
const sameSlot = (a, b) => a?.start === b?.start && a?.end === b?.end

// Read-only check of ONE seat/slot (no write). `ignoreIds` = the member's own assignments that this request replaces.
export async function assertSlotFree(center, seatId, rawSlot, ignoreIds = []) {
  const { slot, error } = normSlot(rawSlot, windowOf(center))
  if (error) throw fail(400, error, 'INVALID_SLOT')
  if (!mongoose.isValidObjectId(seatId)) throw fail(404, 'Seat not found.')
  const seat = await Seat.findOne({ _id: seatId, centerId: center._id }).lean()
  if (!seat) throw fail(404, 'Seat not found.')
  if (seat.disabled) throw fail(409, `Seat ${seat.name} is unavailable. Please select an available seat.`, 'SEAT_UNAVAILABLE')
  const skip = new Set([].concat(ignoreIds || []).filter(Boolean).map(String))
  const active = (await SeatAssignment.find({ centerId: center._id, seatId, releasedAt: null }).lean()).filter((a) => !skip.has(String(a._id)))
  if (findConflict(active, slot)) throw fail(409, MSG_SEAT_TAKEN, 'SEAT_SLOT_CONFLICT')
  return { seat, slot }
}

// ── concurrency: one lock per seat and per member, held only for the check-then-write window ──
// A lock is a row with a UNIQUE key (models/AssignmentLock.js): the database lets exactly one simultaneous insert succeed, the rest wait and then
// re-check against fresh data — so two requests can never both pass the overlap / one-seat checks.
const LOCK_MS = 8000, LOCK_TRIES = 120
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function takeLock(key) {
  const token = crypto.randomUUID()
  for (let i = 0; i < LOCK_TRIES; i++) {
    try { await AssignmentLock.create({ key, token, expiresAt: new Date(Date.now() + LOCK_MS) }); return token } catch (e) {
      if (e?.code !== 11000) throw e                                                            // 11000 = someone else holds it
      await AssignmentLock.deleteOne({ key, expiresAt: { $lte: new Date() } }).catch(() => null) // reclaim a lock a crashed request left behind
      await sleep(8 + Math.random() * 25)
    }
  }
  return null
}
const dropLock = (key, token) => AssignmentLock.deleteOne({ key, token }).catch(() => null)
export async function withAssignmentLocks({ memberId = null, seatIds = [] }, fn) {
  const held = []
  try {
    // fixed order (member, then seats by id) so two requests can never wait on each other
    const keys = [...(memberId ? [`member:${memberId}`] : []), ...[...new Set(seatIds.map(String))].sort().map((id) => `seat:${id}`)]
    for (const key of keys) {
      const token = await takeLock(key)
      if (!token) throw fail(409, key.startsWith('seat') ? 'Another booking for this seat is in progress. Please try again.' : 'Another change to this member is in progress. Please try again.', 'SEAT_BUSY')
      held.push([key, token])
    }
    return await fn()
  } finally { for (const [key, token] of held.reverse()) await dropLock(key, token) }
}

const activeOf = (center, memberId) => SeatAssignment.find({ centerId: center._id, memberId, releasedAt: null }).lean()

// Non-locking pre-check used by billing BEFORE anything is written (assignSeat re-checks under the lease, so this is only for early, clean refusal).
export async function checkSeatRequest(center, { member = null, seatId, slot: rawSlot, replaceAssignmentId = null }) {
  const { slot, error } = normSlot(rawSlot, windowOf(center))
  if (error) throw fail(400, error, 'INVALID_SLOT')
  let replace = []
  if (member) {
    const current = await activeOf(center, member._id)
    if (current.some((a) => String(a.seatId) === String(seatId) && sameSlot(a.slot, slot))) return { slot, keep: true } // renewing the seat they already hold
    replace = replaceAssignmentId && current.some((a) => String(a._id) === String(replaceAssignmentId)) ? [String(replaceAssignmentId)] : []
    if (current.some((a) => !replace.includes(String(a._id)))) throw fail(409, MSG_MEMBER_HAS_SEAT, 'MEMBER_HAS_SEAT')
  }
  const { seat } = await assertSlotFree(center, seatId, slot, replace)
  return { slot, seat, replace }
}

// Put a member on a seat. `replaceIds` = the member's own active assignment(s) this request is allowed to move (an explicit change).
export async function assignSeat(center, { seatId, member, slot: rawSlot, membershipId = null, replaceIds = [], billId = null, startedAt = new Date() }) {
  if (!mongoose.isValidObjectId(seatId) || !(await Seat.exists({ _id: seatId, centerId: center._id }))) throw fail(404, 'Seat not found.')
  const replace = [].concat(replaceIds || []).filter(Boolean).map(String)
  return withAssignmentLocks({ memberId: member._id, seatIds: [seatId] }, async () => {
    const mine = await activeOf(center, member._id) // read INSIDE the lease → fresh state
    if (mine.some((a) => !replace.includes(String(a._id)))) throw fail(409, MSG_MEMBER_HAS_SEAT, 'MEMBER_HAS_SEAT')
    const { seat, slot } = await assertSlotFree(center, seatId, rawSlot, replace)
    const a = await SeatAssignment.create({ centerId: center._id, seatId: seat._id, memberId: member._id, customerId: member.customerId, membershipId, slot, startedAt, billId, replacesId: mine.find((x) => replace.includes(String(x._id)))?._id || null })
    for (const old of mine) await releaseAssignment(center, old._id, { by: 'reassigned', note: 'Moved to another seat', now: startedAt }) // the new spot exists first; history of the old one is kept
    await StudyMember.updateOne({ _id: member._id }, { $set: { leftAt: null } })
    return { assignment: a, seat }
  })
}

// Release = the ONLY way a seat becomes available again. Nothing is deleted: the row stays with releasedAt / releasedBy.
export async function releaseAssignment(center, assignmentId, { by = 'owner', note = '', now = new Date() } = {}) {
  const a = await SeatAssignment.findOneAndUpdate({ _id: assignmentId, centerId: center._id, releasedAt: null }, { $set: { releasedAt: now, releasedBy: by, releaseNote: String(note).slice(0, 200) } }, { new: true })
  if (!a) throw fail(404, 'That seat assignment is not active.')
  const left = await SeatAssignment.countDocuments({ centerId: center._id, memberId: a.memberId, releasedAt: null })
  if (!left) await StudyMember.updateOne({ _id: a.memberId }, { $set: { leftAt: now } })
  return a
}

// One seat line of a bill (a Membership with a seat, or a Seat Fee): keep, assign or (only when asked) move — never a second active seat.
export async function applySeatLine(center, { member, seatId, slot: rawSlot, membershipId = null, replaceAssignmentId = null, billId = null, now = new Date() }) {
  const { slot, error } = normSlot(rawSlot || { fullDay: true }, windowOf(center))
  if (error) throw fail(400, error, 'INVALID_SLOT')
  const current = await activeOf(center, member._id)
  const same = current.find((a) => String(a.seatId) === String(seatId) && sameSlot(a.slot, slot))
  if (same) { // renewal of the seat they already hold: no new assignment, just tie it to the (new) membership
    if (membershipId) await SeatAssignment.updateOne({ _id: same._id }, { $set: { membershipId } })
    return { assignment: null, kept: same }
  }
  const replaceIds = replaceAssignmentId && current.some((a) => String(a._id) === String(replaceAssignmentId)) ? [replaceAssignmentId] : []
  const { assignment } = await assignSeat(center, { seatId, member, slot, membershipId, replaceIds, billId, startedAt: now })
  return { assignment }
}

// ───────── memberships ─────────
export const latestMembership = (center, memberId) => Membership.findOne({ centerId: center._id, memberId }).sort({ endDate: -1 })

// A member has ONE membership chain. Billing a Membership for someone who already has one RENEWS it (it never creates a second, overlapping membership):
//   still running → the new period starts when the old one ends · expired → it starts now (utils/studyLogic.js#renewalStart).
export async function createMembership(center, { member, plan, rate = null, discount = 0, billId = null, paid = 0, pending = 0, seatId = null, slot = null, renewsId = null, replaceAssignmentId = null, startDate = null, now = new Date() }) {
  const months = Math.max(Math.floor(Number(plan.months)), 1)
  const latest = await latestMembership(center, member._id)
  let prev = null
  if (renewsId) {
    prev = await Membership.findOne({ _id: renewsId, centerId: center._id, memberId: member._id })
    if (!prev) throw fail(404, 'That membership could not be found.')
    if (latest && String(latest._id) !== String(prev._id)) throw fail(409, 'This membership has already been renewed. Please refresh and renew the latest one.', 'MEMBERSHIP_ALREADY_RENEWED')
  } else if (latest) prev = latest
  const start = startDate ? new Date(startDate) : prev ? renewalStart(prev.endDate, now) : now
  const ms = await Membership.create({
    centerId: center._id, memberId: member._id, customerId: member.customerId, planKey: plan.key || '', planName: plan.name || `${months} Month${months > 1 ? 's' : ''}`, months,
    startDate: start, endDate: addMonths(start, months), amount: rate ?? plan.price ?? 0, discount, amountPaid: paid, pending, billId, seatId: seatId || prev?.seatId || null, slot: slot || prev?.slot || null,
    kind: prev ? 'renewal' : 'new', renewsId: prev?._id || null,
  })
  try {
    if (seatId) { const { assignment } = await applySeatLine(center, { member, seatId, slot: slot || { fullDay: true }, membershipId: ms._id, replaceAssignmentId, billId, now }); return { membership: ms, assignment } }
    const current = await activeOf(center, member._id) // no seat on this line: whatever seat they hold simply follows the renewed membership
    if (current.length) await SeatAssignment.updateMany({ _id: { $in: current.map((a) => a._id) } }, { $set: { membershipId: ms._id } })
    return { membership: ms, assignment: null }
  } catch (e) { await Membership.deleteOne({ _id: ms._id }).catch(() => null); throw e } // a refused seat leaves no half-made membership behind
}

// Existing data may already break the rules (older versions allowed several seats per member). This only REPORTS it — nothing is changed or released.
export async function seatConflicts(center) {
  const active = await SeatAssignment.find({ centerId: center._id, releasedAt: null }).populate('seatId', 'name').lean()
  const members = await StudyMember.find({ _id: { $in: [...new Set(active.map((a) => String(a.memberId)))] } }).select('name memberCode phone').lean()
  const who = new Map(members.map((m) => [String(m._id), m]))
  const row = (a) => ({ assignmentId: a._id, seat: a.seatId?.name || '—', slot: slotLabel(a.slot) })
  const byMember = new Map(), bySeat = new Map()
  for (const a of active) { (byMember.get(String(a.memberId)) || byMember.set(String(a.memberId), []).get(String(a.memberId))).push(a); (bySeat.get(String(a.seatId?._id)) || bySeat.set(String(a.seatId?._id), []).get(String(a.seatId?._id))).push(a) }
  const membersWithMultipleSeats = [...byMember.entries()].filter(([, l]) => l.length > 1).map(([id, l]) => ({ memberId: id, name: who.get(id)?.name || '—', memberCode: who.get(id)?.memberCode || '', assignments: l.map(row) }))
  const overlappingSeatAssignments = []
  for (const list of bySeat.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (overlaps(list[i].slot, list[j].slot)) overlappingSeatAssignments.push({ seat: list[i].seatId?.name || '—', a: { ...row(list[i]), memberId: list[i].memberId, name: who.get(String(list[i].memberId))?.name || '—' }, b: { ...row(list[j]), memberId: list[j].memberId, name: who.get(String(list[j].memberId))?.name || '—' } })
  return { ok: !membersWithMultipleSeats.length && !overlappingSeatAssignments.length, membersWithMultipleSeats, overlappingSeatAssignments, note: 'Report only — no assignment was changed. Release the extra assignment from the Seats page to resolve a conflict.' }
}

// ───────── member rows ─────────
export async function memberRows(center, { now = new Date() } = {}) {
  const [members, memberships, active] = await Promise.all([
    StudyMember.find({ centerId: center._id }).sort({ createdAt: -1 }).lean(),
    Membership.find({ centerId: center._id }).sort({ endDate: -1 }).lean(),
    SeatAssignment.find({ centerId: center._id, releasedAt: null }).populate('seatId', 'name zone').lean(),
  ])
  const dues = await duesOf(center._id, members.map((m) => m.customerId))
  const latest = new Map(), count = new Map()
  for (const ms of memberships) { if (!latest.has(String(ms.memberId))) latest.set(String(ms.memberId), ms); count.set(String(ms.memberId), (count.get(String(ms.memberId)) || 0) + 1) }
  const seatsOf = new Map()
  for (const a of active) { const k = String(a.memberId); (seatsOf.get(k) || seatsOf.set(k, []).get(k)).push(a) }
  return members.map((m) => {
    const ms = latest.get(String(m._id)) || null, as = seatsOf.get(String(m._id)) || [], d = dues.get(String(m.customerId)) || null
    const released = !as.length && !!m.leftAt
    const status = memberStatus({ released, inactive: m.inactive, endDate: ms?.endDate, due: d?.amount || 0, fullDay: !as.length || as.every((a) => a.slot.fullDay), hasMembership: !!ms }, now)
    return {
      id: m._id, customerId: m.customerId, memberCode: m.memberCode, name: m.name, phone: m.phone, email: m.email, className: m.className, joinedAt: m.joinedAt, status,
      plan: ms?.planName || '', startDate: ms?.startDate || null, endDate: ms?.endDate || null, renewals: Math.max((count.get(String(m._id)) || 0) - 1, 0),
      seats: as.map((a) => ({ assignmentId: a._id, seatId: a.seatId?._id, name: a.seatId?.name || '', slotLabel: slotLabel(a.slot) })),
      due: d ? { amount: d.amount, age: dueAge(d.since, now), since: d.since } : null,
    }
  })
}

export const toId = oid
export { fail }
export const isObjectId = (x) => mongoose.isValidObjectId(x)
