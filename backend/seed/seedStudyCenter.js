// Study Center test environment — "Bright Study Center".
//   npm run seed:study         → (re)creates the account + all dummy data in the real database (safe to run again)
//   AUTO_SEED (server start)   → creates it automatically the first time, if the login does not exist yet
// The login is created through the normal User model (password hashed by its pre-save hook), exactly like a registered account.
import 'dotenv/config'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import User from '../models/common/User.js'
import StudyCenter from '../models/library/StudyCenter.js'
import Seat from '../models/library/Seat.js'
import StudyMember from '../models/library/StudyMember.js'
import Membership from '../models/library/Membership.js'
import SeatAssignment from '../models/library/SeatAssignment.js'
import Course from '../models/library/Course.js'
import Enrollment from '../models/library/Enrollment.js'
import Customer from '../models/common/Customer.js'
import Bill from '../models/common/Bill.js'
import BillCounter from '../models/common/BillCounter.js'
import BillDraft from '../models/common/BillDraft.js'
import Udhar from '../models/common/Udhar.js'
import UdharHistory from '../models/common/UdharHistory.js'
import { generateStudy, CENTER } from './studyData.js'
import { assertDevSeedAllowed } from './guard.js'

export const STUDY_LOGIN = { email: 'demo.study@example.com', password: 'StudyCenter@123' } // development / testing only

async function wipe(email) {
  const old = await User.findOne({ email })
  if (!old) return
  const c = await StudyCenter.findOne({ userId: old._id })
  if (c) {
    await Promise.all([Seat, StudyMember, Membership, SeatAssignment, Course, Enrollment].map((M) => M.deleteMany({ centerId: c._id })))
    await Promise.all([Customer, Bill, BillCounter, BillDraft, Udhar, UdharHistory].map((M) => M.deleteMany({ shopId: c._id })))
    await StudyCenter.deleteOne({ _id: c._id })
  }
  await User.deleteOne({ _id: old._id })
}

export async function seedStudyCenter() {
  assertDevSeedAllowed('Study Center seed') // wipe() below deletes the account with this email — never in production
  await wipe(STUDY_LOGIN.email)
  const user = await User.create({ name: CENTER.owner, email: STUDY_LOGIN.email, username: CENTER.username, password: STUDY_LOGIN.password, role: 'seller', sellerType: 'study_center', phone: CENTER.phone, bio: 'Quiet, well-lit study space with 60 seats, courses and test series.' })
  const center = await StudyCenter.create({
    userId: user._id, username: CENTER.username, centerName: CENTER.name, centerCode: CENTER.code, ownerName: CENTER.owner, phone: CENTER.phone, email: CENTER.email,
    description: 'Bright Study Center is a calm, fully air-conditioned study space and coaching hub for competitive exams, school boards and self-study.',
    studyEnvironment: 'Silent zone · 24x7 power backup · CCTV · drinking water · discussion room',
    features: ['Free Wi-Fi', 'Air Conditioned', 'Lockers', 'Charging Points', 'Power Backup', 'CCTV'], category: 'Library', subCategory: 'Study Space', verified: true, rating: 4.7, reviewCount: 128,
    location: { address: '2nd Floor, Civil Lines Road', state: 'Madhya Pradesh', district: 'Sagar', area: 'Civil Lines', lat: 23.8388, lng: 78.7378 },
    timing: { open: '06:00', close: '22:00', openDays: 'All Week' },
    config: generateStudy({ centerId: new mongoose.Types.ObjectId() }).config,
  })
  const d = generateStudy({ centerId: center._id })
  const stamp = (rows) => rows.map((r) => ({ createdAt: r.joinedAt || new Date(), updatedAt: new Date(), ...r }))
  await Seat.insertMany(stamp(d.seats))                      // Mongoose validation runs on these
  await Course.insertMany(stamp(d.courses))
  await StudyMember.insertMany(d.members)
  await Membership.insertMany(d.memberships)
  await SeatAssignment.insertMany(d.assignments)
  await Enrollment.insertMany(d.enrollments)
  await BillDraft.insertMany(d.drafts)
  // back-dated documents go in raw (keeps their real createdAt), exactly like the existing shop demo seed
  await Customer.collection.insertMany(d.customers)
  await Bill.collection.insertMany(d.bills)
  await BillCounter.collection.insertMany(d.billCounters)
  await Udhar.collection.insertMany(d.udhars)
  await UdharHistory.collection.insertMany(d.history)
  await StudyCenter.updateOne({ _id: center._id }, { $set: { 'config.memberCounter': d.memberCounter } })
  return { seats: d.seats.length, members: d.members.length, memberships: d.memberships.length, bills: d.bills.length, courses: d.courses.length, dues: d.udhars.filter((u) => u.totalAmount > 0).length }
}

export async function seedStudyIfMissing() {
  if (await User.findOne({ email: STUDY_LOGIN.email })) return
  const r = await seedStudyCenter()
  console.log(`[auto-seed] ${STUDY_LOGIN.email} ready (${r.seats} seats, ${r.members} members, ${r.bills} bills)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mongoose.connect(process.env.MONGODB_URI)
  const r = await seedStudyCenter()
  console.log('Seeded Bright Study Center:', r)
  console.log(`Seeded dev account ${STUDY_LOGIN.email} (credentials: seed/DEV_ACCOUNTS.md)`)
  await mongoose.disconnect()
}
