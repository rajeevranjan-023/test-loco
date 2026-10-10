import mongoose from 'mongoose'
import Customer from '../models/Customer.js'
import Bill from '../models/Bill.js'
import UdharHistory from '../models/UdharHistory.js'
import Seat from '../models/Seat.js'
import StudyMember from '../models/StudyMember.js'
import StudyCenter from '../models/StudyCenter.js'
import Membership from '../models/Membership.js'
import SeatAssignment from '../models/SeatAssignment.js'
import Course from '../models/Course.js'
import Enrollment from '../models/Enrollment.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { PHONE_RE, touchGlobalUser } from '../utils/globalUser.js'
import { ensureMember, seatBoard, memberRows, assignSeat, assertSlotFree, releaseAssignment, duesOf, windowOf, fail } from '../utils/studyService.js'
import { studyDashboard, studyAnalytics } from '../utils/studyReports.js'
import { buildSeatNames, normSlot, slotLabel, dueAge, memberStatus, renewalStart, addMonths, toMin } from '../utils/studyLogic.js'
import { displayBillId } from '../utils/billId.js'
import { normalizeUsername } from '../utils/username.js'
import { escapeRegex } from '../utils/escapeRegex.js'

const center = (req) => req.sellerAccount
const cid = (req) => req.sellerAccount._id
const bad = (res, message, status = 400) => res.status(status).json({ message })
const esc = escapeRegex
const findMember = (req, id, lean = false) => { const q = mongoose.isValidObjectId(id) ? StudyMember.findOne({ centerId: cid(req), $or: [{ _id: id }, { customerId: id }] }) : null; return q ? (lean ? q.lean() : q) : null } // StudyMember id OR shared Customer id
const slugKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

// ───────────────────────── configuration lists (zones · seat types · time slots · plans · charge types · materials) ─────────────────────────
// ONE generic endpoint family, so "Add Seat Zone", "Add Time Slot", "Add Membership Plan" … are all the same code with a different cleaner.
const LISTS = {
  zones: (b) => { const name = String(b.name || '').trim().slice(0, 30); return name ? { key: slugKey(b.key || name), name } : { error: 'Zone name is required.' } },
  seatTypes: (b) => { const name = String(b.name || '').trim().slice(0, 30); return name ? { key: slugKey(b.key || name), name } : { error: 'Seat type name is required.' } },
  timeSlots: (b, c) => {
    const { slot, error } = normSlot({ start: b.start, end: b.end }, windowOf(c))
    if (error) return { error }
    const label = String(b.label || '').trim().slice(0, 30) || slotLabel(slot)
    return { key: slugKey(b.key || label), label, start: slot.start, end: slot.end }
  },
  plans: (b) => {
    const name = String(b.name || '').trim().slice(0, 40), months = Math.floor(Number(b.months)), price = Number(b.price)
    if (!name) return { error: 'Plan name is required.' }
    if (!(months >= 1 && months <= 60)) return { error: 'Duration must be 1 to 60 months.' }
    if (!(price >= 0)) return { error: 'Price must be 0 or more.' }
    return { key: slugKey(b.key || name), name, months, price, active: b.active !== false }
  },
  chargeTypes: (b) => {
    const label = String(b.label || '').trim().slice(0, 40), amount = Number(b.amount || 0)
    if (!label) return { error: 'Charge name is required.' }
    if (!(amount >= 0)) return { error: 'Amount must be 0 or more.' }
    return { key: slugKey(b.key || label), label, kind: ['fine', 'registration', 'other'].includes(b.kind) ? b.kind : 'fine', amount }
  },
  materials: (b) => {
    const name = String(b.name || '').trim().slice(0, 60), price = Number(b.price || 0)
    if (!name) return { error: 'Name is required.' }
    if (!(price >= 0)) return { error: 'Price must be 0 or more.' }
    return { key: slugKey(b.key || name), name, kind: ['book', 'notes', 'stationery', 'other'].includes(b.kind) ? b.kind : 'book', price }
  },
}
const listField = (req, res) => { const f = req.params.list; if (!LISTS[f]) { bad(res, 'Unknown configuration list.', 404); return null } return f }

export const getConfig = asyncHandler(async (req, res) => {
  const c = center(req)
  res.json({ config: c.config, window: windowOf(c), seatCount: await Seat.countDocuments({ centerId: cid(req) }) })
})

