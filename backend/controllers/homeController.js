import mongoose from 'mongoose'
import Shop from '../models/Shop.js'
import ServiceProvider from '../models/ServiceProvider.js'
import Product from '../models/Product.js'
import Review from '../models/Review.js'
import Category from '../models/Category.js'
import City from '../models/City.js'
import PromoCard from '../models/PromoCard.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { escapeRegex } from '../utils/escapeRegex.js'

const ROW_LIMIT = 4 // cards per homepage row (matches the 4-column grid)
const HERO_LIMIT = 5
const LIBRARY = 'Library'

const ciExact = (s) => new RegExp(`^${escapeRegex(s.trim())}$`, 'i')

// ---------- query helpers ----------
const activeShop = { isActive: { $ne: false } }
const shopInCity = (city) => (city ? { 'location.district': ciExact(city) } : {})
const serviceInCity = (city) => (city ? { 'areas.district': ciExact(city) } : {})

// Newest-first, featured shops always ahead.
const featuredFirst = { featured: -1, createdAt: -1 }

// ---------- rating: calculated live from the Review collection ----------
async function ratingsFor(targetType, ids) {
  if (!ids.length) return new Map()
  const rows = await Review.aggregate([
    { $match: { targetType, targetId: { $in: ids } } },
    { $group: { _id: '$targetId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])
  return new Map(rows.map((r) => [String(r._id), { rating: Math.round(r.avg * 10) / 10, reviews: r.count }]))
}

const joinLocation = (...parts) => parts.filter(Boolean).join(', ')

// ---------- card shapes (only public fields leave the server) ----------
function shopCard(s, ratings) {
  const r = ratings.get(String(s._id))
  return {
    id: s._id,
    type: 'shop',
    username: s.username,
    name: s.shopName,
    category: s.subCategory || s.category,
    image: s.bannerUrl || s.images?.[0] || s.logoUrl || '', // seller-uploaded media only
    rating: r?.rating ?? null, // null = no reviews yet
    reviews: r?.reviews ?? 0,
    location: joinLocation(s.location?.area, s.location?.district),
    phone: s.phone,
    whatsapp: s.socials?.whatsapp || s.phone,
    verified: !!s.verified,
  }
}

function serviceCard(p, ratings) {
  const r = ratings.get(String(p._id))
  const area = p.areas?.[0]
  return {
    id: p._id,
    type: 'service',
    username: p.username,
    name: p.name,
    category: p.workType,
    image: p.bannerUrl || p.avatarUrl || '',
    rating: r?.rating ?? null,
    reviews: r?.reviews ?? 0,
    location: joinLocation(area?.area, area?.district) || p.serviceArea || '',
    phone: p.phone,
    whatsapp: p.phone,
    verified: false,
  }
}

async function loadShops(filter, limit = ROW_LIMIT) {
  const shops = await Shop.find({ ...activeShop, ...filter }).sort(featuredFirst).limit(limit).lean()
  const ratings = await ratingsFor('shop', shops.map((s) => s._id))
  return shops.map((s) => shopCard(s, ratings))
}

async function loadServices(filter, limit = ROW_LIMIT) {
  const services = await ServiceProvider.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
  const ratings = await ratingsFor('service', services.map((s) => s._id))
  return services.map((s) => serviceCard(s, ratings))
}

// ---------- fallback tile images: the newest real seller banner of that kind ----------
async function firstBanners(groupField, match = {}) {
  const rows = await Shop.aggregate([
    { $match: { ...activeShop, bannerUrl: { $ne: '' }, ...match } },
    { $sort: featuredFirst },
    { $group: { _id: groupField, banner: { $first: '$bannerUrl' } } },
  ])
  return new Map(rows.map((r) => [String(r._id || '').toLowerCase(), r.banner]))
}

async function categoryImages(categories) {
  const [shopBanner, libraryBanner, serviceRow] = await Promise.all([
    Shop.findOne({ ...activeShop, bannerUrl: { $ne: '' }, category: { $ne: LIBRARY } }).sort(featuredFirst).select('bannerUrl').lean(),
    Shop.findOne({ ...activeShop, bannerUrl: { $ne: '' }, category: LIBRARY }).sort(featuredFirst).select('bannerUrl').lean(),
    ServiceProvider.findOne({ bannerUrl: { $ne: '' } }).sort({ createdAt: -1 }).select('bannerUrl').lean(),
  ])
  const byKind = { shop: shopBanner?.bannerUrl, library: libraryBanner?.bannerUrl, service: serviceRow?.bannerUrl }
  return categories.map((c) => ({
    id: c._id,
    name: c.name,
    description: c.description,
    tone: c.tone,
    query: c.query || c.name,
    image: c.imageUrl || byKind[c.kind] || '',
  }))
}

async function cityTiles(cities) {
  const banners = await firstBanners({ $toLower: '$location.district' })
  return cities.map((c) => ({
    id: c._id,
    name: c.name,
    image: c.imageUrl || banners.get(c.name.toLowerCase()) || '',
  }))
}

// Quick-search chips: the most common real categories / work types in the selected city.
async function popularChips(city) {
  const [shopCats, workTypes] = await Promise.all([
    Shop.aggregate([
      { $match: { ...activeShop, ...shopInCity(city) } },
      { $group: { _id: '$category', n: { $sum: 1 } } },
    ]),
    ServiceProvider.aggregate([
      { $match: { ...serviceInCity(city) } },
      { $group: { _id: '$workType', n: { $sum: 1 } } },
    ]),
  ])
  return [...shopCats, ...workTypes]
    .filter((r) => r._id && r._id !== 'Other')
    .sort((a, b) => b.n - a.n)
    .slice(0, 7)
    .map((r) => r._id)
}

// Hero: featured shops with a banner first, otherwise the latest active shops with a banner.
async function heroSlides(city) {
  const pick = (filter) =>
    Shop.find({ ...activeShop, bannerUrl: { $ne: '' }, ...filter })
      .sort(featuredFirst)
      .limit(HERO_LIMIT)
      .select('shopName username bannerUrl category featured location')
      .lean()
  let shops = await pick(shopInCity(city))
  if (!shops.length && city) shops = await pick({}) // nothing uploaded in this city yet → show any city's shops
  return shops.map((s) => ({
    id: s._id,
    username: s.username,
    name: s.shopName,
    category: s.category,
    image: s.bannerUrl,
    featured: !!s.featured,
  }))
}

// ======================================================================
// GET /api/home?city=Bhopal   — everything the homepage needs, one round trip
export const getHome = asyncHandler(async (req, res) => {
  const requested = String(req.query.city || '').trim()

  const cities = await City.find({ active: true }).sort({ order: 1, name: 1 }).lean()
  const selected =
    cities.find((c) => requested && c.name.toLowerCase() === requested.toLowerCase()) ||
    cities.find((c) => c.isDefault) ||
    cities[0] ||
    null
  const city = selected?.name || requested || ''

  const [categories, promoDocs, hero, chips, shops, services, libraries] = await Promise.all([
    Category.find({ active: true }).sort({ order: 1, name: 1 }).lean(),
    PromoCard.find({ active: true }).sort({ updatedAt: -1 }).lean(),
    heroSlides(city),
    popularChips(city),
    loadShops({ ...shopInCity(city), category: { $ne: LIBRARY } }),
    loadServices(serviceInCity(city)),
    loadShops({ ...shopInCity(city), category: LIBRARY }),
  ])

  const promos = {}
  for (const p of promoDocs) {
    if (promos[p.section]) continue // newest active card per section wins
    promos[p.section] = {
      id: p._id,
      title: p.title,
      highlight: p.highlight,
      points: p.points,
      cta: p.ctaLabel,
      query: p.searchQuery,
      image: p.imageUrl,
      tone: p.tone,
    }
  }

  const [categoryTiles, cityList] = await Promise.all([categoryImages(categories), cityTiles(cities)])

  res.json({
    city,
    hero,
    chips,
    categories: categoryTiles,
    cities: cityList,
    promos,
    sections: { shops, services, libraries },
  })
})

// ======================================================================
// GET /api/home/suggest?q=fan&city=Bhopal   — live search-as-you-type
export const suggest = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60)
  if (q.length < 2) return res.json({ shops: [], services: [], products: [] })

  const rx = new RegExp(escapeRegex(q), 'i')
  const city = String(req.query.city || '').trim()

  const [shops, services, products] = await Promise.all([
    Shop.find({ ...activeShop, ...shopInCity(city), $or: [{ shopName: rx }, { category: rx }, { subCategory: rx }] })
      .sort(featuredFirst).limit(4).select('shopName username category subCategory bannerUrl images logoUrl location').lean(),
    ServiceProvider.find({ ...serviceInCity(city), $or: [{ name: rx }, { workType: rx }] })
      .limit(4).select('name username workType bannerUrl avatarUrl areas serviceArea').lean(),
    Product.find({ name: rx, listed: { $ne: false }, active: { $ne: false } })
      .sort({ price: 1 }).limit(4).populate('shopId', 'shopName username isActive location').lean(),
  ])

  res.json({
    shops: shops.map((s) => ({
      id: s._id, username: s.username, name: s.shopName, subtitle: s.subCategory || s.category,
      image: s.bannerUrl || s.images?.[0] || s.logoUrl || '',
    })),
    services: services.map((s) => ({
      id: s._id, username: s.username, name: s.name, subtitle: s.workType, image: s.bannerUrl || s.avatarUrl || '',
    })),
    products: products
      .filter((p) => p.shopId && p.shopId.isActive !== false && (!city || ciExact(city).test(p.shopId.location?.district || '')))
      .map((p) => ({
        id: p._id, name: p.name, subtitle: `₹${p.price} · ${p.shopId.shopName}`, username: p.shopId.username, image: p.imageUrl || '',
      })),
  })
})

// ======================================================================
// Admin CRUD for homepage config (categories / cities / promo cards)
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function adminCrud(Model, { pick, withSlug = false }) {
  const clean = (body) => {
    const out = {}
    for (const k of pick) if (body[k] !== undefined) out[k] = body[k]
    if (withSlug && out.name) out.slug = slugify(body.slug || out.name)
    return out
  }
  const notFound = (res) => res.status(404).json({ message: 'Not found.' })
  return {
    list: asyncHandler(async (req, res) => res.json(await Model.find().sort({ order: 1, createdAt: 1 }))),
    create: asyncHandler(async (req, res) => res.status(201).json(await Model.create(clean(req.body)))),
    update: asyncHandler(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return notFound(res)
      const doc = await Model.findByIdAndUpdate(req.params.id, clean(req.body), { new: true, runValidators: true })
      return doc ? res.json(doc) : notFound(res)
    }),
    remove: asyncHandler(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return notFound(res)
      const doc = await Model.findByIdAndDelete(req.params.id)
      return doc ? res.json({ ok: true }) : notFound(res)
    }),
  }
}

export const categoryAdmin = adminCrud(Category, { withSlug: true, pick: ['name', 'description', 'imageUrl', 'tone', 'kind', 'query', 'order', 'active'] })
export const cityAdmin = adminCrud(City, { withSlug: true, pick: ['name', 'state', 'imageUrl', 'order', 'isDefault', 'active'] })
export const promoAdmin = adminCrud(PromoCard, { pick: ['section', 'title', 'highlight', 'points', 'ctaLabel', 'searchQuery', 'imageUrl', 'tone', 'active'] })

// PATCH /api/admin/home/shops/:id  { featured, isActive }
export const setShopFlags = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Not found.' })
  const patch = {}
  if (typeof req.body.featured === 'boolean') patch.featured = req.body.featured
  if (typeof req.body.isActive === 'boolean') patch.isActive = req.body.isActive
  const shop = await Shop.findByIdAndUpdate(req.params.id, patch, { new: true }).select('shopName featured isActive')
  return shop ? res.json(shop) : res.status(404).json({ message: 'Not found.' })
})
