import Product from '../models/common/Product.js'
import Sale from '../models/common/Sale.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { addBatch, applyBatchEdit, ensureBatches, withProduct, weightedCost, r3, nextProductCode, StockError } from '../utils/common/stock.js'

const sid = (req) => req.sellerAccount._id
const shopOnly = (req, res) => {
  if (!req.sellerAccount) { res.status(403).json({ message: 'Seller account required.' }); return true }
  return false
}
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// GET /api/seller/inventory/search?q=&limit=      (limit is capped at 10)
// Name or product ID. Fewer than 2 characters → nothing is searched (and nothing hits the database).
export const searchProducts = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const q = String(req.query.q || '').trim().slice(0, 40)
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 10)
  if (q.length < 2) return res.json({ query: q, results: [], total: 0 })

  const re = new RegExp(esc(q), 'i')
  const or = [{ name: re }, { productCode: re }]
  if (/^[0-9a-f]{24}$/i.test(q)) or.push({ _id: q })
  const filter = { shopId: sid(req), listed: { $ne: false }, $or: or }

  const [docs, total] = await Promise.all([
    Product.find(filter).select('productCode name price costPrice stock lowStockAt icon imageUrl category priceUnit').limit(60).lean(),
    Product.countDocuments(filter),
  ])
  const lo = q.toLowerCase(), up = q.toUpperCase()
  const rank = (p) => {
    const n = p.name.toLowerCase()
    if (p.productCode === up) return 0                                   // exact product ID
    if ((p.productCode || '').startsWith(up)) return 1
    if (n.startsWith(lo)) return 2                                       // name starts with the text
    if (n.split(/[\s(),-]+/).some((w) => w.startsWith(lo))) return 3     // a word inside the name starts with it
    return 4
  }
  const results = docs.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name)).slice(0, limit)
  res.json({ query: q, results, total })
})

// POST /api/seller/products/:productId/stock   { quantity, costPrice?, note? }
// Restock = a NEW batch. Older batches (and their cost prices) are never touched or merged.
export const addStock = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const quantity = Number(req.body.quantity)
  if (!(quantity > 0)) return res.status(400).json({ message: 'Enter a quantity greater than 0.' })
  let batch
  const product = await withProduct({ _id: req.params.productId, shopId: sid(req) }, (p) => {
    const cost = req.body.costPrice === undefined || req.body.costPrice === '' ? p.costPrice : Number(req.body.costPrice)
    if (!(cost >= 0)) throw new StockError('Cost price must be 0 or more.')
    if (cost !== p.costPrice) { p.costHistory.push({ costPrice: cost, at: new Date() }); p.costPrice = cost } // latest cost moves; old batches keep theirs
    batch = addBatch(p, { quantity, costPrice: cost, note: req.body.note || '' })
    batch = batch.toObject ? batch.toObject() : batch
  })
  if (!product) return res.status(404).json({ message: 'Product not found.' })
  res.status(201).json({ product: summary(product), batch })
})

const summary = (p) => ({ id: p._id, productCode: p.productCode, name: p.name, price: p.price, costPrice: p.costPrice, stock: p.stock, stockValue: p.stockValue, priceUnit: p.priceUnit })

// GET /api/seller/products/:productId/history   — batches (oldest → newest) + cost & price history
export const getProductHistory = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const product = await withProduct({ _id: req.params.productId, shopId: sid(req) }, (p) => { ensureBatches(p) }) // legacy stock → opening batch
  if (!product) return res.status(404).json({ message: 'Product not found.' })
  const batches = [...product.batches]
    .sort((a, b) => +new Date(a.addedAt) - +new Date(b.addedAt))
    .map((b) => ({
      id: b._id, quantity: b.quantity, remainingQty: b.remainingQty, costPrice: b.costPrice, sellingPrice: b.sellingPrice ?? null, addedAt: b.addedAt,
      soldQty: r3(b.quantity - b.remainingQty - (b.adjustedQty || 0)), adjustedQty: b.adjustedQty || 0,
      status: b.exhausted ? 'exhausted' : b.remainingQty < b.quantity ? 'partial' : 'full',
      source: b.source, note: b.note, editLog: b.editLog || [],
    }))
  const nextUp = batches.find((b) => b.status !== 'exhausted')
  res.json({
    product: summary(product),
    nextBatchId: nextUp?.id || null, // the batch the next sale will draw from
    batches,
    costHistory: [...product.costHistory].sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    priceHistory: [...product.priceHistory].sort((a, b) => +new Date(b.at) - +new Date(a.at)),
  })
})

// PATCH /api/seller/products/:productId/batches/:batchId   { costPrice?, quantity?, recalculate? }
// History edit. Bills are never rewritten. Past sales keep the cost they were billed with — unless
// `recalculate: true`, which re-prices the sales that drew from this batch so profit uses the corrected cost.
export const editBatch = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const { costPrice, quantity } = req.body
  if (costPrice === undefined && quantity === undefined) return res.status(400).json({ message: 'Nothing to change.' })
  const recalculate = req.body.recalculate === true
  let costChanged = null
  const product = await withProduct({ _id: req.params.productId, shopId: sid(req) }, (p) => {
    const { changes } = applyBatchEdit(p, req.params.batchId, { costPrice, quantity }, { recalculated: recalculate })
    costChanged = changes.find((c) => c.field === 'costPrice') ? Number(costPrice) : null
  })
  if (!product) return res.status(404).json({ message: 'Product not found.' })

  let salesUpdated = 0
  if (recalculate && costChanged !== null) {
    const sales = await Sale.find({ shopId: sid(req), productId: product._id, 'costBreakdown.batchId': req.params.batchId }).select('costBreakdown quantity').lean()
    const ops = sales.map((s) => {
      const bd = s.costBreakdown.map((x) => (String(x.batchId) === String(req.params.batchId) ? { ...x, costPrice: costChanged } : x))
      return { updateOne: { filter: { _id: s._id }, update: { $set: { costBreakdown: bd, costAtSale: weightedCost(bd) } } } }
    })
    if (ops.length) await Sale.bulkWrite(ops)
    salesUpdated = ops.length
  }
  res.json({ ok: true, salesUpdated, product: summary(product) })
})

