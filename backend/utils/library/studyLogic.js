// Study Center — PURE logic (no database, no framework). Everything the seat grid, the membership rules and the
// seed rely on lives here so it can be unit-tested without MongoDB (tests/study.logic.test.js).
//
//   seat naming   : any pattern the owner picks (A1.., 1.., 101.., Cabin-1.., or a custom list)
//   time slots    : 'HH:MM' 24h strings; overlap = real overlap (08–12 and 12–16 do NOT conflict)
//   seat state    : occupied (green) · partial (orange) · empty (red) · unavailable (gray) — from ASSIGNMENTS only,
//                   never from membership expiry or dues
//   due display   : "₹500 · 5d" / "₹1,200 · 2m"
export const MAX_SEATS_PER_BATCH = 500
export const DAY = 864e5

// ───────────── time ─────────────
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$|^24:00$/
export const toMin = (t) => { if (!HHMM.test(String(t))) return NaN; const [h, m] = String(t).split(':').map(Number); return h * 60 + m }
export const fromMin = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
export const fmt12 = (t) => { const n = toMin(t); if (Number.isNaN(n)) return ''; const h = Math.floor(n / 60) % 24, m = n % 60; return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
export const slotLabel = (s) => (s?.fullDay ? 'Full Day' : `${fmt12(s.start)} – ${fmt12(s.end)}`)

// A seat's day runs inside the centre's operating window. "Full Day" means the whole window.
export const DEFAULT_WINDOW = { open: '06:00', close: '22:00' }
export function fullDaySlot(win = DEFAULT_WINDOW) { return { start: win.open, end: win.close, label: 'Full Day', fullDay: true } }

// Validate + normalise one slot. Returns { slot } or { error }.
export function normSlot(raw, win = DEFAULT_WINDOW) {
  if (!raw || raw.fullDay) return { slot: fullDaySlot(win) }
  const a = toMin(raw.start), b = toMin(raw.end)
  if (Number.isNaN(a) || Number.isNaN(b)) return { error: 'Time slot needs a valid start and end time (HH:MM).' }
  if (b <= a) return { error: 'Time slot must end after it starts.' }
  const s = { start: fromMin(a), end: b === 1440 ? '24:00' : fromMin(b), fullDay: false }
  s.label = String(raw.label || '').trim().slice(0, 40) || slotLabel(s)
  return { slot: s }
}

// Two slots clash only when they truly overlap — touching ends (12:00 / 12:00) are fine.
export const overlaps = (a, b) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)

// First ACTIVE assignment on the seat that clashes with `slot` (or null). `ignoreId` lets an edit skip itself.
export function findConflict(active, slot, ignoreId = null) {
  for (const a of active || []) {
    if (a.releasedAt) continue
    if (ignoreId && String(a._id) === String(ignoreId)) continue
    if (overlaps(a.slot, slot)) return a
  }
  return null
}

// Minutes of the operating window covered by the (active) assignments — union of intervals, clipped to the window.
export function coveredMinutes(active, win = DEFAULT_WINDOW) {
  const lo = toMin(win.open), hi = toMin(win.close)
  const iv = (active || []).filter((a) => !a.releasedAt).map((a) => [Math.max(toMin(a.slot.start), lo), Math.min(toMin(a.slot.end), hi)]).filter(([s, e]) => e > s).sort((x, y) => x[0] - y[0])
  let total = 0, cur = null
  for (const [s, e] of iv) { if (!cur || s > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [s, e] } else cur[1] = Math.max(cur[1], e) }
  if (cur) total += cur[1] - cur[0]
  return total
}

// THE seat state. Depends ONLY on active assignments (and the disabled flag) — an expired membership or an unpaid
// due never changes it; only releasing the assignment does.
export function seatState(seat, active, win = DEFAULT_WINDOW) {
  if (seat?.disabled) return 'unavailable'
  const span = toMin(win.close) - toMin(win.open), got = coveredMinutes(active, win)
  if (got <= 0) return 'empty'
  return got >= span ? 'occupied' : 'partial'
}
export const STATE_COLOR = { occupied: 'green', partial: 'orange', empty: 'red', unavailable: 'gray' }

// ───────────── dues ─────────────
// "5d" under a month, "2m" from 30 days. (d = days, m = months)
export function dueAge(since, now = new Date()) {
  if (!since) return ''
  const days = Math.max(Math.floor((+new Date(now) - +new Date(since)) / DAY), 0)
  return days >= 30 ? `${Math.floor(days / 30)}m` : `${days}d`
}
export const rupees = (n) => '₹' + (Math.round(Number(n) * 100) / 100).toLocaleString('en-IN')
export const dueText = (amount, since, now) => (amount > 0.005 ? `${rupees(amount)} · ${dueAge(since, now)}` : '')

