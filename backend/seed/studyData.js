// Pure generator (no database calls) for the "Bright Study Center" test environment.
// seed/seedStudyCenter.js writes what this returns, through Mongoose, into the real database.
// Deterministic: same seed → same data. It asserts its own invariants (no overlapping seat slots, due ages as designed …).
import mongoose from 'mongoose'
import { computeBill, deriveTransactionType } from '../utils/billing.js'
import { dateParts } from '../utils/billId.js'
import { normSlot, findConflict, addMonths, DEFAULT_WINDOW, slotLabel, seatSort } from '../utils/studyLogic.js'
import { schemaFor } from '../utils/businessSchema.js'

const DAY = 864e5
const oid = () => new mongoose.Types.ObjectId()
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export const CENTER = { name: 'Bright Study Center', code: '#STU102', username: '@brightstudy238', owner: 'Rajeev Kumar', phone: '9876500102', email: 'brightstudycenter@test.com' }

// the centre's own configuration (what another centre would configure differently): zones, naming, plans, slots, charge types, materials
export function studyConfig() {
  const d = schemaFor('study_center').defaults
  return {
    ...d,
    operatingHours: { open: '06:00', close: '22:00' },
    zones: [{ key: 'main-hall', name: 'Main Hall' }, { key: 'cabin', name: 'Cabin' }, { key: 'reading-room', name: 'Reading Room' }, { key: 'premium', name: 'Premium' }],
    timeSlots: [
      { key: 'morning', label: 'Morning', start: '06:00', end: '14:00' },
      { key: 'evening', label: 'Evening', start: '14:00', end: '22:00' },
      { key: 'half-am', label: '08:00 AM – 12:00 PM', start: '08:00', end: '12:00' },
      { key: 'half-pm', label: '12:00 PM – 06:00 PM', start: '12:00', end: '18:00' },
    ],
    materials: [
      { key: 'reasoning-book', name: 'Reasoning Book (Arihant)', kind: 'book', price: 450 }, { key: 'gk-notes', name: 'GK Notes', kind: 'notes', price: 150 },
      { key: 'math-formula', name: 'Maths Formula Book', kind: 'book', price: 300 }, { key: 'practice-set', name: 'Practice Question Set', kind: 'notes', price: 200 },
    ],
    lastNaming: { mode: 'grid', rows: 4, perRow: 10, startRow: 'A' },
    memberPrefix: 'STU',
  }
}

const PLAN = { 1: { key: '1m', name: '1 Month', price: 1000 }, 3: { key: '3m', name: '3 Months', price: 2800 }, 6: { key: '6m', name: '6 Months', price: 5200 }, 12: { key: '1y', name: '1 Year', price: 9500 } }
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Rohan', 'Karan', 'Ishaan', 'Dev', 'Nikhil', 'Sachin', 'Ananya', 'Diya', 'Isha', 'Kriti', 'Pallavi', 'Tanvi', 'Swati', 'Shweta', 'Komal', 'Harsh', 'Naina', 'Yash', 'Muskan', 'Arjun', 'Simran']
const LAST = ['Sharma', 'Gupta', 'Yadav', 'Jain', 'Patel', 'Mishra', 'Tiwari', 'Rao', 'Soni', 'Thakur', 'Dubey', 'Agarwal', 'Chouhan', 'Bansal', 'Saxena']
const METHODS = ['cash', 'upi', 'card', 'cash', 'upi']
const CLASSES = ['10th', '12th', 'UPSC', 'SSC', 'NEET', 'JEE', 'Graduation', 'Banking']

export const COURSES = [
  { name: 'UPSC Foundation', description: 'GS + CSAT foundation batch with weekly tests.', duration: '6 Months', fee: 12000, instructor: 'Dr. R. K. Mishra', capacity: 30 },
  { name: 'SSC CGL Crash Course', description: 'Quant, reasoning, English and GA — exam-focused.', duration: '3 Months', fee: 4000, instructor: 'Priya Nair', capacity: 40 },
  { name: 'NEET Test Series', description: 'Full-length mock tests with analysis.', duration: '4 Months', fee: 3000, instructor: 'Anil Kapoor', capacity: 60 },
  { name: 'Spoken English', description: 'Daily conversation practice and grammar.', duration: '2 Months', fee: 2500, instructor: 'Meenal Joshi', capacity: 25 },
  { name: 'Class 10 Tuition', description: 'Maths + Science tuition for board exams.', duration: '1 Year', fee: 8000, instructor: 'S. K. Tripathi', capacity: 20, status: 'inactive' },
]

