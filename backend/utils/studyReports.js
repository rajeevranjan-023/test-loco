// Study Center dashboard · analytics · notifications. Every number is computed from real documents
// (Bill · Udhar ledger · StudyMember · Membership · SeatAssignment) — there is no placeholder or sample data in here.
//
// The analytics *configuration* (which KPI cards and charts exist, their labels and formats) is returned together with the data,
// so the frontend renders any business's analytics from config alone (see frontend ConfigAnalytics).
import Bill from '../models/Bill.js'
import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import StudyMember from '../models/library/StudyMember.js'
import Membership from '../models/library/Membership.js'
import SeatAssignment from '../models/library/SeatAssignment.js'
import { seatBoard, memberRows, windowOf } from './studyService.js'
import { toMin, DAY, dueAge } from './studyLogic.js'

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const startOfMonth = (d = new Date()) => { const x = startOfDay(d); x.setDate(1); return x }
const sum = (a, f) => r2(a.reduce((t, x) => t + (f(x) || 0), 0))
const live = (shopId, extra = {}) => ({ shopId, orderStatus: { $ne: 'Cancelled' }, cancelledAt: null, ...extra })

// revenue by group, from the per-bill revenue split (net of discount, excluding tax)
const REV_GROUP = { membership: ['membership', 'registration', 'seat'], course: ['course'], other: ['book', 'fine', 'other', 'product', 'material', 'service', 'labour'] }
export const revenueOf = (b) => {
  const rv = b.revenue || {}, out = {}
  for (const [g, keys] of Object.entries(REV_GROUP)) out[g] = r2(keys.reduce((t, k) => t + (rv[k] || 0), 0))
  return out
}

// money actually received over a period: what was paid at billing (minus advance used) + payments recorded against old dues
async function collections(shopId, from, to) {
  const bills = await Bill.find(live(shopId, { createdAt: { $gte: from, $lt: to } })).select('paidAmount creditUsed').lean()
  const atBilling = sum(bills, (b) => (b.paidAmount || 0) - (b.creditUsed || 0))
  const pays = await UdharHistory.find({ shopId, type: 'payment', date: { $gte: from, $lt: to } }).select('amount').lean()
  return r2(atBilling + sum(pays, (p) => p.amount))
}

const outstanding = async (shopId) => {
  const rows = await Udhar.find({ shopId, totalAmount: { $gt: 0.005 } }).select('totalAmount').lean()
  return { amount: sum(rows, (u) => u.totalAmount), members: rows.length }
}

// ───────── notifications (bell) ─────────
export async function studyNotifications(center) {
  const now = new Date(), soon = new Date(+now + 7 * DAY)
  const [expiring, overdue, requests] = await Promise.all([
    Membership.aggregate([{ $match: { centerId: center._id } }, { $sort: { endDate: -1 } }, { $group: { _id: '$memberId', end: { $first: '$endDate' } } }, { $match: { end: { $gte: now, $lte: soon } } }, { $count: 'n' }]),
    Udhar.countDocuments({ shopId: center._id, totalAmount: { $gt: 0 }, pendingSince: { $lt: new Date(+now - 7 * DAY) } }),
    SeatAssignment.countDocuments({ centerId: center._id, releasedAt: null, releaseRequestedAt: { $ne: null } }),
  ])
  const n = expiring[0]?.n || 0
  return [
    ...(requests ? [{ text: `${requests} seat release request${requests > 1 ? 's' : ''} waiting for you`, to: '/seats' }] : []),
    ...(n ? [{ text: `${n} membership${n > 1 ? 's' : ''} expiring in 7 days`, to: '/members' }] : []),
    ...(overdue ? [{ text: `${overdue} member${overdue > 1 ? 's' : ''} with dues pending 7+ days`, to: '/dues' }] : []),
  ]
}

