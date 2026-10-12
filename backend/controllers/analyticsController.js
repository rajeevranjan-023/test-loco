import Product from '../models/common/Product.js'
import Sale from '../models/common/Sale.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// _________________________________________________________________________
// =========================================================================
// GET /api/seller/analytics  (protected, shop sellers only)
export const getAnalytics = asyncHandler(async (req, res) => {
  if (req.sellerType !== 'shop') {
    return res.status(403).json({ message: 'Only shop accounts have analytics.' })
  }

  const shopId = req.sellerAccount._id
  const sales = await Sale.find({ shopId })
  const products = await Product.find({ shopId, listed: { $ne: false } })

  const totalSalesOnline = sales
    .filter((s) => s.channel === 'online')
    .reduce((sum, s) => sum + s.priceAtSale * s.quantity, 0)
  const totalSalesOffline = sales
    .filter((s) => s.channel === 'offline')
    .reduce((sum, s) => sum + s.priceAtSale * s.quantity, 0)
  const totalSales = totalSalesOnline + totalSalesOffline

  const totalProfit = sales.reduce(
    (sum, s) => sum + (s.priceAtSale - s.costAtSale) * s.quantity,
    0
  )
  const totalLoss = sales
    .filter((s) => s.priceAtSale < s.costAtSale)
    .reduce((sum, s) => sum + (s.costAtSale - s.priceAtSale) * s.quantity, 0)

  const totalUnitsSold = sales.reduce((sum, s) => sum + s.quantity, 0)

  const perProduct = products.map((p) => {
    const productSales = sales.filter((s) => s.productId.toString() === p._id.toString())
    const unitsSold = productSales.reduce((sum, s) => sum + s.quantity, 0)
    const revenue = productSales.reduce((sum, s) => sum + s.priceAtSale * s.quantity, 0)
    const profit = productSales.reduce((sum, s) => sum + (s.priceAtSale - s.costAtSale) * s.quantity, 0)
    const salesShare = totalUnitsSold > 0 ? (unitsSold / totalUnitsSold) * 100 : 0

    return {
      productId: p._id,
      name: p.name,
      icon: p.icon,
      stock: p.stock,
      unitsSold,
      revenue,
      profit,
      salesSharePercent: Number(salesShare.toFixed(1)),
      performance: profit > 0 ? (salesShare > 20 ? 'high' : 'medium') : 'low',
    }
  })

  const sortKey = req.query.sort
  if (sortKey === 'profit') {
    perProduct.sort((a, b) => b.profit - a.profit)
  } else if (sortKey === 'lowest') {
    perProduct.sort((a, b) => a.unitsSold - b.unitsSold)
  } else {
    perProduct.sort((a, b) => b.unitsSold - a.unitsSold) // default: highest selling
  }

  res.json({
    totals: {
      totalSales,
      totalSalesOnline,
      totalSalesOffline,
      totalProfit,
      totalLoss,
      totalUnitsSold,
      totalOrders: sales.length,
    },
    products: perProduct,
  })
})
// _________________________________________________________________________
// =========================================================================