export const updateConfig = asyncHandler(async (req, res) => {
  const c = center(req), { operatingHours, features, memberPrefix } = req.body
  if (operatingHours) {
    const a = toMin(operatingHours.open), b = toMin(operatingHours.close)
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return bad(res, 'Closing time must be after opening time.')
    c.config.operatingHours = { open: operatingHours.open, close: operatingHours.close }
  }
  if (features && typeof features === 'object') { // explicit capability switches (e.g. turn on inventory / products for a centre that sells stationery)
    const next = { ...(c.config.features || {}) }
    for (const k of ['inventory', 'products']) if (typeof features[k] === 'boolean') next[k] = features[k]
    c.config.features = next; c.markModified('config.features')
  }
  if (memberPrefix !== undefined) c.config.memberPrefix = String(memberPrefix).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'STU'
  await c.save()
  res.json({ config: c.config })
})

export const addToList = asyncHandler(async (req, res) => {
  const f = listField(req, res); if (!f) return
  const c = center(req), r = LISTS[f](req.body, c)
  if (r.error) return bad(res, r.error)
  if (!r.key) return bad(res, 'Please enter a name.')
  if (c.config[f].some((x) => x.key === r.key)) return bad(res, 'That name already exists.', 409)
  c.config[f].push(r); await c.save()
  res.status(201).json({ [f]: c.config[f] })
})
export const updateInList = asyncHandler(async (req, res) => {
  const f = listField(req, res); if (!f) return
  const c = center(req), i = c.config[f].findIndex((x) => x.key === req.params.key)
  if (i < 0) return bad(res, 'Not found.', 404)
  const r = LISTS[f]({ ...c.config[f][i].toObject?.() , ...req.body, key: req.params.key }, c)
  if (r.error) return bad(res, r.error)
  c.config[f][i] = r; await c.save()
  res.json({ [f]: c.config[f] })
})
export const removeFromList = asyncHandler(async (req, res) => {
  const f = listField(req, res); if (!f) return
  const c = center(req)
  if (f === 'zones' && (await Seat.exists({ centerId: cid(req), zone: req.params.key }))) return bad(res, 'Move or delete the seats in this zone first.', 409)
  if (f === 'seatTypes' && (await Seat.exists({ centerId: cid(req), type: req.params.key }))) return bad(res, 'Seats still use this type.', 409)
  if (f === 'plans') { const p = c.config.plans.find((x) => x.key === req.params.key); if (p) { p.active = false; await c.save(); return res.json({ plans: c.config.plans }) } } // plans are deactivated, never erased (old memberships name them)
  c.config[f] = c.config[f].filter((x) => x.key !== req.params.key); await c.save()
  res.json({ [f]: c.config[f] })
})

// ───────────────────────── seats ─────────────────────────
export const listSeats = asyncHandler(async (req, res) => res.json(await seatBoard(center(req))))

// POST /study/seats  { naming: { mode: 'grid'|'sequence'|'custom', … }, zone, type }  — creates a block of seats with the owner's own naming
export const createSeats = asyncHandler(async (req, res) => {
  const c = center(req), { naming, zone, type } = req.body
  const { names, error } = buildSeatNames(naming)
  if (error) return bad(res, error)
  if (zone && !c.config.zones.some((z) => z.key === zone)) return bad(res, 'Unknown zone.')
  if (type && !c.config.seatTypes.some((t) => t.key === type)) return bad(res, 'Unknown seat type.')
  const existing = await Seat.find({ centerId: cid(req), name: { $in: names.map((n) => new RegExp(`^${esc(n)}$`, 'i')) } }).select('name').lean()
  if (existing.length) return bad(res, `Already exists: ${existing.slice(0, 5).map((s) => s.name).join(', ')}${existing.length > 5 ? '…' : ''}`, 409)
  const base = await Seat.countDocuments({ centerId: cid(req) })
  await Seat.insertMany(names.map((name, i) => ({ centerId: cid(req), name, zone: zone || c.config.zones[0]?.key || '', type: type || c.config.seatTypes[0]?.key || 'regular', order: base + i })))
  c.config.lastNaming = naming; c.markModified('config.lastNaming'); await c.save()
  res.status(201).json({ created: names.length, names })
})