// ───────── dashboard ─────────
export const STUDY_DASHBOARD_CONFIG = {
  cards: [
    { key: 'totalMembers', label: 'Total Members', format: 'number', tone: 'blue' },
    { key: 'activeMembers', label: 'Active Members', format: 'number', tone: 'green' },
    { key: 'expiredMemberships', label: 'Expired Memberships', format: 'number', tone: 'red' },
    { key: 'totalSeats', label: 'Total Seats', format: 'number', tone: 'gray' },
    { key: 'occupiedSeats', label: 'Occupied Seats', format: 'number', tone: 'green' },
    { key: 'partialSeats', label: 'Partially Occupied', format: 'number', tone: 'orange' },
    { key: 'emptySeats', label: 'Empty Seats', format: 'number', tone: 'red' },
    { key: 'pendingAmount', label: 'Pending Amount', format: 'money', tone: 'red', sub: 'pendingMembers' },
    { key: 'todaysCollections', label: "Today's Collections", format: 'money', tone: 'green' },
    { key: 'monthlyRevenue', label: 'Monthly Revenue', format: 'money', tone: 'blue' },
  ],
}

export async function studyDashboard(center) {
  const now = new Date(), today = startOfDay(now), monthStart = startOfMonth(now)
  const [board, members, todays, monthBills, due] = await Promise.all([
    seatBoard(center, { now }), memberRows(center, { now }),
    collections(center._id, today, new Date(+today + DAY)),
    Bill.find(live(center._id, { createdAt: { $gte: monthStart } })).select('revenue totalAmount taxAmount').lean(),
    outstanding(center._id),
  ])
  const s = board.summary
  const upcoming = members.filter((m) => m.endDate && +new Date(m.endDate) >= +now && +new Date(m.endDate) <= +now + 14 * DAY && !['Released', 'Inactive'].includes(m.status)).sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate)).slice(0, 6)
  const recentRelease = await SeatAssignment.find({ centerId: center._id, releasedAt: { $ne: null } }).sort({ releasedAt: -1 }).limit(5).populate('seatId', 'name').populate('memberId', 'name').lean()
  return {
    config: STUDY_DASHBOARD_CONFIG,
    cards: {
      totalMembers: members.length, activeMembers: members.filter((m) => ['Active', 'Partially Active', 'Pending Payment'].includes(m.status)).length,
      expiredMemberships: members.filter((m) => m.status === 'Membership Expired').length,
      totalSeats: s.total, occupiedSeats: s.occupied, partialSeats: s.partial, emptySeats: s.empty,
      pendingAmount: due.amount, pendingMembers: due.members, todaysCollections: todays,
      monthlyRevenue: sum(monthBills, (b) => (b.revenue ? Object.values(b.revenue).reduce((t, v) => t + (v || 0), 0) : (b.totalAmount || 0) - (b.taxAmount || 0))),
    },
    occupancy: { occupied: s.occupied, partial: s.partial, empty: s.empty, unavailable: s.unavailable, total: s.total, occupiedPct: s.occupiedPct, partialPct: s.partialPct, emptyPct: s.emptyPct },
    upcomingExpiries: upcoming.map((m) => ({ id: m.id, name: m.name, memberCode: m.memberCode, endDate: m.endDate, plan: m.plan, seats: m.seats.map((x) => x.name).join(', '), due: m.due })),
    recentMembers: members.slice(0, 6).map((m) => ({ id: m.id, name: m.name, memberCode: m.memberCode, joinedAt: m.joinedAt, plan: m.plan, status: m.status })),
    recentReleases: recentRelease.map((a) => ({ id: a._id, seat: a.seatId?.name || '—', member: a.memberId?.name || '—', releasedAt: a.releasedAt, by: a.releasedBy })),
  }
}

