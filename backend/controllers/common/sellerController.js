import User from '../../models/common/User.js'
import Shop from '../../models/shop/Shop.js'
import ServiceProvider from '../../models/services/ServiceProvider.js'
import StudyCenter from '../../models/library/StudyCenter.js'
import { findAccountByUser } from '../../utils/common/accounts.js'
import { schemaFor, publicBusiness } from '../../utils/common/businessSchema.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { normalizeUsername, assertUsernameAvailable } from '../../utils/username.js'

// _________________________________________________________________________
// =========================================================================
// GET /api/seller/check-username/:username  (protected)
export const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const result = await assertUsernameAvailable(req.params.username)
  res.json({ available: result.ok, message: result.ok ? null : result.error })
})

// _________________________________________________________________________
// =========================================================================
// POST /api/seller/start  (protected)
export const startSellerAccount = asyncHandler(async (req, res) => {
  if (req.user.role === 'seller') {
    return res.status(409).json({ message: 'You already have a seller account.' })
  }

  const { sellerType } = req.body

  // A user created through the new signup flow already owns a username — the business simply uses it.
  let username
  const wanted = req.body.username || req.user.username
  if (req.user.username && normalizeUsername(wanted) === req.user.username) {
    username = req.user.username
  } else {
    const usernameCheck = await assertUsernameAvailable(wanted)
    if (!usernameCheck.ok) {
      return res.status(400).json({ message: usernameCheck.error })
    }
    username = usernameCheck.username
  }
  // Fall back to the verified account details when the caller didn't send them.
  req.body.phone = req.body.phone || req.user.phone
  req.body.email = req.body.email || req.user.email
  req.body.ownerName = req.body.ownerName || req.user.name
  if (req.body.sellerType === 'service') req.body.name = req.body.name || req.user.name

  if (sellerType === 'shop') {
    const {
      shopName, ownerName, phone, email,
      logoUrl, bannerUrl, description, category,
      address, state, district, area, lat, lng,
      businessType, homeDelivery,
      openTime, closeTime, openDays,
    } = req.body

    if (!shopName || !ownerName || !phone || !address) {
      return res.status(400).json({ message: 'shopName, ownerName, phone and address are all required.' })
    }

    const shop = await Shop.create({
      userId: req.user._id,
      username,
      shopName,
      ownerName,
      phone,
      email,
      logoUrl,
      bannerUrl,
      description,
      category,
      location: { address, state, district, area, lat: lat ?? null, lng: lng ?? null },
      businessType,
      homeDelivery: !!homeDelivery,
      timing: { open: openTime || '09:00', close: closeTime || '21:00', openDays: openDays || 'Mon-Sat' },
    })

    req.user.role = 'seller'
    req.user.sellerType = 'shop'
    req.user.username = username
    await req.user.save()

    return res.status(201).json({
      user: req.user.toSafeObject(),
      account: shop.toPublicProfile(),
    })
  }

  if (sellerType === 'service') {
    const {
      name, phone, email, bannerUrl, description, workType,
      areas, serviceArea, priceAmount, priceUnit,
      workingDays, timeSlots, availability, lat, lng,
    } = req.body

    if (!name || !phone || !workType || !priceAmount) {
      return res.status(400).json({ message: 'name, phone, workType and priceAmount are required.' })
    }

    const provider = await ServiceProvider.create({
      userId: req.user._id,
      username,
      name,
      phone,
      email,
      bannerUrl,
      description,
      workType,
      areas: Array.isArray(areas) ? areas : [],
      serviceArea,
      price: { amount: priceAmount, unit: priceUnit || 'hour' },
      workingDays: workingDays || 'Mon-Sat',
      timeSlots,
      availability,
      location: { lat: lat ?? null, lng: lng ?? null },
    })

    req.user.role = 'seller'
    req.user.sellerType = 'service'
    req.user.username = username
    await req.user.save()

    return res.status(201).json({
      user: req.user.toSafeObject(),
      account: provider.toPublicProfile(),
    })
  }

  if (sellerType === 'study_center') {
    const {
      centerName, ownerName, phone, email, logoUrl, bannerUrl, description,
      address, state, district, area, lat, lng, openTime, closeTime, openDays, features, studyEnvironment,
    } = req.body
    if (!centerName || !ownerName || !phone || !address) {
      return res.status(400).json({ message: 'centerName, ownerName, phone and address are all required.' })
    }
    // The owner only picks "Study Center": the whole configuration (zones, seat types, time slots, plans, charge types …)
    // is initialised from the business schema, so every section works from the first minute and can be edited later.
    const d = schemaFor('study_center').defaults
    const open = openTime || d.operatingHours.open, close = closeTime || d.operatingHours.close
    const centerCode = `#STU${100 + (await StudyCenter.countDocuments()) + 1}`
    const center = await StudyCenter.create({
      userId: req.user._id, username, centerName, centerCode, ownerName, phone, email, logoUrl, bannerUrl, description, studyEnvironment,
      features: Array.isArray(features) ? features.map((f) => String(f).trim().slice(0, 30)).filter(Boolean).slice(0, 12) : [],
      location: { address, state, district, area, lat: lat ?? null, lng: lng ?? null },
      timing: { open, close, openDays: openDays || 'All Week' },
      config: { ...d, operatingHours: { open, close }, features: { ...d.features } },
    })
    req.user.role = 'seller'
    req.user.sellerType = 'study_center'
    req.user.username = username
    await req.user.save()
    return res.status(201).json({ user: req.user.toSafeObject(), account: center.toPublicProfile(), business: publicBusiness('study_center', center) })
  }

  return res.status(400).json({ message: "sellerType must be 'shop', 'service' or 'study_center'." })
})

