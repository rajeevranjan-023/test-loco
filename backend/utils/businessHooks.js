import mongoose from 'mongoose'
import Course from '../models/Course.js'
import Customer from '../models/Customer.js'
import Enrollment from '../models/Enrollment.js'
import Membership from '../models/Membership.js'
import SeatAssignment from '../models/SeatAssignment.js'
import StudyMember from '../models/StudyMember.js'
import { ensureMember, createMembership, applySeatLine, checkSeatRequest, latestMembership, windowOf, fail } from './studyService.js'
import { normSlot, findConflict } from './studyLogic.js'

const isId = (x) => mongoose.isValidObjectId(x)

// The seat part of a Membership or Seat Fee line: { seatId, slot, replaceAssignmentId? }.
// `replaceAssignmentId` is the member's OWN current assignment the seller explicitly chose to change (Billing: "Change seat").
function seatMeta(m, account) {
  if (!m.seatId) return { meta: {} }
  if (!isId(m.seatId)) return { error: 'That seat could not be found.' }
  const { slot, error } = normSlot(m.slot, windowOf(account))
  if (error) return { error }
  const out = { seatId: String(m.seatId), slot }
  if (m.replaceAssignmentId) { if (!isId(m.replaceAssignmentId)) return { error: 'That seat assignment could not be found.' }; out.replaceAssignmentId = String(m.replaceAssignmentId) }
  return { meta: out }
}

