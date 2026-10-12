import express from 'express'
import { protect, requireSeller } from '../../middleware/auth.js'
import { searchCustomers } from '../../controllers/common/billingController.js'
import { listCustomers, getCustomer, getCustomerHistory, updateCustomer, customerActivity, getTransactions, addAdjustment, getGlobalHistory } from '../../controllers/common/customerController.js'

const router = express.Router()
router.use(protect, requireSeller)

router.get('/', listCustomers)               // light rows for the dashboard table
router.get('/search', searchCustomers)      // billing type-ahead — must stay above '/:id'
router.get('/activity', customerActivity)    // chart data — must stay above '/:id'
router.get('/:id', getCustomer)              // full detail page: info + orders + udhar history + balance history
router.get('/:id/history', getCustomerHistory)
router.get('/:id/transactions', getTransactions)   // timeline: Bill · Payment · Udhar · Adjustment with running balance
router.get('/:id/global', getGlobalHistory)    // same person across every shop (lazy: loaded only when that tab opens)
router.post('/:id/adjustment', addAdjustment)
router.patch('/:id', updateCustomer)

export default router
