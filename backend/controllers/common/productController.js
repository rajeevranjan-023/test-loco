import Product from '../../models/common/Product.js'
import Sale from '../../models/common/Sale.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { addBatch, ensureBatches, writeOffFIFO, nextProductCode, withProduct, r3, StockError } from '../../utils/common/stock.js'

// _________________________________________________________________________
// =========================================================================
// GET /api/products  (public — trending products across all shops, for the homepage)
export const listAllProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ listed: { $ne: false } }).populate('shopId', 'shopName username').limit(30)
  res.json(
    products.map((p) => ({
      id: p._id,
      name: p.name,
      price: p.price,
      priceUnit: p.priceUnit,
      icon: p.icon,
      imageUrl: p.imageUrl,
      shopId: p.shopId?._id,
      shopName: p.shopId?.shopName || 'Unknown Shop',
      shopUsername: p.shopId?.username || null,
    }))
  )
})

// _________________________________________________________________________
// =========================================================================
// GET /api/seller/products  (protected, shop sellers only)
export const listMyProducts = asyncHandler(async (req, res) => {
  if (!req.sellerAccount) {
    return res.status(403).json({ message: 'Only shop accounts have products.' })
  }
  const shopId = req.sellerAccount._id
  const [products, lines] = await Promise.all([
    Product.find({ shopId }).sort({ createdAt: -1 }),
    // Real, batch-wise profit per product: Σ (priceAtSale − costAtSale) × qty over non-cancelled sale lines.
    Sale.find({ shopId, cancelled: { $ne: true } }).select('productId priceAtSale costAtSale quantity').lean(),
  ])
  const byId = new Map()
  for (const l of lines) {
    const k = String(l.productId), r = byId.get(k) || { revenue: 0, cost: 0 }
    r.revenue += l.priceAtSale * l.quantity; r.cost += l.costAtSale * l.quantity
    byId.set(k, r)
  }
  res.json(products.map((p) => {
    const o = p.toJSON()
    const r = byId.get(String(p._id))
    o.realizedRevenue = Math.round((r?.revenue || 0) * 100) / 100
    o.realizedProfit = Math.round(((r?.revenue || 0) - (r?.cost || 0)) * 100) / 100
    o.liveBatches = (o.batches || []).filter((b) => !b.exhausted).length
    delete o.batches // the full batch list lives behind GET /products/:id/history
    return o
  }))
})

// _________________________________________________________________________
// =========================================================================
// POST /api/seller/products  (protected)
export const createProduct = asyncHandler(async (req, res) => {
  if (!req.sellerAccount) {
    return res.status(403).json({ message: 'Only shop accounts can add products.' })
  }
  const { name, price, priceUnit, costPrice, costPriceUnit, stock, icon, imageUrl, videoUrl, description, category, lowStockAt, active, expiryDate, listed, sellable } = req.body
  if (!name || price == null || costPrice == null) {
    return res.status(400).json({ message: 'name, price and costPrice are required.' })
  }

  const product = new Product({
    shopId: req.sellerAccount._id,
    productCode: await nextProductCode(req.sellerAccount._id),
    name,
    price,
    priceUnit: ['kg', 'liter'].includes(priceUnit) ? priceUnit : 'unit',
    costPrice,
    costPriceUnit: ['kg', 'liter'].includes(costPriceUnit) ? costPriceUnit : 'unit',
    stock: 0, // set below, through a batch
    category: category || 'Other',
    lowStockAt: lowStockAt ?? 10,
    icon: icon || '📦',
    imageUrl: imageUrl || '',
    videoUrl: videoUrl || '',
    description: description || '',
    sellable: sellable !== false,
  })
  product.priceHistory.push({ price, at: new Date() })
  product.costHistory.push({ costPrice, at: new Date() })
  if (Number(stock) > 0) addBatch(product, { quantity: Number(stock), costPrice, source: 'opening', note: 'Opening stock' })
  await product.save()
  res.status(201).json(product)
})

// _________________________________________________________________________
// =========================================================================
// PUT /api/seller/products/:productId  (protected)
export const updateProduct = asyncHandler(async (req, res) => {
  const { name, price, priceUnit, costPrice, costPriceUnit, stock, icon, imageUrl, videoUrl, description, category, lowStockAt, active, expiryDate, listed, sellable } = req.body

  const product = await withProduct({ _id: req.params.productId, shopId: req.sellerAccount._id }, (p) => {
    if (name !== undefined) {
      const n = String(name).trim().slice(0, 80)
      if (!n) throw new StockError('Product name can\'t be empty.')
      p.name = n // rename
    }
    // Selling price: the product holds the latest; every change is also appended to priceHistory.
    if (price !== undefined && Number(price) !== p.price) {
      if (!(Number(price) >= 0)) throw new StockError('Selling price must be 0 or more.')
      p.price = Number(price); p.priceHistory.push({ price: p.price, at: new Date() })
    }
    if (priceUnit !== undefined) p.priceUnit = ['kg', 'liter'].includes(priceUnit) ? priceUnit : 'unit'
    // Cost price: NEVER rewrites old stock. It becomes the latest cost (used by the next batch) and adds a history line.
    if (costPrice !== undefined && Number(costPrice) !== p.costPrice) {
      if (!(Number(costPrice) >= 0)) throw new StockError('Cost price must be 0 or more.')
      p.costPrice = Number(costPrice); p.costHistory.push({ costPrice: p.costPrice, at: new Date() })
    }
    if (costPriceUnit !== undefined) p.costPriceUnit = ['kg', 'liter'].includes(costPriceUnit) ? costPriceUnit : 'unit'
    if (listed !== undefined) p.listed = !!listed // before stock: an unlisted till item being moved into inventory gets its batch too
    // Absolute `stock` (older screens): more → new batch at the latest cost, less → oldest-first write-off.
    if (stock !== undefined) {
      const target = r3(Number(stock))
      if (!(target >= 0)) throw new StockError('Stock can\'t be negative.')
      ensureBatches(p)
      const delta = r3(target - p.stock)
      if (delta > 0) addBatch(p, { quantity: delta, costPrice: p.costPrice, note: 'Stock added' })
      else if (delta < 0 && p.listed !== false) writeOffFIFO(p, -delta)
    }
    if (category !== undefined) p.category = category
    if (sellable !== undefined) p.sellable = !!sellable // false = service-material only
    if (lowStockAt !== undefined) p.lowStockAt = lowStockAt
    if (active !== undefined) p.active = !!active
    if (expiryDate !== undefined) p.expiryDate = expiryDate || null
    if (icon !== undefined) p.icon = icon
    if (imageUrl !== undefined) p.imageUrl = imageUrl
    if (videoUrl !== undefined) p.videoUrl = videoUrl
    if (description !== undefined) p.description = description
  })
  if (!product) return res.status(404).json({ message: 'Product not found.' })
  res.json(product)
})

// _________________________________________________________________________
// =========================================================================
// DELETE /api/seller/products/:productId  (protected)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({
    _id: req.params.productId,
    shopId: req.sellerAccount._id,
  })
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' })
  }
  res.json({ message: 'Product deleted.' })
})
// _________________________________________________________________________
// =========================================================================