export function generateStudy({ centerId, centerName = CENTER.name, now = Date.now(), seed = 7 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[Math.floor(rnd() * a.length)]
  const cfg = studyConfig(), win = DEFAULT_WINDOW
  // a time n days ago at a believable hour — but never LATER in the day than "now", so a due created "5 days ago" is exactly 5d old whenever the seed runs
  const at = (daysAgo, hour = 10) => { const ref = now - daysAgo * DAY, d = new Date(ref); d.setHours(hour, int(0, 59), 0, 0); return +d > ref ? new Date(ref - int(2, 50) * 60e3) : d }
  const FULL = normSlot({ fullDay: true }, win).slot
  const sl = (a, b) => normSlot({ start: a, end: b }, win).slot

  // ───────── seats: 4 naming patterns in one centre ─────────
  const seats = []
  const add = (name, zone, type) => seats.push({ _id: oid(), centerId, name, zone, type, disabled: false, note: '', order: seats.length })
  for (const row of 'ABCD') for (let i = 1; i <= 10; i++) add(`${row}${i}`, 'main-hall', 'regular')   // grid     A1…D10
  for (let i = 1; i <= 10; i++) add(`Cabin-${i}`, 'cabin', 'cabin')                                    // prefix   Cabin-1…10
  for (let i = 1; i <= 8; i++) add(`R${i}`, 'reading-room', 'regular')                                 // prefix   R1…R8
  add('P1', 'premium', 'premium'); add('P2', 'premium', 'premium')
  seats.sort((a, b) => seatSort(a.name, b.name)); seats.forEach((x, i) => { x.order = i })
  const seatByName = Object.fromEntries(seats.map((x) => [x.name, x]))
  seatByName['Cabin-10'].disabled = true; seatByName['Cabin-10'].note = 'Under maintenance'                // one "Unavailable" (gray) seat

  // ───────── people: designed edge cases first, then generated fillers ─────────
  // endIn: days until the latest membership ends (negative = already expired) · months: length of the latest period · hist: earlier paid periods (renewals)
  // pay: paid | partial(paid) | unpaid · dues: extra unpaid bills { amount, age (days ago), kind } · seatSlots: [[seat, slot]]
  let phoneN = 1
  const phone = () => `98765${String(phoneN++).padStart(5, '0')}`
  const SPECIAL = [
    { name: 'Aarav Sharma', cls: '10th', seats: [['A1', 'full']], endIn: 10, months: 1, hist: 2, pay: 'paid', courses: ['Class 10 Tuition'] },                 // active · paid · renewed twice · multiple bills
    { name: 'Riya Verma', cls: '12th', seats: [['A3', 'full']], endIn: -3, months: 1, hist: 1, pay: 'paid', dues: [{ amount: 500, age: 5, kind: 'fine' }] },  // A3: expired + ₹500 due 5d → stays GREEN
    { name: 'Kabir Singh', cls: 'SSC', seats: [['A4', ['06:00', '14:00']]], endIn: 5, months: 1, hist: 0, pay: 'paid', courses: ['SSC CGL Crash Course'] },   // partial seat, active
    { name: 'Meera Joshi', cls: 'UPSC', seats: [['A8', 'full']], endIn: -2, months: 1, hist: 1, pay: 'paid', dues: [{ amount: 200, age: 12, kind: 'book' }], courses: ['UPSC Foundation'] },
    { name: 'Riya Kumari', cls: 'NEET', seats: [['B3', ['08:00', '12:00']]], endIn: 18, months: 1, hist: 0, pay: 'paid' },                                    // B3: 08–12 occupied, 12–18 empty → ORANGE
    { name: 'Aditya Kumar', cls: 'JEE', seats: [['B6', 'full']], endIn: -6, months: 1, hist: 1, pay: 'paid', dues: [{ amount: 400, age: 35, kind: 'other' }] },   // due 1m
    { name: 'Sneha Patel', cls: 'Banking', seats: [['C7', 'full']], endIn: -1, months: 1, hist: 0, pay: 'paid', dues: [{ amount: 350, age: 3, kind: 'fine' }] },
    { name: 'Pooja Sharma', cls: 'Graduation', seats: [['D4', 'full']], endIn: -5, months: 1, hist: 0, pay: 'paid', dues: [{ amount: 300, age: 65, kind: 'other', payBack: 0 }] },  // due 2m
    { name: 'Mohan Yadav', cls: 'SSC', seats: [['E7x', 'full']], endIn: 8, months: 1, hist: 0, pay: 'paid', dues: [{ amount: 450, age: 10, kind: 'book' }] },
    { name: 'Raj Malhotra', cls: 'UPSC', seats: [['C2', ['08:00', '12:00']]], endIn: 22, months: 1, hist: 0, pay: 'partial', paid: 700 },                    // ₹1,000 · paid ₹700 · due ₹300 (the brief's example)
    { name: 'Aman Verma', cls: 'UPSC', seats: [['C2', ['12:00', '16:00']]], endIn: 20, months: 1, hist: 0, pay: 'paid' },                                    // second slot on C2 (valid: 12:00 touches 12:00)
    { name: 'Sakshi Rao', cls: '12th', seats: [['B9', ['06:00', '14:00']]], endIn: 25, months: 3, hist: 0, pay: 'paid', discount: { type: 'percent', value: 10 } },  // B9: two slots together cover the day → GREEN
    { name: 'Tanmay Soni', cls: '12th', seats: [['B9', ['14:00', '22:00']]], endIn: 25, months: 3, hist: 0, pay: 'paid', discount: { type: 'fixed', value: 200 } },
    { name: 'Nisha Thakur', cls: 'NEET', seats: [['Cabin-1', 'full']], endIn: 150, months: 6, hist: 0, pay: 'paid', courses: ['NEET Test Series'] },                  // 6-month plan
    { name: 'Vikram Dubey', cls: 'JEE', seats: [['Cabin-2', 'full']], endIn: 40, months: 3, hist: 0, pay: 'unpaid' },                                          // full pending payment
    { name: 'Ankit Jain', cls: 'Banking', seats: [['P1', 'full']], endIn: 330, months: 12, hist: 0, pay: 'paid' },                                           // 1-year plan on a premium seat
    { name: 'Preeti Agarwal', cls: 'UPSC', seats: [['R1', 'full']], endIn: -9, months: 1, hist: 2, pay: 'paid' },                                           // expired, NO due, seat still assigned
    { name: 'Gaurav Saxena', cls: 'SSC', seats: [['D9', 'full']], endIn: 4, months: 1, hist: 1, pay: 'paid', dues: [{ amount: 600, age: 20, kind: 'course', payBack: 200 }], courses: ['Spoken English'] },
    { name: 'Tarun Bhatia', cls: 'SSC', seats: [], released: { seat: 'C5', daysAgo: 12, by: 'owner' }, endIn: -12, months: 1, hist: 0, pay: 'paid' },   // RELEASED: C5 is empty again, history kept
    { name: 'Kavya Bansal', cls: '10th', seats: [], released: { seat: 'D1', daysAgo: 40, by: 'member' }, endIn: -40, months: 1, hist: 0, pay: 'paid' },
    { name: 'Deepak Chouhan', cls: 'Graduation', seats: [], inactive: true, noMembership: true },                                                           // INACTIVE, never bought a plan
  ]
  // fix the typo-proof seat key for Mohan (E-row isn't in this centre's main hall of 4 rows): put him on D7
  SPECIAL.find((p) => p.name === 'Mohan Yadav').seats = [['D7', 'full']]

  const taken = new Set(SPECIAL.flatMap((p) => [...p.seats.map((x) => x[0]), ...(p.released ? [p.released.seat] : [])]))
  const reservedEmpty = new Set(['C5', 'R8', 'D10', 'Cabin-9'])                // guaranteed empty
  const used = new Set(['Cabin-10'])
  const freeSeats = seats.map((x) => x.name).filter((n) => !taken.has(n) && !reservedEmpty.has(n) && !used.has(n))
  const people = SPECIAL.map((p) => ({ ...p, seats: p.seats.map(([n, sl_]) => [n, sl_]) }))
  const nameSet = new Set(people.map((p) => p.name))
  const fresh = () => { for (let t = 0; t < 200; t++) { const n = `${pick(FIRST)} ${pick(LAST)}`; if (!nameSet.has(n)) { nameSet.add(n); return n } } return `Member ${nameSet.size}` }
  for (const seatName of freeSeats) {
    const roll = rnd()
    if (roll < 0.1) continue                                                    // a few more empty seats
    const base = { cls: pick(CLASSES), hist: int(0, 2), months: pick([1, 1, 1, 3]), pay: rnd() < 0.82 ? 'paid' : 'partial' }
    const mk = (extra) => { const p = { ...base, name: fresh(), ...extra }; if (p.pay === 'partial') p.paid = Math.round((PLAN[p.months].price * pick([0.4, 0.5, 0.7])) / 50) * 50; people.push(p) }
    const expired = rnd() < 0.2, endIn = expired ? -int(1, 20) : int(3, 28)
    if (roll < 0.72) mk({ seats: [[seatName, 'full']], endIn, ...(rnd() < 0.18 ? { dues: [{ amount: pick([100, 150, 250, 300, 500, 800]), age: pick([2, 4, 9, 15, 28, 45, 70]), kind: pick(['fine', 'book', 'other']) }] } : {}) })
    else if (roll < 0.86) mk({ seats: [[seatName, rnd() < 0.5 ? ['06:00', '14:00'] : ['14:00', '22:00']]], endIn: int(2, 25), months: 1, pay: 'paid' })   // half-day → partial seat
    else { mk({ seats: [[seatName, ['06:00', '14:00']]], endIn: int(2, 25), months: 1, pay: 'paid' }); mk({ seats: [[seatName, ['14:00', '22:00']]], endIn: int(2, 25), months: 1, pay: 'paid' }) } // two halves → full seat
  }
  for (const p of people) { p.phone = phone(); p.hist = p.hist ?? 0 }

  // ───────── build documents ─────────
  const customers = [], members = [], memberships = [], assignments = [], bills = [], enrollments = [], counters = new Map()
  const ledger = new Map() // customerId → [entries]
  const courseDocs = COURSES.map((c) => ({ _id: oid(), centerId, status: 'active', ...c }))
  const courseByName = Object.fromEntries(courseDocs.map((c) => [c.name, c]))
  const joined = []
  let memberNo = 0

  const billIds = new Map()
  const mkBill = ({ person, cust, date, items, discount = null, paid = 'paid', paidAmount = 0, method, notes = '' }) => {
    const lines = items.map((i) => ({ type: i.type, qty: i.qty || 1, rate: i.rate, charge: 'charged' }))
    const calc = computeBill(lines, { discount: discount || 0 })
    const total = calc.total
    const got = paid === 'paid' ? total : paid === 'unpaid' ? 0 : Math.min(paidAmount, total)
    const unpaid = r2(total - got), pm = unpaid > 0 && got === 0 ? 'udhar' : method || pick(METHODS)
    const rec = { date, doc: null }
    const doc = {
      _id: oid(), shopId: centerId, billId: '', fullId: '', customerName: person.name, customerPhone: person.phone, customerId: cust._id, channel: 'offline',
      totalAmount: total, paidAmount: got, unpaidAmount: unpaid, paymentStatus: unpaid <= 0 ? 'paid' : got <= 0 ? 'unpaid' : 'partial', paymentMethod: pm, status: unpaid > 0 ? 'udhar' : 'paid',
      creditUsed: 0, advanceAdded: 0, receivedAmount: got, returnedAmount: 0, notes, deliveryCharge: 0, otherIncome: 0, orderStatus: 'Delivered', cancelledAt: null,
      discount: calc.discount, subtotal: calc.subtotal, ...(discount && discount.value ? { discountType: discount.type, discountValue: discount.value } : {}),
      ...(got > 0 ? { payments: [{ method: pm === 'udhar' ? 'cash' : pm, amount: got, at: date }] } : {}),
      transactionType: deriveTransactionType(lines),
      items: items.map((i, k) => ({ type: i.type, refId: i.refId || null, name: i.name, qty: i.qty || 1, unit: '', rate: i.rate, total: calc.lines[k].total, pricing: 'fixed', description: '', charge: 'charged', discountType: 'fixed', discountValue: 0, discount: calc.lines[k].discount, cost: 0, ...(i.meta ? { meta: i.meta } : {}) })),
      revenue: calc.revenue, cost: { product: 0, material: 0 }, createdAt: date, updatedAt: date,
    }
    rec.doc = doc; bills.push(rec)
    const led = ledger.get(String(cust._id)) || ledger.set(String(cust._id), []).get(String(cust._id))
    if (unpaid > 0) led.push({ type: 'udhar', amount: unpaid, delta: unpaid, date, billRec: rec, source: 'billing', paymentType: pm, note: 'Bill' })
    return rec
  }

  for (const p of people) {
    memberNo++
    const cust = { _id: oid(), shopId: centerId, name: p.name, phone: p.phone, lastBillAt: null, usageCount: 0, creditBalance: 0, createdAt: at(120), updatedAt: at(1) }
    customers.push(cust)
    const joinedAt = at(p.noMembership ? int(5, 30) : 30 * (p.hist + p.months) + int(2, 10))
    const member = { _id: oid(), centerId, customerId: cust._id, memberCode: `STU${String(memberNo).padStart(3, '0')}`, name: p.name, phone: p.phone, email: `${p.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`, className: p.cls, joinedAt, notes: '', inactive: !!p.inactive, leftAt: null, userId: null, createdAt: joinedAt, updatedAt: joinedAt }
    members.push(member); joined.push(joinedAt)
    if (p.noMembership) continue

    // membership chain: oldest → latest, back to back, each billed on its own start date
    const latestEnd = new Date(now + p.endIn * DAY)
    const periods = []
    let end = latestEnd
    for (let k = 0; k <= p.hist; k++) { const m = k === 0 ? p.months : 1; const start = addMonths(end, -m); periods.unshift({ start, end, months: m }); end = start }
    const seatMain = p.seats[0] || (p.released ? [p.released.seat, 'full'] : null)
    let prevId = null
    periods.forEach((per, idx) => {
      const isLatest = idx === periods.length - 1, plan = PLAN[per.months] || PLAN[1]
      const slot = seatMain ? (seatMain[1] === 'full' ? FULL : sl(seatMain[1][0], seatMain[1][1])) : null
      const billDate = new Date(Math.min(+per.start + 3600e3 * 2, now - 3600e3))
      const mode = isLatest ? p.pay : 'paid'
      const rec = mkBill({
        person: p, cust, date: billDate, paid: mode === 'partial' ? 'partial' : mode, paidAmount: p.paid || 0, discount: isLatest ? p.discount : null,
        items: [{ type: 'membership', name: `Membership – ${plan.name}`, rate: plan.price, meta: { planKey: plan.key, months: per.months, ...(seatMain ? { seatId: String(seatByName[seatMain[0]]._id), slot } : {}) } }],
      })
      const d = rec.doc, ms = { _id: oid(), centerId, memberId: member._id, customerId: cust._id, planKey: plan.key, planName: plan.name, months: per.months, startDate: per.start, endDate: per.end, amount: plan.price, discount: d.discount, amountPaid: d.paidAmount, pending: d.unpaidAmount, billId: null, seatId: seatMain ? seatByName[seatMain[0]]._id : null, slot, kind: idx === 0 ? 'new' : 'renewal', renewsId: prevId, createdAt: billDate, updatedAt: billDate, _rec: rec }
      memberships.push(ms); prevId = ms._id
    })
    // seat assignments (active) — one per seat/slot; membership expiry never touches them
    const latestMs = memberships[memberships.length - 1]
    for (const [seatName, slotKey] of p.seats) {
      const slot = slotKey === 'full' ? FULL : sl(slotKey[0], slotKey[1])
      assignments.push({ _id: oid(), centerId, seatId: seatByName[seatName]._id, memberId: member._id, customerId: cust._id, membershipId: latestMs._id, slot, startedAt: periods[0].start, releasedAt: null, releasedBy: null, releaseNote: '', releaseRequestedAt: null, createdAt: periods[0].start, updatedAt: periods[0].start })
    }
    if (p.released) { // history stays: the row is kept with releasedAt / releasedBy
      const when = at(p.released.daysAgo, 12); member.leftAt = when
      assignments.push({ _id: oid(), centerId, seatId: seatByName[p.released.seat]._id, memberId: member._id, customerId: cust._id, membershipId: latestMs._id, slot: FULL, startedAt: periods[0].start, releasedAt: when, releasedBy: p.released.by, releaseNote: p.released.by === 'member' ? 'Member left the center' : 'Released by owner', releaseRequestedAt: p.released.by === 'member' ? new Date(+when - DAY) : null, createdAt: periods[0].start, updatedAt: when })
    }
    // extra unpaid bills (fines / books / course balances) dated so the due age is exactly as designed
    for (const dd of p.dues || []) {
      const date = at(dd.age, 15)
      const item = dd.kind === 'fine' ? { type: 'fine', name: 'Late Fee', rate: dd.amount } : dd.kind === 'book' ? { type: 'book', name: pick(cfg.materials).name, rate: dd.amount } : dd.kind === 'course' ? { type: 'course', name: 'Spoken English', rate: dd.amount } : { type: 'other', name: 'Locker / Other Charge', rate: dd.amount }
      mkBill({ person: p, cust, date, items: [item], paid: 'unpaid' })
      if (dd.payBack) { const led = ledger.get(String(cust._id)); led.push({ type: 'payment', amount: dd.payBack, delta: -dd.payBack, date: new Date(+date + 2 * DAY), billRec: null, source: 'manual', paymentType: 'upi', note: 'Part payment' }) }
    }
    // course enrolments, billed as Course Fee
    for (const cn of p.courses || []) {
      const c = courseByName[cn], date = at(int(8, 80), 13)
      const rec = mkBill({ person: p, cust, date, items: [{ type: 'course', name: `${c.name} – Course Fee`, rate: c.fee, refId: c._id, meta: { courseId: String(c._id) } }], paid: 'paid' })
      enrollments.push({ _id: oid(), centerId, courseId: c._id, memberId: member._id, enrolledAt: date, status: 'enrolled', createdAt: date, updatedAt: date, _rec: rec })
    }
  }

  // a handful of stand-alone bills: registration fees, book issues, other charges (paid) — gives every bill type a row
  for (const person of people.filter((x) => !x.noMembership).slice(0, 14)) {
    const cust = customers.find((c) => c.phone === person.phone), date = at(int(1, 50), 11)
    const k = int(0, 2)
    mkBill({ person, cust, date, paid: 'paid', items: [k === 0 ? { type: 'registration', name: 'Registration Fee', rate: 200 } : k === 1 ? { type: 'book', name: pick(cfg.materials).name, rate: pick([150, 200, 300, 450]) } : { type: 'other', name: 'Locker Rent', rate: 100 }] })
  }

  // ───────── bill ids (per day counter, 0101…) in time order, then ledger simulation ─────────
  bills.sort((a, b) => +a.date - +b.date)
  for (const rec of bills) {
    const d = dateParts(rec.date), n = (counters.get(d.date) || 0) + 1
    counters.set(d.date, n)
    rec.doc.billId = `${d.yy}${d.mm}${d.dd}A${String(100 + n).padStart(4, '0')}`
    rec.doc.fullId = `BSC102-${d.yyyy}${d.mm}${d.dd}-A-${String(100 + n).padStart(4, '0')}`
  }
  for (const ms of memberships) { ms.billId = ms._rec.doc.billId; delete ms._rec }
  for (const en of enrollments) { en.billId = en._rec.doc.billId; delete en._rec }

  const udhars = [], history = []
  for (const cust of customers) {
    const entries = (ledger.get(String(cust._id)) || []).sort((a, b) => +a.date - +b.date)
    if (!entries.length) continue
    let bal = 0, pendingSince = null, clearedAt = null, lastAddedAt = null
    for (const e of entries) {
      const prev = bal; bal = r2(bal + e.delta)
      if (e.type === 'udhar') lastAddedAt = e.date
      if (prev <= 0.005 && bal > 0.005) pendingSince = e.date
      if (prev > 0.005 && bal <= 0.005) { clearedAt = e.date; pendingSince = null }
      history.push({ _id: oid(), shopId: centerId, customerId: cust._id, type: e.type, amount: e.amount, delta: e.delta, source: e.source, billId: e.billRec?.doc.billId || null, items: [], paymentType: e.paymentType, note: e.note, balanceAfter: bal, date: e.date, createdAt: e.date, updatedAt: e.date })
      if (e.billRec) e.billRec.doc.balanceAfter = bal
    }
    udhars.push({ _id: oid(), shopId: centerId, customerId: cust._id, customerName: cust.name, phone: cust.phone, totalAmount: bal, pinned: false, lastAddedAt, pendingSince: bal > 0.005 ? pendingSince : null, clearedAt: bal <= 0.005 ? clearedAt : null, lastUpdated: entries[entries.length - 1].date, createdAt: entries[0].date, updatedAt: entries[entries.length - 1].date })
  }
  for (const rec of bills) { const c = customers.find((x) => String(x._id) === String(rec.doc.customerId)); c.usageCount++; if (!c.lastBillAt || +rec.date > +c.lastBillAt) c.lastBillAt = rec.date }

  const billDocs = bills.map((r) => r.doc)
  const billCounters = [...counters.entries()].map(([date, n]) => ({ shopId: centerId, date, series: 'A', count: 100 + n, issued: n }))
  const first = people.find((p) => p.name === 'Aarav Sharma'), second = people.find((p) => p.name === 'Kabir Singh')
  const draftFor = (p, name, items, total) => ({ shopId: centerId, status: 'draft', customerId: customers.find((c) => c.phone === p.phone)._id, customerName: p.name, customerPhone: p.phone, total, itemCount: items.length, state: { items, method: 'Cash', recv: null, retMode: 'auto', retCustom: '', notes: name, discount: '', discountType: 'fixed', split: null, context: {}, mode: 'membership' }, createdAt: at(0, 13), updatedAt: at(0, 13) })
  const drafts = [
    draftFor(first, 'Tuition Fee - Class 10', [{ key: 'd1', type: 'course', name: 'Class 10 Tuition – Course Fee', price: 2000, qty: 1 }, { key: 'd2', type: 'book', name: 'Maths Formula Book', price: 300, qty: 1 }, { key: 'd3', type: 'other', name: 'Registration Fee', price: 200, qty: 1 }], 2500),
    draftFor(second, 'Book + fine', [{ key: 'd4', type: 'book', name: 'GK Notes', price: 150, qty: 1 }, { key: 'd5', type: 'fine', name: 'Late Fee', price: 50, qty: 1 }], 200),
  ]

  // ───────── invariants ─────────
  const bySeat = new Map()
  for (const a of assignments) if (!a.releasedAt) (bySeat.get(String(a.seatId)) || bySeat.set(String(a.seatId), []).get(String(a.seatId))).push(a)
  for (const [k, list] of bySeat) list.forEach((a, i) => { const clash = findConflict(list.filter((_, j) => j !== i), a.slot); if (clash) throw new Error(`seed: overlapping slots on seat ${k}`) })

  return {
    config: cfg, seats, customers, members, memberships, assignments, bills: billDocs, billCounters, udhars, history, courses: courseDocs, enrollments, drafts,
    memberCounter: members.length, people: people.length,
  }
}