export const updateSeat = asyncHandler(async (req, res) => {
  const c = center(req), seat = await Seat.findOne({ _id: req.params.id, centerId: cid(req) })
  if (!seat) return bad(res, 'Seat not found.', 404)
  const { name, zone, type, disabled, note } = req.body
  if (name !== undefined) {
    const n = String(name).trim().slice(0, 24); if (!n) return bad(res, 'Seat name cannot be empty.')
    if (n.toLowerCase() !== seat.name.toLowerCase() && (await Seat.exists({ centerId: cid(req), name: new RegExp(`^${esc(n)}$`, 'i') }))) return bad(res, `Seat "${n}" already exists.`, 409)
    seat.name = n
  }
  if (zone !== undefined) { if (zone && !c.config.zones.some((z) => z.key === zone)) return bad(res, 'Unknown zone.'); seat.zone = zone }
  if (type !== undefined) { if (!c.config.seatTypes.some((t) => t.key === type)) return bad(res, 'Unknown seat type.'); seat.type = type }
  if (disabled !== undefined) {
    if (disabled && (await SeatAssignment.exists({ centerId: cid(req), seatId: seat._id, releasedAt: null }))) return bad(res, 'Release this seat before marking it unavailable.', 409)
    seat.disabled = !!disabled
  }
  if (note !== undefined) seat.note = String(note).slice(0, 200)
  await seat.save()
  res.json({ id: seat._id, name: seat.name })
})

export const deleteSeat = asyncHandler(async (req, res) => {
  if (await SeatAssignment.exists({ centerId: cid(req), seatId: req.params.id })) return bad(res, 'This seat has assignment history — mark it unavailable instead of deleting it.', 409)
  const r = await Seat.deleteOne({ _id: req.params.id, centerId: cid(req) })
  r.deletedCount ? res.json({ ok: true }) : bad(res, 'Seat not found.', 404)
})

// POST /study/seats/:id/assign  { memberId, slot?, fullDay? }   — put an existing member on a seat (conflicts are refused)
export const assignToSeat = asyncHandler(async (req, res) => {
  const member = await StudyMember.findOne({ _id: req.body.memberId, centerId: cid(req) })
  if (!member) return bad(res, 'Member not found.', 404)
  const { assignment, seat } = await assignSeat(center(req), { seatId: req.params.id, member, slot: req.body.fullDay ? { fullDay: true } : req.body.slot, membershipId: req.body.membershipId || null })
  res.status(201).json({ assignmentId: assignment._id, seat: seat.name })
})

// POST /study/assignments/:id/release  { note }  — the explicit "Release Seat". History is kept.
export const releaseSeat = asyncHandler(async (req, res) => {
  const a = await releaseAssignment(center(req), req.params.id, { by: 'owner', note: req.body.note })
  res.json({ ok: true, releasedAt: a.releasedAt })
})
// POST /study/assignments/release  { ids: [...] }  — bulk "Mark as Released" from the seat table
export const releaseMany = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 200) : []
  if (!ids.length) return bad(res, 'Select at least one seat.')
  let n = 0
  for (const id of ids) { try { await releaseAssignment(center(req), id, { by: 'owner', note: req.body.note }); n++ } catch { /* already released */ } }
  res.json({ released: n })
})
// POST /study/assignments/:id/reassign  { seatId, slot? }  — move a member to another seat; the new spot is checked BEFORE the old one is released
export const reassign = asyncHandler(async (req, res) => {
  const c = center(req), old = await SeatAssignment.findOne({ _id: req.params.id, centerId: cid(req), releasedAt: null })
  if (!old) return bad(res, 'That seat assignment is not active.', 404)
  const member = await StudyMember.findById(old.memberId)
  const slot = req.body.slot || old.slot
  await assertSlotFree(c, req.body.seatId, slot)
  await releaseAssignment(c, old._id, { by: 'reassigned', note: 'Moved to another seat' })
  const { assignment, seat } = await assignSeat(c, { seatId: req.body.seatId, member, slot, membershipId: old.membershipId })
  res.json({ assignmentId: assignment._id, seat: seat.name })
})

// ───────────────────────── members ─────────────────────────
export const listMembers = asyncHandler(async (req, res) => {
  let rows = await memberRows(center(req))
  const q = String(req.query.q || '').trim().toLowerCase(), st = String(req.query.status || '')
  if (q) rows = rows.filter((m) => m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.memberCode.toLowerCase().includes(q) || (m.className || '').toLowerCase().includes(q))
  if (st && st !== 'All') rows = rows.filter((m) => m.status === st)
  res.json(rows)
})

