import BillCounter from '../models/BillCounter.js'

// Bill ID:  #<YY><MM><DD><SERIES><COUNT>      e.g. #261003A0101
//
//  • The "#" is display-only. The database stores "261003A0101" so the id can sit safely in
//    URLs (a literal "#" would be treated as a URL fragment). Use displayBillId() for the UI.
//  • COUNT starts at 0101 (not 0001) so a shop never looks brand new.
//  • At 9999 the series moves on:  A9999 → B0001.
//  • Counters are per shop and per day.

export const BILL_TZ = process.env.BILL_TZ || 'Asia/Kolkata' // the shop's calendar day, not the server's
export const FIRST_COUNT = 101
export const MAX_COUNT = 9999
const SERIES_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const FIRST_SERIES_CAPACITY = MAX_COUNT - FIRST_COUNT + 1 // 9,899 bills in series A (0101…9999)

// Given in the brief; used for the (non-atomic) reference implementation and tests.
export function nextAlphabet(letter) {
  return String.fromCharCode(letter.charCodeAt(0) + 1)
}

// Year / month / day as the shop sees them (so a bill at 00:30 IST is not dated "yesterday" on a UTC server).
export function dateParts(now = new Date(), timeZone = BILL_TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  )
  return { yyyy: parts.year, yy: parts.year.slice(-2), mm: parts.month, dd: parts.day, date: `${parts.year}-${parts.month}-${parts.day}` }
}

// Pure mapping: the Nth bill of the day  →  { series, count }.  (1st → A0101, 9,899th → A9999, 9,900th → B0001 …)
// The database pipeline below implements exactly the same arithmetic.
export function slotFor(issued) {
  if (issued <= FIRST_SERIES_CAPACITY) return { series: 'A', count: FIRST_COUNT - 1 + issued }
  const m = issued - FIRST_SERIES_CAPACITY - 1
  const idx = 1 + Math.floor(m / MAX_COUNT)
  if (idx >= SERIES_LETTERS.length) throw new Error('Daily bill limit reached for this shop (series Z exhausted).')
  return { series: SERIES_LETTERS[idx], count: (m % MAX_COUNT) + 1 }
}

export const formatBillId = ({ yy, mm, dd, series, count }) => `${yy}${mm}${dd}${series}${String(count).padStart(4, '0')}`

// Internal / support id, e.g. RAB50-20261003-A-0101
export const formatFullId = ({ shopRef, yyyy, mm, dd, series, count }) => `${shopRef}-${yyyy}${mm}${dd}-${series}-${String(count).padStart(4, '0')}`

// ONE round-trip, fully atomic: increment `issued`, then derive series + count from it.
// Every concurrent request gets a distinct `issued`, so no two requests can ever share an id.
// (A plain $inc on `count` can't do the 101 start or the A9999 → B0001 rollover safely.)
const A_CAP = FIRST_SERIES_CAPACITY
const advancePipeline = () => [
  { $set: { issued: { $add: [{ $ifNull: ['$issued', 0] }, 1] } } },
  {
    $set: {
      _idx: {
        $cond: [{ $lte: ['$issued', A_CAP] }, 0, { $toInt: { $add: [1, { $floor: { $divide: [{ $subtract: ['$issued', A_CAP + 1] }, MAX_COUNT] } }] } }],
      },
      count: {
        $cond: [{ $lte: ['$issued', A_CAP] }, { $add: ['$issued', FIRST_COUNT - 1] }, { $toInt: { $add: [{ $mod: [{ $subtract: ['$issued', A_CAP + 1] }, MAX_COUNT] }, 1] } }],
      },
    },
  },
  { $set: { series: { $cond: [{ $lt: ['$_idx', SERIES_LETTERS.length] }, { $substrBytes: [SERIES_LETTERS, '$_idx', 1] }, 'OVERFLOW'] } } },
  { $unset: '_idx' },
]

export const __pipelineForTest = advancePipeline // exposed for tests only

const shopRefOf = (shop) =>
  String(shop.shopCode || shop.username || shop._id).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || String(shop._id).slice(-6).toUpperCase()

// Allocate the next bill id for a shop.  `shop` needs at least { _id } (shopCode/username make the fullId nicer).
export async function generateBillId(shop, { now = new Date() } = {}) {
  const d = dateParts(now)
  let doc
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      doc = await BillCounter.findOneAndUpdate({ shopId: shop._id, date: d.date }, advancePipeline(), { new: true, upsert: true })
      break
    } catch (e) {
      // Two first-bills-of-the-day racing to create the counter: the loser hits the unique index — just retry.
      if (e.code === 11000 && attempt < 3) continue
      throw e
    }
  }
  if (!doc || doc.series === 'OVERFLOW') throw new Error('Daily bill limit reached for this shop (series Z exhausted).')
  const slot = { series: doc.series, count: doc.count }
  return {
    billId: formatBillId({ ...d, ...slot }),
    fullId: formatFullId({ shopRef: shopRefOf(shop), ...d, ...slot }),
    ...slot,
    date: d.date,
  }
}

// What the UI shows. New ids get the "#"; older bills (24-char Mongo ids) keep a short legacy label.
const NEW_ID = /^\d{6}[A-Z]\d{4}$/
export function displayBillId(billId, legacyPrefix = '#') {
  const id = String(billId || '')
  return NEW_ID.test(id) ? `#${id}` : `${legacyPrefix}${id.slice(-4).toUpperCase()}`
}

// Old databases have a GLOBAL unique index on billId. New ids repeat across shops (every shop has an A0101),
// so uniqueness must be per shop. Safe to run on every boot.
export async function ensureBillIndexes() {
  const { default: Bill } = await import('../models/Bill.js')
  try { await Bill.collection.dropIndex('billId_1') } catch { /* already gone / never existed */ }
  await Bill.syncIndexes().catch(() => Bill.createIndexes())
  await BillCounter.createIndexes()
}
