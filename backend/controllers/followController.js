import User from '../models/User.js'
import Shop from '../models/Shop.js'
import StudyCenter from '../models/StudyCenter.js'
import ServiceProvider from '../models/ServiceProvider.js'
import { asyncHandler } from '../utils/asyncHandler.js'

function getTargetModel(targetType) {
  return targetType === 'shop' ? Shop : targetType === 'study_center' ? StudyCenter : ServiceProvider
}

// _________________________________________________________________________
// =========================================================================
// POST /api/follow  (protected) — toggle follow/unfollow. body: { targetType, targetId }
export const toggleFollow = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.body
  if (!['shop', 'service', 'study_center'].includes(targetType) || !targetId) {
    return res.status(400).json({ message: 'targetType (shop|service) and targetId are required.' })
  }

  const Model = getTargetModel(targetType)
  const target = await Model.findById(targetId)
  if (!target) {
    return res.status(404).json({ message: 'Profile not found.' })
  }
  if (target.userId?.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: "You can't follow your own profile." })
  }

  const user = await User.findById(req.user._id)
  const alreadyFollowing = target.followers.some((id) => id.toString() === user._id.toString())

  if (alreadyFollowing) {
    target.followers = target.followers.filter((id) => id.toString() !== user._id.toString())
    user.following = user.following.filter(
      (f) => !(f.targetType === targetType && f.targetId.toString() === targetId)
    )
  } else {
    target.followers.push(user._id)
    user.following.push({ targetType, targetId })
  }

  await Promise.all([target.save(), user.save()])

  res.json({
    following: !alreadyFollowing,
    followerCount: target.followers.length,
  })
})

// _________________________________________________________________________
// =========================================================================
// GET /api/follow/followers?targetType=shop&targetId=...  (public)
export const listFollowers = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.query
  if (!['shop', 'service', 'study_center'].includes(targetType) || !targetId) {
    return res.status(400).json({ message: 'targetType (shop|service) and targetId are required.' })
  }

  const Model = getTargetModel(targetType)
  const target = await Model.findById(targetId).populate('followers', 'name username avatarUrl')
  if (!target) {
    return res.status(404).json({ message: 'Profile not found.' })
  }

  res.json(
    target.followers.map((u) => ({
      id: u._id,
      name: u.name,
      username: u.username || null,
      avatarUrl: u.avatarUrl || '',
    }))
  )
})

// _________________________________________________________________________
// =========================================================================
// GET /api/follow/following/:userId  (public) — resolves each followed
export const listFollowing = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId)
  if (!user) {
    return res.status(404).json({ message: 'User not found.' })
  }

  const shopIds = user.following.filter((f) => f.targetType === 'shop').map((f) => f.targetId)
  const serviceIds = user.following.filter((f) => f.targetType === 'service').map((f) => f.targetId)

  const [shops, services] = await Promise.all([
    Shop.find({ _id: { $in: shopIds } }, 'shopName username logoUrl'),
    ServiceProvider.find({ _id: { $in: serviceIds } }, 'name username bannerUrl'),
  ])

  const following = [
    ...shops.map((s) => ({ type: 'shop', id: s._id, name: s.shopName, username: s.username, imageUrl: s.logoUrl })),
    ...services.map((s) => ({ type: 'service', id: s._id, name: s.name, username: s.username, imageUrl: s.bannerUrl })),
  ]

  res.json(following)
})
// _________________________________________________________________________
// =========================================================================
