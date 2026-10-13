import mongoose from 'mongoose'
import Course from '../models/Course.js'
import Enrollment from '../models/Enrollment.js'
import Membership from '../models/Membership.js'
import SeatAssignment from '../models/SeatAssignment.js'
import StudyMember from '../models/StudyMember.js'
import { ensureMember, createMembership, assertSlotFree, windowOf } from './studyService.js'
import { normSlot } from './studyLogic.js'

const isId = (x) => mongoose.isValidObjectId(x)
const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })

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
      if (m.seatId) {
        if (!isId(m.seatId)) return { error: 'That seat could not be found.' }
        const { slot, error } = normSlot(m.slot, windowOf(account))
        if (error) return { error }
        out.seatId = String(m.seatId); out.slot = slot
      }
      return { meta: out }
    }
    if (type === 'course') {
      if (!isId(m.courseId)) return { meta: undefined } // a custom course fee without a catalogue course is allowed — it just creates no enrolment
      return { meta: { courseId: String(m.courseId) } }
    }
    return { meta: undefined }
  },

  async validate({ account, lines }) {
    const claimed = []
    for (const l of lines) {
      if (l.type !== 'membership' || !l.meta?.seatId) continue
      const { slot } = await assertSlotFree(account, l.meta.seatId, l.meta.slot, null).catch(async (e) => {
        // a renewal that keeps the member's own current seat is fine — it is that member's own assignment
        if (e.status === 409 && l.meta.renewsId) {
          const prev = await Membership.findOne({ _id: l.meta.renewsId, centerId: account._id }).lean()
          const mine = prev && (await SeatAssignment.findOne({ centerId: account._id, seatId: l.meta.seatId, memberId: prev.memberId, releasedAt: null }).lean())
          if (mine) return { slot: normSlot(l.meta.slot, windowOf(account)).slot }
        }
        throw e
      })
      for (const c of claimed) if (String(c.seatId) === String(l.meta.seatId) && slot.start < c.slot.end && c.slot.start < slot.end) throw fail(409, 'The same seat and time slot is on this bill twice.')
      claimed.push({ seatId: l.meta.seatId, slot })
    }
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
          seatId: l.meta.seatId || null, slot: l.meta.slot || null, renewsId: l.meta.renewsId || null, startDate: l.meta.startDate || null,
        })
      } else if (l.type === 'course' && l.meta?.courseId) {
        const course = await Course.findOne({ _id: l.meta.courseId, centerId: account._id }).lean()
        if (course) await Enrollment.updateOne({ centerId: account._id, courseId: course._id, memberId: member._id }, { $setOnInsert: { billId: bill.billId, enrolledAt: new Date(), status: 'enrolled' } }, { upsert: true })
      }
    }
  },

  async undo({ account, billId }) {
    const made = await Membership.find({ centerId: account._id, billId }).select('_id').lean()
    if (made.length) {
      await SeatAssignment.deleteMany({ centerId: account._id, membershipId: { $in: made.map((m) => m._id) }, releasedAt: null, startedAt: { $gte: new Date(Date.now() - 6e4) } })
      await Membership.deleteMany({ centerId: account._id, billId })
    }
    await Enrollment.deleteMany({ centerId: account._id, billId })
  },

  ensureParty: (account, customer) => ensureMember(account, customer),
}

const HOOKS = { study_center: studyHooks }
export const hooksFor = (sellerType) => HOOKS[sellerType] || {}
export { StudyMember }