const memberBody = (b) => ({ name: String(b.name || '').trim().slice(0, 80), phone: String(b.phone || '').trim(), email: String(b.email || '').trim().toLowerCase().slice(0, 80), className: String(b.className || '').trim().slice(0, 40), notes: String(b.notes || '').slice(0, 500) })

export const createMember = asyncHandler(async (req, res) => {
  const c = center(req), m = memberBody(req.body)
  if (!m.name) return bad(res, 'Member name is required.')
  if (m.phone && !PHONE_RE.test(m.phone)) return bad(res, 'Mobile number must be 10 digits.')
  if (m.phone && (await Customer.exists({ shopId: cid(req), phone: m.phone }))) return bad(res, 'A member with this mobile number already exists.', 409)
  const cust = await Customer.findOneAndUpdate({ shopId: cid(req), name: m.name }, { $setOnInsert: { shopId: cid(req), name: m.name }, ...(m.phone ? { $set: { phone: m.phone } } : {}) }, { upsert: true, new: true })
  if (m.phone) { const g = await touchGlobalUser(m.phone, m.name, 0).catch(() => null); if (g && String(cust.globalUserId) !== String(g._id)) { cust.globalUserId = g._id; await cust.save() } }
  const member = await ensureMember(c, cust, m)
  res.status(201).json({ id: member._id, customerId: cust._id, memberCode: member.memberCode, name: member.name })
})

export const updateMember = asyncHandler(async (req, res) => {
  const member = await findMember(req, req.params.id)
  if (!member) return bad(res, 'Member not found.', 404)
  const b = req.body, m = memberBody({ ...member.toObject(), ...b })
  if (!m.name) return bad(res, 'Member name is required.')
  if (m.phone && !PHONE_RE.test(m.phone)) return bad(res, 'Mobile number must be 10 digits.')
  if (m.phone && m.phone !== member.phone && (await Customer.exists({ shopId: cid(req), phone: m.phone, _id: { $ne: member.customerId } }))) return bad(res, 'Another member already has this mobile number.', 409)
  Object.assign(member, m)
  if (b.inactive !== undefined) member.inactive = !!b.inactive
  await member.save()
  await Customer.updateOne({ _id: member.customerId, shopId: cid(req) }, { $set: { name: m.name, phone: m.phone } })
  res.json({ ok: true })
})

// GET /study/members/:id — the whole member page in one response
export const memberDetail = asyncHandler(async (req, res) => {
  const c = center(req), now = new Date()
  const member = await findMember(req, req.params.id, true)
  if (!member) return bad(res, 'Member not found.', 404)
  const [row, memberships, assignments, bills, ledger, enrollments] = await Promise.all([
    memberRows(c).then((r) => r.find((x) => String(x.id) === String(member._id))),
    Membership.find({ centerId: cid(req), memberId: member._id }).sort({ startDate: -1 }).lean(),
    SeatAssignment.find({ centerId: cid(req), memberId: member._id }).sort({ startedAt: -1 }).populate('seatId', 'name zone').lean(),
    Bill.find({ shopId: cid(req), customerId: member.customerId }).sort({ createdAt: -1 }).limit(50).lean(),
    UdharHistory.find({ shopId: cid(req), customerId: member.customerId }).sort({ date: -1 }).limit(60).lean(),
    Enrollment.find({ centerId: cid(req), memberId: member._id }).populate('courseId', 'name fee duration').lean(),
  ])
  const dues = await duesOf(cid(req), [member.customerId]), d = dues.get(String(member.customerId))
  res.json({
    member: { ...row, notes: member.notes, inactive: !!member.inactive, leftAt: member.leftAt, customerId: member.customerId },
    due: d ? { amount: d.amount, since: d.since, age: dueAge(d.since, now) } : null,
    memberships: memberships.map((m) => ({ id: m._id, plan: m.planName, months: m.months, startDate: m.startDate, endDate: m.endDate, amount: m.amount, discount: m.discount, paid: m.amountPaid, pending: m.pending, kind: m.kind, billId: m.billId, bill: m.billId ? displayBillId(m.billId, '#BILL') : '', expired: +new Date(m.endDate) < +now, slot: m.slot ? slotLabel(m.slot) : '' })),
    seatHistory: assignments.map((a) => ({ id: a._id, seat: a.seatId?.name || '—', slot: slotLabel(a.slot), startedAt: a.startedAt, releasedAt: a.releasedAt, releasedBy: a.releasedBy, active: !a.releasedAt, releaseRequestedAt: a.releaseRequestedAt })),
    bills: bills.map((b) => ({ billId: b.billId, id: displayBillId(b.billId, '#BILL'), date: b.createdAt, type: b.transactionType, items: (b.items || []).map((i) => i.name).join(', '), amount: b.totalAmount, paid: b.paidAmount, due: b.unpaidAmount })),
    payments: ledger.map((e) => ({ id: e._id, type: e.type, amount: e.amount, delta: e.delta, date: e.date, method: e.paymentType, note: e.note, billId: e.billId, balanceAfter: e.balanceAfter })),
    courses: enrollments.map((e) => ({ id: e._id, course: e.courseId?.name || '—', fee: e.courseId?.fee || 0, duration: e.courseId?.duration || '', enrolledAt: e.enrolledAt, status: e.status })),
  })
})

