import express from 'express'
import { protect, requireSeller } from '../../middleware/auth.js'
import { getOrder, addOrderPayment, convertPaid, updateOrderStatus } from '../../controllers/common/ordersController.js'

const router = express.Router()
router.use(protect, requireSeller)
const withBillId = (h) => (req, res, next) => { req.params.billId = req.params.id; return h(req, res, next) }

router.get('/:id', withBillId(getOrder))                    // full bill: header, items, payment summary, ledger effects
router.post('/:id/payment', withBillId(addOrderPayment))    // Add Payment
router.post('/:id/convert-paid', withBillId(convertPaid))   // Convert to Paid
router.patch('/:id/status', withBillId(updateOrderStatus))

export default router