// ───────── analytics ─────────
export const STUDY_ANALYTICS_CONFIG = {
  kpis: [
    { key: 'totalRevenue', label: 'Total Revenue', format: 'money', tone: 'blue' },
    { key: 'membershipRevenue', label: 'Membership Revenue', format: 'money', tone: 'green' },
    { key: 'courseRevenue', label: 'Course Revenue', format: 'money', tone: 'purple' },
    { key: 'otherRevenue', label: 'Other Revenue', format: 'money', tone: 'gray' },
    { key: 'collectionAmount', label: 'Collection Amount', format: 'money', tone: 'green' },
    { key: 'pendingAmount', label: 'Pending / Due Amount', format: 'money', tone: 'red' },
    { key: 'activeMembers', label: 'Active Members', format: 'number', tone: 'green' },
    { key: 'newMembers', label: 'New Members', format: 'number', tone: 'blue' },
    { key: 'expiredMemberships', label: 'Expired Memberships', format: 'number', tone: 'red' },
    { key: 'renewals', label: 'Membership Renewals', format: 'number', tone: 'purple' },
    { key: 'seatUtilization', label: 'Seat Utilization', format: 'percent', tone: 'orange' },
    { key: 'fullSeats', label: 'Full Seats', format: 'number', tone: 'green' },
    { key: 'partialSeats', label: 'Partial Seats', format: 'number', tone: 'orange' },
    { key: 'emptySeats', label: 'Empty Seats', format: 'number', tone: 'red' },
  ],
  charts: [
    { key: 'revenueOverTime', title: 'Revenue over time', type: 'stacked-bar', x: 'label', series: [{ key: 'membership', label: 'Membership', color: '#16A34A' }, { key: 'course', label: 'Courses', color: '#7C3AED' }, { key: 'other', label: 'Other', color: '#94A3B8' }] },
    { key: 'revenueByPlan', title: 'Revenue by membership plan', type: 'bar', x: 'label', series: [{ key: 'value', label: 'Revenue', color: '#F97316' }] },
    { key: 'memberGrowth', title: 'Member growth', type: 'line', x: 'label', series: [{ key: 'total', label: 'Total members', color: '#2563EB' }, { key: 'joined', label: 'New', color: '#16A34A' }] },
    { key: 'duesOverTime', title: 'Pending dues over time', type: 'line', x: 'label', series: [{ key: 'value', label: 'Pending dues', color: '#DC2626' }] },
    { key: 'seatOccupancy', title: 'Seat occupancy', type: 'donut', x: 'label', series: [{ key: 'value', label: 'Seats' }] },
    { key: 'renewalsOverTime', title: 'Membership renewals', type: 'bar', x: 'label', series: [{ key: 'value', label: 'Renewals', color: '#7C3AED' }] },
  ],
}

const bucketKey = (d, weekly) => {
  const x = startOfDay(d)
  if (weekly) x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // week starts Monday
  return x.getTime()
}
const label = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const buckets = (from, to, weekly) => { const out = []; const step = weekly ? 7 : 1; for (let t = bucketKey(from, weekly); t <= +to; t = +new Date(new Date(t).setDate(new Date(t).getDate() + step))) out.push(t); return out }