// _________________________________________________________________________
// =========================================================================
// GET /api/seller/me  (protected, seller only)
export const getMySellerAccount = asyncHandler(async (req, res) => {
  if (req.user.role !== 'seller') {
    return res.status(404).json({ message: 'No seller account yet.' })
  }

  const account = await findAccountByUser(req.user._id, req.user.sellerType)

  if (!account) {
    return res.status(404).json({ message: 'Seller account not found.' })
  }

  res.json({ sellerType: req.user.sellerType, account: account.toPublicProfile(), business: publicBusiness(req.user.sellerType, account) })
})
// _________________________________________________________________________
// =========================================================================
// PATCH /api/seller/account  (protected, seller only)
// Lets a seller edit their own shop/service profile — banner, logo,
// description, pricing, availability, etc. Powers the "pencil" edit button
// on the profile page. Only whitelisted, safe-to-self-edit fields are
// accepted here (username/category changes go through dedicated flows).
export const updateSellerAccount = asyncHandler(async (req, res) => {
  if (req.user.role !== 'seller') {
    return res.status(404).json({ message: 'No seller account yet.' })
  }

  const user = await User.findById(req.user._id)

  // ---- Account-level fields shared by both shop & service profiles ----
  // (name, username, email, phone, bio, avatar) — these live on User, and
  // username/email/phone are mirrored onto the Shop/ServiceProvider doc
  // too since that's what public profile pages read from.
  if (req.body.username !== undefined && normalizeUsername(req.body.username) !== user.username) {
    const check = await assertUsernameAvailable(req.body.username)
    if (!check.ok) return res.status(400).json({ message: check.error })
    user.username = check.username
  }

  if (req.body.email !== undefined && req.body.email !== user.email) {
    const emailTaken = await User.findOne({ email: req.body.email, _id: { $ne: user._id } })
    if (emailTaken) return res.status(400).json({ message: 'That email is already in use.' })
    user.email = req.body.email
  }

  if (req.body.name !== undefined) user.name = req.body.name
  if (req.body.bio !== undefined) user.bio = req.body.bio
  if (req.body.avatarUrl !== undefined) user.avatarUrl = req.body.avatarUrl
  if (req.body.phone !== undefined) user.phone = req.body.phone
  await user.save()

  if (req.user.sellerType === 'shop') {
    const shop = await Shop.findOne({ userId: req.user._id })
    if (!shop) return res.status(404).json({ message: 'Shop not found.' })

    if (user.username) shop.username = user.username
    if (req.body.name !== undefined) shop.ownerName = req.body.name
    if (req.body.email !== undefined) shop.email = user.email
    if (req.body.phone !== undefined) shop.phone = req.body.phone

    const editable = [
      'shopName', 'logoUrl', 'bannerUrl', 'description',
      'businessType', 'homeDelivery', 'category',
    ]
    editable.forEach((field) => {
      if (req.body[field] !== undefined) shop[field] = req.body[field]
    })

    // Profile-page extras: photo gallery, highlight tags, social links (all sanitised + capped).
    if (Array.isArray(req.body.images)) {
      shop.images = req.body.images.filter((u) => typeof u === 'string' && u.trim()).slice(0, 12)
    }
    if (Array.isArray(req.body.features)) {
      shop.features = req.body.features
        .map((t) => (typeof t === 'string' ? t.trim().slice(0, 30) : ''))
        .filter(Boolean)
        .slice(0, 8)
    }
    if (req.body.socials && typeof req.body.socials === 'object') {
      ;['whatsapp', 'instagram', 'facebook'].forEach((k) => {
        if (typeof req.body.socials[k] === 'string') shop.socials[k] = req.body.socials[k].trim().slice(0, 200)
      })
    }

    if (req.body.address !== undefined) shop.location.address = req.body.address
    if (req.body.state !== undefined) shop.location.state = req.body.state
    if (req.body.district !== undefined) shop.location.district = req.body.district
    if (req.body.area !== undefined) shop.location.area = req.body.area

    if (req.body.openTime !== undefined) shop.timing.open = req.body.openTime
    if (req.body.closeTime !== undefined) shop.timing.close = req.body.closeTime
    if (req.body.openDays !== undefined) shop.timing.openDays = req.body.openDays

    await shop.save()
    return res.json({ sellerType: 'shop', account: shop.toPublicProfile(), user: user.toSafeObject() })
  }

  if (req.user.sellerType === 'study_center') {
    const center = await StudyCenter.findOne({ userId: req.user._id })
    if (!center) return res.status(404).json({ message: 'Study center not found.' })
    if (user.username) center.username = user.username
    if (req.body.name !== undefined) center.ownerName = req.body.name
    if (req.body.email !== undefined) center.email = user.email
    if (req.body.phone !== undefined) center.phone = req.body.phone
    if (req.body.shopName !== undefined && req.body.centerName === undefined) center.centerName = req.body.shopName // the shared details form sends shopName
    ;['centerName', 'logoUrl', 'bannerUrl', 'description', 'studyEnvironment', 'subCategory'].forEach((f) => { if (req.body[f] !== undefined) center[f] = req.body[f] })
    if (Array.isArray(req.body.images)) center.images = req.body.images.filter((u) => typeof u === 'string' && u.trim()).slice(0, 12)
    if (Array.isArray(req.body.features)) center.features = req.body.features.map((t) => (typeof t === 'string' ? t.trim().slice(0, 30) : '')).filter(Boolean).slice(0, 12)
    if (req.body.socials && typeof req.body.socials === 'object') ;['whatsapp', 'instagram', 'facebook'].forEach((k) => { if (typeof req.body.socials[k] === 'string') center.socials[k] = req.body.socials[k].trim().slice(0, 200) })
    ;['address', 'state', 'district', 'area'].forEach((f) => { if (req.body[f] !== undefined) center.location[f] = req.body[f] })
    if (req.body.openTime !== undefined) center.timing.open = req.body.openTime
    if (req.body.closeTime !== undefined) center.timing.close = req.body.closeTime
    if (req.body.openDays !== undefined) center.timing.openDays = req.body.openDays
    await center.save()
    return res.json({ sellerType: 'study_center', account: center.toPublicProfile(), user: user.toSafeObject() })
  }

  const provider = await ServiceProvider.findOne({ userId: req.user._id })
  if (!provider) return res.status(404).json({ message: 'Service profile not found.' })

  if (user.username) provider.username = user.username
  if (req.body.name !== undefined) provider.name = req.body.name
  if (req.body.email !== undefined) provider.email = user.email
  if (req.body.phone !== undefined) provider.phone = req.body.phone

  const editable = [
    'bannerUrl', 'videoUrl', 'description', 'workType',
    'serviceArea', 'workingDays', 'timeSlots', 'availability',
  ]
  editable.forEach((field) => {
    if (req.body[field] !== undefined) provider[field] = req.body[field]
  })

  // Distinct from `avatarUrl` (the User's personal photo) — this is the
  // service listing's own public circular photo.
  if (req.body.serviceAvatarUrl !== undefined) provider.avatarUrl = req.body.serviceAvatarUrl

  if (req.body.priceAmount !== undefined) provider.price.amount = req.body.priceAmount
  if (req.body.priceUnit !== undefined) provider.price.unit = req.body.priceUnit

  await provider.save()
  return res.json({ sellerType: 'service', account: provider.toPublicProfile(), user: user.toSafeObject() })
})
// _________________________________________________________________________
// =========================================================================