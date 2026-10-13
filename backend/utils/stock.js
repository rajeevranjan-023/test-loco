import mongoose from 'mongoose'
import Product from '../models/Product.js'
import Counter from '../models/Counter.js'

// =====================================================================================================

export const r3 = (n) => Math.round(n * 1000) / 1000 // kg quantities: 3 decimals avoids float drift
const EPS = 0.0005

export class StockError extends Error {
  constructor(message) { super(message); this.name = 'StockError'; this.status = 400; this.expose = true }
}

const newId = () => new mongoose.Types.ObjectId()
const sameId = (a, b) => a != null && b != null && String(a) === String(b)
const isTracked = (p) => p.listed !== false // items typed at the till but not in inventory have no stock to track

// Batches that still hold stock, oldest first (ties keep insertion order).
export function liveBatchesOldestFirst(p) {
  return (p.batches || [])
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => !b.exhausted && b.remainingQty > EPS)
    .sort((x, y) => +new Date(x.b.addedAt) - +new Date(y.b.addedAt) || x.i - y.i)
    .map(({ b }) => b)
}

// stock = Σ remaining; also keeps the `exhausted` flags honest.
export function syncStock(p) {
  let total = 0
  for (const b of p.batches || []) {
    if (b.remainingQty <= EPS) { b.remainingQty = 0; if (!b.exhausted) { b.exhausted = true; b.exhaustedAt = b.exhaustedAt || new Date() } }
    else if (b.exhausted) { b.exhausted = false; b.exhaustedAt = null }
    total += b.remainingQty
  }
  p.stock = r3(total)
  return p.stock
}

// Products created before batches existed: turn their current stock into one "opening" batch (idempotent).
export function ensureBatches(p) {
  if (!isTracked(p)) return false
  if ((p.batches || []).length === 0 && p.stock > EPS) {
    p.batches.push({ _id: newId(), quantity: p.stock, remainingQty: p.stock, costPrice: p.costPrice || 0, addedAt: p.createdAt || new Date(), source: 'opening', note: 'Opening stock (migrated)', exhausted: false, adjustedQty: 0, editLog: [] })
    syncStock(p)
    return true
  }
  if ((p.batches || []).length) { const before = p.stock; syncStock(p); return before !== p.stock }
  return false
}

// New purchase → NEW batch. Never touches older batches.
export function addBatch(p, { quantity, costPrice, sellingPrice = null, addedAt = new Date(), source = 'restock', note = '' }) {
  quantity = r3(Number(quantity)); costPrice = Number(costPrice)
  if (!(quantity > 0)) throw new StockError('Quantity must be greater than 0.')
  if (!(costPrice >= 0)) throw new StockError('Cost price must be 0 or more.')
  ensureBatches(p)
  const batch = { _id: newId(), quantity, remainingQty: quantity, costPrice, sellingPrice: sellingPrice === null ? null : Number(sellingPrice), addedAt, source, note: String(note).slice(0, 200), exhausted: false, adjustedQty: 0, editLog: [] }
  p.batches.push(batch)
  syncStock(p)
  return p.batches[p.batches.length - 1]
}

// FIFO sale: oldest batch first, partial consumption allowed. Returns the cost breakdown for the Sale line.
export function consumeFIFO(p, qty) {
  qty = r3(Number(qty))
  if (!(qty > 0)) throw new StockError('Quantity must be greater than 0.')
  if (!isTracked(p)) return [{ batchId: null, qty, costPrice: p.costPrice || 0 }] // untracked item: cost as typed, no batches
  ensureBatches(p)
  const live = liveBatchesOldestFirst(p)
  const available = r3(live.reduce((s, b) => s + b.remainingQty, 0))
  if (available + EPS < qty) throw new StockError(`Only ${available} of "${p.name}" in stock.`)
  const out = []
  let need = qty
  for (const b of live) {
    if (need <= EPS) break
    const take = r3(Math.min(b.remainingQty, need))
    b.remainingQty = r3(b.remainingQty - take)
    need = r3(need - take)
    out.push({ batchId: b._id, qty: take, costPrice: b.costPrice })
  }
  syncStock(p)
  return out
}

// Manual stock correction downwards (stock count lower than the system): also oldest-first, but NOT a sale.
export function writeOffFIFO(p, qty) {
  const pieces = consumeFIFO(p, qty)
  for (const piece of pieces) {
    const b = p.batches.find((x) => sameId(x._id, piece.batchId))
    if (b) b.adjustedQty = r3((b.adjustedQty || 0) + piece.qty)
  }
  return pieces
}

// Put sold quantity back (cancelled order / reduced quantity) into the batches it came from.
export function restoreToBatches(p, breakdown, fallbackDate = new Date()) {
  if (!isTracked(p)) return
  for (const piece of breakdown || []) {
    const qty = r3(piece.qty)
    if (!(qty > 0)) continue
    const b = piece.batchId ? p.batches.find((x) => sameId(x._id, piece.batchId)) : null
    if (b) {
      b.remainingQty = r3(b.remainingQty + qty)
      if (b.remainingQty + (b.adjustedQty || 0) > b.quantity) b.quantity = r3(b.remainingQty + (b.adjustedQty || 0))
    } else {
      p.batches.push({ _id: newId(), quantity: qty, remainingQty: qty, costPrice: piece.costPrice || 0, addedAt: fallbackDate, source: 'return', note: 'Returned from a cancelled / edited sale', exhausted: false, adjustedQty: 0, editLog: [] })
    }
  }
  syncStock(p)
}

