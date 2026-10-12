import Credit from '../../models/shop/Credit.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

const MAX_PINNED = 4

// _________________________________________________________________________
// =========================================================================
// GET /api/seller/credits?sort=recent|amount  (protected, shop sellers only)
// Returns unpaid (pinned first, then by the requested sort) and paid
// (most recently paid first) as two separate, pre-sorted lists.
export const listCredits = asyncHandler(async (req, res) => {
  if (req.sellerType !== 'shop') {
    return res.status(403).json({ message: 'Only shop accounts use the credit ledger.' })
  }

  const all = await Credit.find({ shopId: req.sellerAccount._id })
  const totalDue = all.filter((c) => !c.paid).reduce((sum, c) => sum + c.amount, 0)

  const sortMode = req.query.sort === 'amount' ? 'amount' : 'recent'

  const unpaid = all
    .filter((c) => !c.paid)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1 // pinned always first
      if (sortMode === 'amount') return b.amount - a.amount
      return new Date(b.createdAt) - new Date(a.createdAt)
    })

  const paid = all
    .filter((c) => c.paid)
    .sort((a, b) => new Date(b.paidAt || b.updatedAt) - new Date(a.paidAt || a.updatedAt))

  res.json({ unpaid, paid, totalDue, pinnedCount: unpaid.filter((c) => c.pinned).length })
})

// _________________________________________________________________________
// =========================================================================
// POST /api/seller/credits  (protected)
export const addCredit = asyncHandler(async (req, res) => {
  if (req.sellerType !== 'shop') {
    return res.status(403).json({ message: 'Only shop accounts use the credit ledger.' })
  }
  const { customerName, phone, amount, dueDate, notes } = req.body
  if (!customerName || amount == null) {
    return res.status(400).json({ message: 'customerName and amount are required.' })
  }

  const credit = await Credit.create({
    shopId: req.sellerAccount._id,
    customerName,
    phone,
    amount,
    dueDate: dueDate || null,
    notes,
  })
  res.status(201).json(credit)
})

// _________________________________________________________________________
// =========================================================================
// PATCH /api/seller/credits/:creditId  (protected) - edit customer/amount/notes
export const updateCredit = asyncHandler(async (req, res) => {
  const credit = await Credit.findOne({ _id: req.params.creditId, shopId: req.sellerAccount._id })
  if (!credit) {
    return res.status(404).json({ message: 'Credit entry not found.' })
  }

  const { customerName, phone, amount, dueDate, notes } = req.body
  if (customerName !== undefined) credit.customerName = customerName
  if (phone !== undefined) credit.phone = phone
  if (amount !== undefined) credit.amount = amount
  if (dueDate !== undefined) credit.dueDate = dueDate || null
  if (notes !== undefined) credit.notes = notes

  await credit.save()
  res.json(credit)
})

// _________________________________________________________________________
// =========================================================================
// PATCH /api/seller/credits/:creditId/pin  (protected) - toggle pin, max 4 at once
export const togglePinCredit = asyncHandler(async (req, res) => {
  const credit = await Credit.findOne({ _id: req.params.creditId, shopId: req.sellerAccount._id })
  if (!credit) {
    return res.status(404).json({ message: 'Credit entry not found.' })
  }
  if (credit.paid) {
    return res.status(400).json({ message: 'Only unpaid entries can be pinned.' })
  }

  if (!credit.pinned) {
    const pinnedCount = await Credit.countDocuments({ shopId: req.sellerAccount._id, pinned: true, paid: false })
    if (pinnedCount >= MAX_PINNED) {
      return res.status(400).json({ message: `You can only pin up to ${MAX_PINNED} entries. Unpin one first.` })
    }
  }

  credit.pinned = !credit.pinned
  await credit.save()
  res.json(credit)
})

// _________________________________________________________________________
// =========================================================================
// PATCH /api/seller/credits/:creditId/pay  (protected) - mark as paid
export const markCreditPaid = asyncHandler(async (req, res) => {
  const credit = await Credit.findOne({ _id: req.params.creditId, shopId: req.sellerAccount._id })
  if (!credit) {
    return res.status(404).json({ message: 'Credit entry not found.' })
  }
  credit.paid = true
  credit.paidAt = new Date()
  credit.pinned = false // pinning only applies to the unpaid list
  await credit.save()
  res.json(credit)
})

// _________________________________________________________________________
// =========================================================================
// DELETE /api/seller/credits/:creditId  (protected)
export const deleteCredit = asyncHandler(async (req, res) => {
  const credit = await Credit.findOneAndDelete({ _id: req.params.creditId, shopId: req.sellerAccount._id })
  if (!credit) {
    return res.status(404).json({ message: 'Credit entry not found.' })
  }
  res.json({ message: 'Credit entry deleted.' })
})
// _________________________________________________________________________
// =========================================================================