export async function studyAnalytics(center, days = 30) {
  days = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365)
  const now = new Date(), from = startOfDay(new Date(+now - (days - 1) * DAY)), weekly = days > 45
  const win = windowOf(center)
  const [bills, board, members, newMembersN, renewalsRows, allMs, ledger, due, collected, allMembersJoin] = await Promise.all([
    Bill.find(live(center._id, { createdAt: { $gte: from } })).select('revenue createdAt totalAmount taxAmount').lean(),
    seatBoard(center, { now }), memberRows(center, { now }),
    StudyMember.countDocuments({ centerId: center._id, joinedAt: { $gte: from } }),
    Membership.find({ centerId: center._id, kind: 'renewal', createdAt: { $gte: from } }).select('createdAt').lean(),
    Membership.find({ centerId: center._id, createdAt: { $gte: from } }).select('planName amount discount').lean(),
    UdharHistory.find({ shopId: center._id, type: { $in: ['udhar', 'payment'] } }).select('delta date').sort({ date: 1 }).lean(),
    outstanding(center._id), collections(center._id, from, new Date(+now + DAY)),
    StudyMember.find({ centerId: center._id }).select('joinedAt').sort({ joinedAt: 1 }).lean(),
  ])
  const rev = bills.map(revenueOf)
  const membershipRevenue = sum(rev, (r) => r.membership), courseRevenue = sum(rev, (r) => r.course), otherRevenue = sum(rev, (r) => r.other)
  const s = board.summary, usable = board.seats.filter((x) => x.state !== 'unavailable')
  const span = toMin(win.close) - toMin(win.open)
  const coveredFrac = usable.length ? usable.reduce((t, x) => t + (x.state === 'occupied' ? 1 : x.state === 'partial' ? 0.5 : 0), 0) / usable.length : 0 // partial counts as half until minute-level detail is needed

  const bk = buckets(from, now, weekly)
  const revSeries = new Map(bk.map((t) => [t, { label: label(t), membership: 0, course: 0, other: 0 }]))
  bills.forEach((b, i) => { const row = revSeries.get(bucketKey(b.createdAt, weekly)); if (row) { row.membership = r2(row.membership + rev[i].membership); row.course = r2(row.course + rev[i].course); row.other = r2(row.other + rev[i].other) } })

  const byPlan = new Map()
  for (const m of allMs) byPlan.set(m.planName, r2((byPlan.get(m.planName) || 0) + (m.amount - (m.discount || 0))))

  let total = allMembersJoin.filter((m) => +new Date(m.joinedAt) < +from).length
  const growth = new Map(bk.map((t) => [t, { label: label(t), joined: 0, total: 0 }]))
  for (const m of allMembersJoin) { const row = growth.get(bucketKey(m.joinedAt, weekly)); if (row && +new Date(m.joinedAt) >= +from) row.joined++ }
  for (const row of growth.values()) { total += row.joined; row.total = total }

  let run = r2(ledger.filter((e) => +new Date(e.date) < +from).reduce((t, e) => t + e.delta, 0))
  const duesSeries = new Map(bk.map((t) => [t, { label: label(t), value: 0 }]))
  const lastPerBucket = new Map()
  for (const e of ledger.filter((x) => +new Date(x.date) >= +from)) { run = r2(run + e.delta); lastPerBucket.set(bucketKey(e.date, weekly), run) }
  let carry = r2(ledger.filter((e) => +new Date(e.date) < +from).reduce((t, e) => t + e.delta, 0))
  for (const t of bk) { if (lastPerBucket.has(t)) carry = lastPerBucket.get(t); duesSeries.get(t).value = Math.max(carry, 0) }

  const renewals = new Map(bk.map((t) => [t, { label: label(t), value: 0 }]))
  for (const m of renewalsRows) { const row = renewals.get(bucketKey(m.createdAt, weekly)); if (row) row.value++ }

  return {
    days, granularity: weekly ? 'week' : 'day', config: STUDY_ANALYTICS_CONFIG,
    kpis: {
      totalRevenue: r2(membershipRevenue + courseRevenue + otherRevenue), membershipRevenue, courseRevenue, otherRevenue,
      collectionAmount: collected, pendingAmount: due.amount,
      activeMembers: members.filter((m) => ['Active', 'Partially Active', 'Pending Payment'].includes(m.status)).length, newMembers: newMembersN,
      expiredMemberships: members.filter((m) => m.status === 'Membership Expired').length, renewals: renewalsRows.length,
      seatUtilization: Math.round(coveredFrac * 100), fullSeats: s.occupied, partialSeats: s.partial, emptySeats: s.empty,
    },
    charts: {
      revenueOverTime: [...revSeries.values()],
      revenueByPlan: [...byPlan.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      memberGrowth: [...growth.values()], duesOverTime: [...duesSeries.values()],
      seatOccupancy: [{ label: 'Occupied', value: s.occupied, color: '#16A34A' }, { label: 'Partial', value: s.partial, color: '#F59E0B' }, { label: 'Empty', value: s.empty, color: '#EF4444' }, ...(s.unavailable ? [{ label: 'Unavailable', value: s.unavailable, color: '#9CA3AF' }] : [])],
      renewalsOverTime: [...renewals.values()],
    },
    meta: { spanMinutes: span, utilizationNote: 'Partially occupied seats count as half a seat.' },
  }
}

export const dueAgeOf = dueAge