// What a Sale line consumed (legacy lines without a breakdown fall back to their single costAtSale).
export const breakdownOfSale = (sale) =>
  sale.costBreakdown && sale.costBreakdown.length
    ? sale.costBreakdown.map((x) => ({ batchId: x.batchId || null, qty: x.qty, costPrice: x.costPrice }))
    : [{ batchId: null, qty: sale.quantity, costPrice: sale.costAtSale || 0 }]

// Weighted-average cost of a breakdown. (price − this) × qty == Σ (price − batchCost) × batchQty, exactly.
export function weightedCost(breakdown) {
  const q = breakdown.reduce((s, x) => s + x.qty, 0)
  return q > 0 ? breakdown.reduce((s, x) => s + x.qty * x.costPrice, 0) / q : 0
}
export const totalCost = (breakdown) => breakdown.reduce((s, x) => s + x.qty * x.costPrice, 0)

// Reduce a sale by `qty`: the NEWEST pieces are given back first (they were taken last).
export function trimBreakdown(breakdown, qty) {
  const kept = breakdown.map((x) => ({ ...x })), removed = []
  let need = r3(qty)
  for (let i = kept.length - 1; i >= 0 && need > EPS; i--) {
    const take = r3(Math.min(kept[i].qty, need))
    removed.push({ ...kept[i], qty: take })
    kept[i].qty = r3(kept[i].qty - take)
    need = r3(need - take)
  }
  return { kept: kept.filter((x) => x.qty > EPS), removed }
}

// History edit: fix an old batch's cost and/or total quantity. Past sales keep their snapshot unless the
export function applyBatchEdit(p, batchId, { costPrice, quantity }, { recalculated = false } = {}) {
  const b = (p.batches || []).find((x) => sameId(x._id, batchId))
  if (!b) throw new StockError('Batch not found.')
  const changes = []
  if (costPrice !== undefined && costPrice !== null && costPrice !== '') {
    const c = Number(costPrice)
    if (!(c >= 0)) throw new StockError('Cost price must be 0 or more.')
    if (c !== b.costPrice) { changes.push({ field: 'costPrice', from: b.costPrice, to: c, at: new Date(), recalculated }); b.costPrice = c }
  }
  if (quantity !== undefined && quantity !== null && quantity !== '') {
    const qn = r3(Number(quantity))
    const left = r3(b.quantity - b.remainingQty) // already sold or written off from this batch
    if (!(qn >= left) || !(qn > 0)) throw new StockError(`Quantity can't be less than ${left || 0.001} — that much has already left this batch.`)
    if (qn !== b.quantity) { changes.push({ field: 'quantity', from: b.quantity, to: qn, at: new Date(), recalculated: false }); b.quantity = qn; b.remainingQty = r3(qn - left) }
  }
  for (const c of changes) b.editLog.push(c)
  if (b.editLog.length > 20) b.editLog.splice(0, b.editLog.length - 20)
  syncStock(p)
  return { batch: b, changes }
}

// ---------------------------------------------------------------------------------------------------
//  Product codes  (A001 … A999, B001 …) — atomic per shop
// ---------------------------------------------------------------------------------------------------
export function codeFor(n) {
  const idx = Math.floor((n - 1) / 999)
  return idx < 26 ? `${String.fromCharCode(65 + idx)}${String(((n - 1) % 999) + 1).padStart(3, '0')}` : `X${n}`
}
export async function nextProductCode(shopId) {
  const c = await Counter.findOneAndUpdate({ _id: `product:${shopId}` }, { $inc: { seq: 1 } }, { new: true, upsert: true })
  return codeFor(c.seq)
}

// ---------------------------------------------------------------------------------------------------
export async function withProduct(filter, mutate, retries = 8) {
  for (let i = 0; ; i++) {
    const p = await Product.findOne(filter)
    if (!p) return null
    try {
      const out = await mutate(p)
      await p.save()
      return out === undefined ? p : out
    } catch (e) {
      if (e.name === 'VersionError' && i < retries) continue
      throw e
    }
  }
}

// Boot-time, idempotent: give every product a code and every legacy stock an opening batch.
export async function migrateInventory() {
  const need = await Product.find({ $or: [{ productCode: { $exists: false } }, { productCode: null }] }).sort({ createdAt: 1 }).select('_id shopId')
  for (const { _id, shopId } of need) {
    for (let t = 0; t < 3; t++) {
      try { await Product.updateOne({ _id, $or: [{ productCode: { $exists: false } }, { productCode: null }] }, { $set: { productCode: await nextProductCode(shopId) } }); break }
      catch (e) { if (e.code !== 11000) throw e }
    }
  }
  const legacy = await Product.find({ listed: { $ne: false }, stock: { $gt: 0 }, 'batches.0': { $exists: false } })
  let n = 0
  for (const p of legacy) { if (ensureBatches(p)) { try { await p.save(); n++ } catch (e) { if (e.name !== 'VersionError') throw e } } }
  await Product.createIndexes().catch(() => null)
  return { coded: need.length, batched: n }
}

// Merge neighbouring pieces that came from the same batch at the same cost (keeps stored breakdowns compact).
export function mergeBreakdown(pieces) {
  const out = []
  for (const x of pieces) {
    const hit = out.find((y) => String(y.batchId) === String(x.batchId) && y.costPrice === x.costPrice)
    if (hit) hit.qty = r3(hit.qty + x.qty)
    else out.push({ batchId: x.batchId || null, qty: r3(x.qty), costPrice: x.costPrice })
  }
  return out
}
