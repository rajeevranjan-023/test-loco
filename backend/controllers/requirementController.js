import Requirement from '../models/Requirement.js'
import Shop from '../models/Shop.js'
import ServiceProvider from '../models/ServiceProvider.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// _________________________________________________________________________
// =========================================================================
// POST /api/requirements  (public — works for logged-in or guest buyers)
export const createRequirement = asyncHandler(async (req, res) => {
  const { phone, email, category, title, description, imageUrl } = req.body

  if (!phone || !email || !category || !title || !description) {
    return res.status(400).json({
      message: 'phone, email, category, title and description are all required.',
    })
  }

  const requirement = await Requirement.create({
    postedBy: req.user?._id || null,
    phone,
    email,
    category,
    title,
    description,
    imageUrl: imageUrl || '',
  })

  // Count how many sellers/providers this requirement is now visible to,
  // so the buyer gets useful confirmation feedback.
  const categoryRegex = new RegExp(`^${category}$`, 'i')
  const [shopMatches, serviceMatches] = await Promise.all([
    Shop.countDocuments({ category: categoryRegex }),
    ServiceProvider.countDocuments({ workType: categoryRegex }),
  ])

  res.status(201).json({
    requirement,
    notified: shopMatches + serviceMatches,
  })
})

// _________________________________________________________________________
// =========================================================================
// GET /api/requirements/mine  (protected — buyer's own posted requirements)
export const listMyRequirements = asyncHandler(async (req, res) => {
  const requirements = await Requirement.find({ postedBy: req.user._id }).sort({ createdAt: -1 })
  res.json(requirements)
})

// _________________________________________________________________________
// =========================================================================
// GET /api/requirements/inbox  (protected, seller only)
// Returns requirements whose category matches this seller's shop category
// (shop accounts) or work type (service accounts) — an inbox, not a firehose.
export const listInboxRequirements = asyncHandler(async (req, res) => {
  const matchValue = req.sellerType === 'shop' ? req.sellerAccount.category : req.sellerAccount.workType
  const categoryRegex = new RegExp(`^${matchValue}$`, 'i')

  const filter = { category: categoryRegex }
  if (req.query.status === 'open' || req.query.status === 'closed') {
    filter.status = req.query.status
  }

  const requirements = await Requirement.find(filter).sort({ createdAt: -1 }).limit(100)

  const withResponseState = requirements.map((r) => ({
    ...r.toObject(),
    respondedByMe: r.responses.some(
      (resp) => resp.sellerId?.toString() === req.sellerAccount._id.toString()
    ),
  }))

  res.json({ category: matchValue, requirements: withResponseState })
})

// _________________________________________________________________________
// =========================================================================
// PATCH /api/requirements/:requirementId/respond  (protected, seller only)
export const respondToRequirement = asyncHandler(async (req, res) => {
  const requirement = await Requirement.findById(req.params.requirementId)
  if (!requirement) {
    return res.status(404).json({ message: 'Requirement not found.' })
  }

  const alreadyResponded = requirement.responses.some(
    (r) => r.sellerId?.toString() === req.sellerAccount._id.toString()
  )
  if (!alreadyResponded) {
    requirement.responses.push({
      sellerType: req.sellerType,
      sellerId: req.sellerAccount._id,
      message: req.body.message || '',
    })
    await requirement.save()
  }

  res.json(requirement)
})

// _________________________________________________________________________
// =========================================================================
// PATCH /api/requirements/:requirementId/close  (protected — buyer who posted it)
export const closeRequirement = asyncHandler(async (req, res) => {
  const requirement = await Requirement.findOne({ _id: req.params.requirementId, postedBy: req.user._id })
  if (!requirement) {
    return res.status(404).json({ message: 'Requirement not found.' })
  }
  requirement.status = 'closed'
  await requirement.save()
  res.json(requirement)
})
// _________________________________________________________________________
// =========================================================================