// ───────────── seat naming ─────────────
const rowLetters = (i) => { let s = '', n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0); return s }
const cleanName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)

// naming = { mode: 'grid' | 'sequence' | 'custom', ... }
//   grid     { rows: 5, perRow: 10, startRow: 'A' }            → A1…A10, B1…B10 …
//   sequence { prefix: '', start: 1, count: 40, pad: 0 }       → 1,2,3…  /  101,102…  /  Cabin-1, Cabin-2…
//   custom   { names: ['Window-1', 'Corner'] }
// Returns { names } or { error }. Names are unique within the batch; callers also check against existing seats.
export function buildSeatNames(naming = {}) {
  const mode = naming.mode || 'grid'
  let names = []
  if (mode === 'grid') {
    const rows = Math.floor(Number(naming.rows)), per = Math.floor(Number(naming.perRow))
    if (!(rows > 0) || !(per > 0)) return { error: 'Rows and seats per row must be at least 1.' }
    if (rows * per > MAX_SEATS_PER_BATCH) return { error: `At most ${MAX_SEATS_PER_BATCH} seats can be created at once.` }
    const first = String(naming.startRow || 'A').toUpperCase().replace(/[^A-Z]/g, '') || 'A'
    const startIdx = [...first].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1
    for (let r = 0; r < rows; r++) for (let c = 1; c <= per; c++) names.push(`${rowLetters(startIdx + r)}${c}`)
  } else if (mode === 'sequence') {
    const count = Math.floor(Number(naming.count)), start = Math.floor(Number(naming.start ?? 1)), pad = Math.max(Math.floor(Number(naming.pad)) || 0, 0)
    if (!(count > 0)) return { error: 'Number of seats must be at least 1.' }
    if (count > MAX_SEATS_PER_BATCH) return { error: `At most ${MAX_SEATS_PER_BATCH} seats can be created at once.` }
    if (Number.isNaN(start)) return { error: 'Start number is not valid.' }
    const prefix = String(naming.prefix || '').slice(0, 12)
    for (let i = 0; i < count; i++) names.push(`${prefix}${String(start + i).padStart(pad, '0')}`)
  } else if (mode === 'custom') {
    names = (Array.isArray(naming.names) ? naming.names : String(naming.names || '').split(/[\n,]/)).map(cleanName).filter(Boolean)
    if (!names.length) return { error: 'Enter at least one seat name.' }
    if (names.length > MAX_SEATS_PER_BATCH) return { error: `At most ${MAX_SEATS_PER_BATCH} seats can be created at once.` }
  } else return { error: 'Unknown seat naming mode.' }
  names = names.map(cleanName)
  const dup = names.find((n, i) => names.findIndex((x) => x.toLowerCase() === n.toLowerCase()) !== i)
  if (dup) return { error: `Seat name "${dup}" appears twice.` }
  if (names.some((n) => !n)) return { error: 'Seat names cannot be empty.' }
  return { names }
}

// natural order for A1, A2, A10, B1 … and 1, 2, 10 … and Cabin-2, Cabin-10
export const seatSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })

// ───────────── membership dates & status ─────────────
export function addMonths(date, n) {
  const d = new Date(date), day = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return d
}
// Renewal: the new period starts where the old one ends (if that is still ahead), otherwise today. History is never overwritten.
export const renewalStart = (oldEnd, now = new Date()) => (+new Date(oldEnd) > +new Date(now) ? new Date(oldEnd) : new Date(now))
export const isExpired = (endDate, now = new Date()) => !!endDate && +new Date(endDate) < +new Date(now)

// Member status shown in lists. Order matters:  Released · Inactive · Membership Expired · Pending Payment · Slot-based · Active
export function memberStatus({ released, inactive, endDate, due = 0, fullDay = true, hasMembership = true }, now = new Date()) {
  if (released) return 'Released'
  if (inactive || !hasMembership) return 'Inactive'
  if (isExpired(endDate, now)) return 'Membership Expired'
  if (due > 0.005) return 'Pending Payment'
  if (!fullDay) return 'Partially Active'
  return 'Active'
}
export const STATUS_TONE = { Active: 'green', 'Partially Active': 'orange', 'Membership Expired': 'red', 'Pending Payment': 'amber', Released: 'gray', Inactive: 'gray' }

// discount helper (same rules as utils/billing.js: percent capped at 100, fixed never above the base)
export function applyDiscount(base, { type = 'fixed', value = 0 } = {}) {
  const v = Number(value) > 0 ? Number(value) : 0
  const d = Math.min(type === 'percent' ? (base * Math.min(v, 100)) / 100 : v, base)
  return Math.round((d + Number.EPSILON) * 100) / 100
}