const studyHooks = {
  cleanMeta(item, type, account) {
    const m = item.meta && typeof item.meta === 'object' ? item.meta : {}
    if (type === 'membership') {
      const plan = (account.config?.plans || []).find((p) => p.key === m.planKey)
      const months = Math.floor(Number(m.months ?? plan?.months))
      if (!(months >= 1 && months <= 60)) return { error: 'Choose a membership plan (or enter the number of months).' }
      const out = { planKey: plan?.key || String(m.planKey || ''), months }
      if (m.startDate && !Number.isNaN(+new Date(m.startDate))) out.startDate = new Date(m.startDate).toISOString()
      if (m.renewsId) { if (!isId(m.renewsId)) return { error: 'That membership could not be found.' }; out.renewsId = String(m.renewsId) }
      const sm = seatMeta(m, account); if (sm.error) return { error: sm.error }
      return { meta: { ...out, ...sm.meta } }
    }
    if (type === 'seat') { // Seat Fee: a charge that may also book / keep / (on request) change the member's seat
      const sm = seatMeta(m, account); if (sm.error) return { error: sm.error }
      return { meta: sm.meta.seatId ? sm.meta : undefined }
    }
    if (type === 'course') {
      if (!isId(m.courseId)) return { meta: undefined } // a custom course fee without a catalogue course is allowed — it just creates no enrolment
      return { meta: { courseId: String(m.courseId) } }
    }
    return { meta: undefined }
  },

  // Runs BEFORE anything is written: every seat / renewal problem is refused here with a clear message.
  // (Seat assignment itself re-checks under a lock, so two requests that both pass this still cannot both win.)
  async validate({ account, lines, customerName }) {
    const name = String(customerName || '').trim()
    const cust = name ? await Customer.findOne({ shopId: account._id, name }).lean() : null
    const member = cust ? await StudyMember.findOne({ centerId: account._id, customerId: cust._id }).lean() : null

    // renewals: must point at THIS member's latest membership (renewing an old one would extend the wrong dates)
    for (const l of lines) {
      if (l.type !== 'membership' || !l.meta?.renewsId) continue
      const prev = await Membership.findOne({ _id: l.meta.renewsId, centerId: account._id }).lean()
      if (!prev || (member && String(prev.memberId) !== String(member._id))) throw fail(404, 'That membership could not be found.')
      const latest = await latestMembership(account, prev.memberId).lean()
      if (latest && String(latest._id) !== String(prev._id)) throw fail(409, 'This membership has already been renewed. Please refresh and renew the latest one.', 'MEMBERSHIP_ALREADY_RENEWED')
    }

    // a member holds ONE seat: every seat-bearing line on this bill must name the same seat + slot
    const asks = lines.filter((l) => l.meta?.seatId)
    let first = null
    for (const l of asks) {
      const slot = normSlot(l.meta.slot, windowOf(account)).slot
      if (!first) { first = { seatId: String(l.meta.seatId), slot, replace: l.meta.replaceAssignmentId || null }; continue }
      if (first.seatId !== String(l.meta.seatId) || first.slot.start !== slot.start || first.slot.end !== slot.end) throw fail(409, 'Only one seat can be assigned to a member on one bill. Remove the extra seat from this bill.', 'MEMBER_HAS_SEAT')
      first.replace = first.replace || l.meta.replaceAssignmentId || null
    }
    if (first) await checkSeatRequest(account, { member, seatId: first.seatId, slot: first.slot, replaceAssignmentId: first.replace })
  },

  async afterBill({ account, bill, lines, calc, customer }) {
    if (!customer) return
    const member = await ensureMember(account, customer)
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], total = calc.lines[i]?.total ?? 0
      if (l.type === 'membership' && l.meta) {
        const plan = (account.config?.plans || []).find((p) => p.key === l.meta.planKey) || { key: l.meta.planKey, name: l.name, months: l.meta.months, price: l.rate }
        const share = calc.subtotal > 0 ? total / calc.subtotal : 0
        const pending = Math.round(bill.unpaidAmount * share * 100) / 100
        const lineDiscount = Math.round(((calc.lines[i]?.discount || 0) + (calc.billDiscount || 0) * share) * 100) / 100
        const lineNet = Math.round(bill.totalAmount * share * 100) / 100
        await createMembership(account, {
          member, plan: { ...plan, months: l.meta.months, name: plan.name || l.name }, rate: l.rate, discount: lineDiscount, billId: bill.billId, paid: Math.max(Math.round((lineNet - pending) * 100) / 100, 0), pending,
          seatId: l.meta.seatId || null, slot: l.meta.slot || null, replaceAssignmentId: l.meta.replaceAssignmentId || null, renewsId: l.meta.renewsId || null, startDate: l.meta.startDate || null,
        })
      } else if (l.type === 'seat' && l.meta?.seatId) {
        const ms = await latestMembership(account, member._id).lean() // seat validity follows the membership; a Seat Fee never changes its dates
        await applySeatLine(account, { member, seatId: l.meta.seatId, slot: l.meta.slot, membershipId: ms?._id || null, replaceAssignmentId: l.meta.replaceAssignmentId || null, billId: bill.billId })
      } else if (l.type === 'course' && l.meta?.courseId) {
        const course = await Course.findOne({ _id: l.meta.courseId, centerId: account._id }).lean()
        if (course) await Enrollment.updateOne({ centerId: account._id, courseId: course._id, memberId: member._id }, { $setOnInsert: { billId: bill.billId, enrolledAt: new Date(), status: 'enrolled' } }, { upsert: true })
      }
    }
  },

  // A bill that failed half-way is rolled back EXACTLY: its memberships and seat assignments go, a seat it moved the member off is given back, and
  // seat links go back to the membership they pointed at before.
  async undo({ account, billId }) {
    const made = await Membership.find({ centerId: account._id, billId }).select('_id renewsId').lean()
    const created = await SeatAssignment.find({ centerId: account._id, billId }).lean()
    for (const a of created) {
      await SeatAssignment.deleteOne({ _id: a._id })
      if (a.replacesId) { // give the member their previous seat back — unless someone else has meanwhile taken an overlapping slot (then it stays released; never a double booking)
        const old = await SeatAssignment.findOne({ _id: a.replacesId, centerId: account._id, releasedBy: 'reassigned' }).lean()
        if (old && !findConflict(await SeatAssignment.find({ centerId: account._id, seatId: old.seatId, releasedAt: null }).lean(), old.slot)) await SeatAssignment.updateOne({ _id: old._id }, { $set: { releasedAt: null, releasedBy: null, releaseNote: '' } })
      }
    }
    for (const m of made) await SeatAssignment.updateMany({ centerId: account._id, membershipId: m._id }, { $set: { membershipId: m.renewsId || null } })
    await Membership.deleteMany({ centerId: account._id, billId })
    await Enrollment.deleteMany({ centerId: account._id, billId })
  },

  ensureParty: (account, customer) => ensureMember(account, customer),
}

const HOOKS = { study_center: studyHooks }
export const hooksFor = (sellerType) => HOOKS[sellerType] || {}
export { StudyMember }