// GET /study/members/:id/renewal-offer — everything the billing screen needs to pre-fill a renewal (it is billed like any other membership)
export const renewalOffer = asyncHandler(async (req, res) => {
  const c = center(req), member = await findMember(req, req.params.id, true)
  if (!member) return bad(res, 'Member not found.', 404)
  const prev = await Membership.findOne({ centerId: cid(req), memberId: member._id }).sort({ endDate: -1 }).lean()
  if (!prev) return bad(res, 'This member has no membership to renew yet.', 404)
  const seat = await SeatAssignment.findOne({ centerId: cid(req), memberId: member._id, releasedAt: null }).populate('seatId', 'name').lean()
  const plan = c.config.plans.find((p) => p.key === prev.planKey) || c.config.plans.find((p) => p.months === prev.months) || null
  const start = renewalStart(prev.endDate)
  res.json({
    customerId: member.customerId, memberId: member._id, name: member.name, phone: member.phone,
    renewsId: prev._id, previousEnd: prev.endDate, newStart: start, planKey: plan?.key || '', months: prev.months, price: plan?.price ?? prev.amount, newEnd: addMonths(start, prev.months),
    seat: seat ? { seatId: seat.seatId._id, name: seat.seatId.name, slot: seat.slot } : null,
  })
})

// ───────────────────────── courses ─────────────────────────
const courseBody = (b) => ({ name: String(b.name || '').trim().slice(0, 80), description: String(b.description || '').slice(0, 500), duration: String(b.duration || '').trim().slice(0, 40), fee: Number(b.fee), instructor: String(b.instructor || '').trim().slice(0, 60), capacity: Math.max(Math.floor(Number(b.capacity) || 0), 0), status: b.status === 'inactive' ? 'inactive' : 'active' })
export const listCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ centerId: cid(req) }).sort({ status: 1, name: 1 }).lean()
  const counts = await Enrollment.aggregate([{ $match: { centerId: cid(req), status: 'enrolled' } }, { $group: { _id: '$courseId', n: { $sum: 1 } } }])
  const n = Object.fromEntries(counts.map((x) => [String(x._id), x.n]))
  res.json(courses.map((c) => ({ id: c._id, name: c.name, description: c.description, duration: c.duration, fee: c.fee, instructor: c.instructor, capacity: c.capacity, status: c.status, enrolled: n[String(c._id)] || 0 })))
})
export const createCourse = asyncHandler(async (req, res) => {
  const b = courseBody(req.body)
  if (!b.name) return bad(res, 'Course name is required.')
  if (!(b.fee >= 0)) return bad(res, 'Enter a valid fee.')
  if (await Course.exists({ centerId: cid(req), name: new RegExp(`^${esc(b.name)}$`, 'i') })) return bad(res, 'A course with this name already exists.', 409)
  const c = await Course.create({ ...b, centerId: cid(req) })
  res.status(201).json({ id: c._id })
})
export const updateCourse = asyncHandler(async (req, res) => {
  const c = await Course.findOne({ _id: req.params.id, centerId: cid(req) })
  if (!c) return bad(res, 'Course not found.', 404)
  const b = courseBody({ ...c.toObject(), ...req.body })
  if (!b.name) return bad(res, 'Course name is required.')
  if (!(b.fee >= 0)) return bad(res, 'Enter a valid fee.')
  Object.assign(c, b); await c.save()
  res.json({ ok: true })
})
export const deleteCourse = asyncHandler(async (req, res) => {
  const c = await Course.findOne({ _id: req.params.id, centerId: cid(req) })
  if (!c) return bad(res, 'Course not found.', 404)
  if (await Enrollment.exists({ centerId: cid(req), courseId: c._id })) { c.status = 'inactive'; await c.save(); return res.json({ ok: true, deactivated: true }) } // enrolled members keep their history
  await c.deleteOne(); res.json({ ok: true })
})
export const courseEnrollments = asyncHandler(async (req, res) => {
  const rows = await Enrollment.find({ centerId: cid(req), courseId: req.params.id }).populate('memberId', 'name memberCode phone').sort({ enrolledAt: -1 }).lean()
  res.json(rows.map((e) => ({ id: e._id, memberId: e.memberId?._id, name: e.memberId?.name, memberCode: e.memberId?.memberCode, phone: e.memberId?.phone, enrolledAt: e.enrolledAt, status: e.status })))
})

