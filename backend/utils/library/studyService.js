// Study Center service layer — the database side of utils/studyLogic.js.
// Controllers (studyController.js) and the billing hook (businessHooks.js) both go through here, so the rules
// (slot conflicts · expiry never frees a seat · history is never deleted) live in exactly one place.
import mongoose from 'mongoose'
import Customer from '../../models/common/Customer.js'
import Udhar from '../../models/common/Udhar.js'
import Seat from '../../models/library/Seat.js'
import StudyMember from '../../models/library/StudyMember.js'
import Membership from '../../models/library/Membership.js'
import SeatAssignment from '../../models/library/SeatAssignment.js'
import StudyCenter from '../../models/library/StudyCenter.js'
import { normSlot, findConflict, seatState, seatSort, dueAge, memberStatus, DEFAULT_WINDOW, slotLabel, addMonths, renewalStart, STATE_COLOR } from './studyLogic.js'

const oid = (x) => (x && x._id ? x._id : x)
const fail = (status, message) => Object.assign(new Error(message), { status, expose: true }) // expose → errorHandler returns this message + status to the client
export const windowOf = (center) => ({ open: center?.config?.operatingHours?.open || DEFAULT_WINDOW.open, close: center?.config?.operatingHours?.close || DEFAULT_WINDOW.close })

// ───────── members ─────────
// STU001, STU002 … per centre. Atomic counter on the centre document.
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
export async function assertSlotFree(center, seatId, rawSlot, ignoreAssignmentId = null) {
  const { slot, error } = normSlot(rawSlot, windowOf(center))
  if (error) throw fail(400, error)
  const seat = await Seat.findOne({ _id: seatId, centerId: center._id }).lean()
  if (!seat) throw fail(404, 'Seat not found.')
  if (seat.disabled) throw fail(409, `Seat ${seat.name} is unavailable.`)
  const active = await SeatAssignment.find({ centerId: center._id, seatId, releasedAt: null }).lean()
  const clash = findConflict(active, slot, ignoreAssignmentId)
  if (clash) throw fail(409, `Seat ${seat.name} is already taken ${slotLabel(clash.slot)} — that overlaps ${slotLabel(slot)}.`)
  return { seat, slot }
}

export async function assignSeat(center, { seatId, member, slot: rawSlot, membershipId = null, startedAt = new Date() }) {
  const { seat, slot } = await assertSlotFree(center, seatId, rawSlot)
  const a = await SeatAssignment.create({ centerId: center._id, seatId: seat._id, memberId: member._id, customerId: member.customerId, membershipId, slot, startedAt })
  await StudyMember.updateOne({ _id: member._id }, { $set: { leftAt: null } })
  return { assignment: a, seat }
}

// Release = the ONLY way a seat becomes available again. Nothing is deleted: the row stays with releasedAt / releasedBy.
export async function releaseAssignment(center, assignmentId, { by = 'owner', note = '', now = new Date() } = {}) {
  const a = await SeatAssignment.findOneAndUpdate({ _id: assignmentId, centerId: center._id, releasedAt: null }, { $set: { releasedAt: now, releasedBy: by, releaseNote: String(note).slice(0, 200) } }, { new: true })
  if (!a) throw fail(404, 'That seat assignment is not active.')
  const left = await SeatAssignment.countDocuments({ centerId: center._id, memberId: a.memberId, releasedAt: null })
  if (!left) await StudyMember.updateOne({ _id: a.memberId }, { $set: { leftAt: now } })
  return a
}

// ───────── memberships ─────────
// New membership OR renewal. A renewal is a NEW row (history kept) that starts where the previous period ends (or today if it already lapsed).
// The seat assignment is kept when the renewal doesn't ask for a different seat / slot.
export async function createMembership(center, { member, plan, rate = null, discount = 0, billId = null, paid = 0, pending = 0, seatId = null, slot = null, renewsId = null, startDate = null, now = new Date() }) {
  const months = Math.max(Math.floor(Number(plan.months)), 1)
  let prev = null
  if (renewsId) prev = await Membership.findOne({ _id: renewsId, centerId: center._id, memberId: member._id })
  const start = startDate ? new Date(startDate) : prev ? renewalStart(prev.endDate, now) : now
  const ms = await Membership.create({
    centerId: center._id, memberId: member._id, customerId: member.customerId, planKey: plan.key || '', planName: plan.name || `${months} Month${months > 1 ? 's' : ''}`, months,
    startDate: start, endDate: addMonths(start, months), amount: rate ?? plan.price ?? 0, discount, amountPaid: paid, pending, billId, seatId: seatId || prev?.seatId || null, slot: slot || prev?.slot || null,
    kind: prev ? 'renewal' : 'new', renewsId: prev?._id || null,
  })
  // seat: keep the current assignment on renewal unless a different seat/slot was requested
  const current = await SeatAssignment.find({ centerId: center._id, memberId: member._id, releasedAt: null })
  const wantsSeat = seatId ? String(seatId) : null
  if (wantsSeat) {
    const same = current.find((a) => String(a.seatId) === wantsSeat && (!slot || (a.slot.start === normSlot(slot, windowOf(center)).slot?.start && a.slot.end === normSlot(slot, windowOf(center)).slot?.end)))
    if (same) await SeatAssignment.updateOne({ _id: same._id }, { $set: { membershipId: ms._id } })
    else {
      const { assignment } = await assignSeat(center, { seatId: wantsSeat, member, slot: slot || { fullDay: true }, membershipId: ms._id, startedAt: now })
      // moving seats: the previous assignment(s) of this membership chain end (kept in history)
      for (const a of current) await releaseAssignment(center, a._id, { by: 'reassigned', note: 'Moved to another seat', now })
      return { membership: ms, assignment }
    }
  } else if (current.length) await SeatAssignment.updateMany({ _id: { $in: current.map((a) => a._id) } }, { $set: { membershipId: ms._id } })
  return { membership: ms, assignment: null }
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