// ---------------------------------------------------------------------------------------------------
// POST /api/seller/inventory/add   { name, stock, unit: 'kg'|'liter'|'unit', costPrice, sellingPrice, imageUrl? }
// The "keep adding" form. New name → new product (+ product ID A001…, + first batch).
// Same name (case-insensitive) → NOTHING is overwritten: a new batch with its own cost is added and the latest
// selling price becomes the live one. Returns { created, product, batch, message }.
const UNITS = { kg: 'kg', kgs: 'kg', liter: 'liter', litre: 'liter', l: 'liter', ltr: 'liter', unit: 'unit', units: 'unit', pcs: 'unit', pc: 'unit' }
const cleanName = (x) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, 80)
const numOrNaN = (v) => (v === '' || v === null || v === undefined || typeof v === 'object' ? NaN : Number(v))
const slim = (p) => { const o = p.toJSON(); o.liveBatches = (o.batches || []).filter((b) => !b.exhausted).length; delete o.batches; return o }

export const addInventoryProduct = asyncHandler(async (req, res) => {
  if (shopOnly(req, res)) return
  const name = cleanName(req.body.name)
  const unit = UNITS[String(req.body.unit || '').toLowerCase()]
  const stock = numOrNaN(req.body.stock), cost = numOrNaN(req.body.costPrice), sell = numOrNaN(req.body.sellingPrice)
  const imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl : ''

  const errors = {}
  if (!name) errors.name = 'Product name is required.'
  if (!unit) errors.unit = 'Choose kg, liter or unit.'
  if (Number.isNaN(stock)) errors.stock = 'Enter the total stock quantity.'
  else if (!Number.isFinite(stock) || stock <= 0) errors.stock = 'Stock must be greater than 0.'
  else if (unit === 'unit' && !Number.isInteger(stock)) errors.stock = 'Units must be a whole number.'
  if (Number.isNaN(cost)) errors.costPrice = 'Enter the cost price.'
  else if (!Number.isFinite(cost) || cost < 0) errors.costPrice = 'Cost price can\'t be negative.'
  if (Number.isNaN(sell)) errors.sellingPrice = 'Enter the selling price.'
  else if (!Number.isFinite(sell) || sell <= 0) errors.sellingPrice = 'Selling price must be greater than 0.'
  if (imageUrl.startsWith('data:') && imageUrl.length > 90000) errors.imageUrl = 'Image is too large — use a smaller photo.'
  if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors)[0], errors })

  const shopId = sid(req)
  const quantity = r3(stock)
  const existing = await Product.findOne({ shopId, name: new RegExp(`^${esc(name)}$`, 'i') }).select('_id priceUnit name productCode')

  // ---- same name → new batch, never an overwrite ----
  if (existing) {
    if (existing.priceUnit !== unit) {
      return res.status(400).json({ message: `"${existing.name}" is already tracked in ${existing.priceUnit}. Choose ${existing.priceUnit} to add stock to it.`, errors: { unit: `Existing product uses ${existing.priceUnit}.` }, existingUnit: existing.priceUnit })
    }
    let batch
    const product = await withProduct({ _id: existing._id, shopId }, (p) => {
      if (p.listed === false) p.listed = true // a till-typed item being stocked properly
      if (cost !== p.costPrice) { p.costHistory.push({ costPrice: cost, at: new Date() }); p.costPrice = cost }       // latest cost; old batches keep theirs
      if (sell !== p.price) { p.priceHistory.push({ price: sell, at: new Date() }); p.price = sell }                    // latest selling price becomes active
      if (req.body.sellable !== undefined) p.sellable = !!req.body.sellable
      if (imageUrl && !p.imageUrl) p.imageUrl = imageUrl                                                               // fill a missing photo, never replace one
      const b = addBatch(p, { quantity, costPrice: cost, sellingPrice: sell, note: 'Added from Add Product' })
      batch = b.toObject ? b.toObject() : b
    })
    if (!product) return res.status(404).json({ message: 'Product not found.' })
    return res.status(200).json({ created: false, product: slim(product), batch, message: `New batch added to ${product.name} (${product.productCode}) — now ${product.stock} ${product.priceUnit}.` })
  }

  // ---- new product ----
  let product
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      product = new Product({ shopId, productCode: await nextProductCode(shopId), name, price: sell, costPrice: cost, priceUnit: unit, costPriceUnit: unit, stock: 0, category: 'Other', imageUrl, icon: '📦', sellable: req.body.sellable !== false })
      product.priceHistory.push({ price: sell, at: new Date() })
      product.costHistory.push({ costPrice: cost, at: new Date() })
      addBatch(product, { quantity, costPrice: cost, sellingPrice: sell, source: 'opening', note: 'Opening stock' })
      await product.save()
      break
    } catch (e) { if (e.code === 11000 && attempt < 2) continue; throw e } // productCode race → take the next code
  }
  const batch = product.batches[0].toObject()
  res.status(201).json({ created: true, product: slim(product), batch, message: `${product.name} added as ${product.productCode} — ${product.stock} ${unit}.` })
})