// ───────────────────────── dashboard · analytics ─────────────────────────
export const dashboard = asyncHandler(async (req, res) => res.json(await studyDashboard(center(req))))
export const analytics = asyncHandler(async (req, res) => res.json(await studyAnalytics(center(req), req.query.days)))

// ───────────────────────── billing helpers: what the billing screen can pick ─────────────────────────
// GET /study/billing/catalog — plans · free seats · courses · materials · charge types, in one call
export const billingCatalog = asyncHandler(async (req, res) => {
  const c = center(req), [board, courses] = await Promise.all([seatBoard(c), Course.find({ centerId: cid(req), status: 'active' }).sort({ name: 1 }).lean()])
  res.json({
    window: board.window, timeSlots: c.config.timeSlots, plans: c.config.plans.filter((p) => p.active !== false),
    seats: board.seats.filter((s) => s.state !== 'unavailable').map((s) => ({ id: s.id, name: s.name, zone: s.zoneName, state: s.state, busy: s.people.map((p) => ({ start: p.slot.start, end: p.slot.end, label: p.slotLabel })) })),
    courses: courses.map((x) => ({ id: x._id, name: x.name, fee: x.fee })), materials: c.config.materials, chargeTypes: c.config.chargeTypes,
  })
})

// ───────────────────────── member self-service (consumer account) ─────────────────────────
// A Loco user whose account is linked to a Member record (by userId, or by the same mobile number) can ask to leave.
// Nothing is deleted or released automatically: the request is flagged and the centre owner confirms with "Release Seat".
const myMembers = async (user, centerId = null) => {
  const or = [{ userId: user._id }, ...(user.phone && PHONE_RE.test(String(user.phone).replace(/\D/g, '').slice(-10)) ? [{ phone: String(user.phone).replace(/\D/g, '').slice(-10) }] : [])]
  return StudyMember.find({ $or: or, ...(centerId ? { centerId } : {}) }).lean()
}
export const mySeats = asyncHandler(async (req, res) => {
  const members = await myMembers(req.user)
  const rows = await SeatAssignment.find({ memberId: { $in: members.map((m) => m._id) }, releasedAt: null }).populate('seatId', 'name').populate('centerId', 'centerName username').lean()
  res.json(rows.map((a) => ({ assignmentId: a._id, seat: a.seatId?.name, slot: slotLabel(a.slot), center: a.centerId?.centerName, username: a.centerId?.username, releaseRequestedAt: a.releaseRequestedAt })))
})
export const requestRelease = asyncHandler(async (req, res) => {
  const centerDoc = await StudyCenter.findOne({ username: normalizeUsername(req.body.username) }).select('_id')
  if (!centerDoc) return bad(res, 'Study center not found.', 404)
  const members = await myMembers(req.user, centerDoc._id)
  if (!members.length) return bad(res, 'You are not registered as a member of this study center.', 403)
  const r = await SeatAssignment.updateMany({ centerId: centerDoc._id, memberId: { $in: members.map((m) => m._id) }, releasedAt: null, releaseRequestedAt: null }, { $set: { releaseRequestedAt: new Date() } })
  res.json({ ok: true, requested: r.modifiedCount, message: 'Your request was sent. The center owner will confirm and release your seat.' })
})

export { fail, memberStatus }
