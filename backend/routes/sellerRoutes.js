import express from 'express'
import { protect, requireSeller, requireOwner } from '../middleware/auth.js'

const router = express.Router()
// _________________________________________________________________________
import { 
  startSellerAccount, 
  getMySellerAccount, 
  updateSellerAccount,
  checkUsernameAvailability } from '../controllers/sellerController.js'
router.post('/start', protect, startSellerAccount)
router.get('/me', protect, getMySellerAccount)
router.patch('/account', protect, updateSellerAccount)
router.get('/check-username/:username', protect, checkUsernameAvailability)

// Everything ABOVE this line (start / me / account / check-username) must be
// reachable by non-sellers — they need /start to BECOME sellers. Everything
// BELOW requires an existing seller account.
router.use(protect, requireSeller)

// Owner check for /:username/* dashboard URLs — 200 for the owner, 403 for everyone else.
router.get('/owner/:username', requireOwner(), (req, res) => res.json({ isOwner: true }))

import studyRoutes from './studyRoutes.js'
router.use('/study', studyRoutes) // study-centre module (guarded by the seatManagement capability)

// _________________________________________________________________________
import {
  listMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,} from '../controllers/productController.js'
router.get('/products', listMyProducts)
router.post('/products', createProduct)
router.put('/products/:productId', updateProduct)
router.delete('/products/:productId', deleteProduct)

// Inventory: search, batch-wise restock, cost history
import { searchProducts, addStock, getProductHistory, editBatch, addInventoryProduct } from '../controllers/inventoryController.js'
router.get('/inventory/search', searchProducts)
router.post('/inventory/add', addInventoryProduct)
router.post('/products/:productId/stock', addStock)
router.get('/products/:productId/history', getProductHistory)
router.patch('/products/:productId/batches/:batchId', editBatch)

// _________________________________________________________________________
import { recordSale, listSales, updateSale, listBills } from '../controllers/salesController.js'
router.post('/sales', recordSale)
router.get('/sales', listSales)
router.put('/sales/:saleId', updateSale)
router.get('/bills', listBills)

// _________________________________________________________________________
// LEGACY (kept for backward compatibility): only called by features/seller/AnalyticsPanel.jsx (not mounted by the router) and asserted by
// billing.int / billing2.int / smoke tests. Current screens use /insights (shop), /billing/summary (service) and /study/analytics.
import { getAnalytics } from '../controllers/shop/analyticsController.js'
router.get('/analytics', getAnalytics)

// Full SaaS-style dashboard payload (KPIs, charts, tables) for /analytics page
// LEGACY: no caller in frontend/src, frontend tests or backend tests (traced). Kept because external/older clients cannot be ruled out.
import { getDashboard } from '../controllers/shop/dashboardController.js'
router.get('/dashboard', getDashboard)
import { getInsights } from '../controllers/shop/insightsController.js'
router.get('/insights', getInsights)

// Keyboard-first billing screen
import { searchCustomers, addCustomer, selectGlobalCustomer, billingProducts, recentBills, billDetail, listDrafts, saveDraft, getDraft, deleteDraft, getBillingConfig, updateBillingConfig, listServices, saveService, deleteService, billingSummary, billDocument } from '../controllers/billingController.js'
router.get('/billing/customers', searchCustomers)
router.post('/billing/customers', addCustomer)
router.post('/billing/customers/select', selectGlobalCustomer)
router.get('/billing/drafts', listDrafts)
router.post('/billing/drafts', saveDraft)
router.get('/billing/drafts/:id', getDraft)
router.delete('/billing/drafts/:id', deleteDraft)
router.get('/billing/products', billingProducts)
router.get('/billing/config', getBillingConfig)
router.put('/billing/config', updateBillingConfig)
router.get('/billing/services', listServices)
router.post('/billing/services', saveService)
router.delete('/billing/services/:id', deleteService)
router.get('/billing/summary', billingSummary)
router.get('/billing/bills/:billId/document', billDocument)
router.get('/billing/recent', recentBills)
router.get('/billing/bills/:billId', billDetail)

// Udhar notebook (ledger): overview, manual add/payment, per-customer history, entry detail, pinning
import { overview as udharOverview, addEntry as udharAdd, customerHistory, entryDetail, setPinned } from '../controllers/udharController.js'
router.get('/udhar/overview', udharOverview)
router.post('/udhar/entries', udharAdd)
router.get('/udhar/entries/:entryId', entryDetail)
router.get('/udhar/customers/:id/history', customerHistory)
router.patch('/udhar/customers/:id/pin', setPinned)

// Seller panel pages: shell summary, orders, customers, offers, messages
import { getSummary, listOffers, createOffer, updateOffer, deleteOffer, listConversations, getThread, sendMessage } from '../controllers/panelController.js'
router.get('/summary', getSummary)
import { listOrders, getOrder, updateOrderStatus, editOrder, deleteOrder, addOrderPayment } from '../controllers/ordersController.js'
router.get('/orders', listOrders)
router.get('/orders/:billId', getOrder)
router.patch('/orders/:billId/status', updateOrderStatus)
router.patch('/orders/:billId', editOrder)
router.delete('/orders/:billId', deleteOrder)
router.post('/orders/:billId/payment', addOrderPayment)
router.get('/offers', listOffers)
router.post('/offers', createOffer)
router.patch('/offers/:offerId', updateOffer)
router.delete('/offers/:offerId', deleteOffer)
router.get('/messages', listConversations)
router.get('/messages/:customerName', getThread)
router.post('/messages', sendMessage)

// _________________________________________________________________________
import {
  listCredits,
  addCredit,
  updateCredit,
  togglePinCredit,
  markCreditPaid,
  deleteCredit,} from '../controllers/shop/creditController.js'
router.get('/credits', listCredits)
router.post('/credits', addCredit)
router.patch('/credits/:creditId', updateCredit)
router.patch('/credits/:creditId/pin', togglePinCredit)
router.patch('/credits/:creditId/pay', markCreditPaid)
router.delete('/credits/:creditId', deleteCredit)

// _________________________________________________________________________
export default router
