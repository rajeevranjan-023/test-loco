// Homepage CONFIG seed — not listings. Creates the admin-editable records the homepage reads from:
// categories, cities and the side promo cards. Idempotent: existing records (matched by slug / section) are left
// untouched, so anything an admin edited or uploaded an image for is never overwritten.
//   npm run seed:home
// Images are intentionally empty: upload them from the admin panel (POST /api/media/upload, then
// PUT /api/admin/home/<categories|cities|promos>/:id { imageUrl }). Until then tiles fall back to real seller banners.
import 'dotenv/config'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import Category from '../models/Category.js'
import City from '../models/City.js'
import PromoCard from '../models/PromoCard.js'

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const CATEGORIES = [
  { name: 'Shops', description: 'Kirana, Electronics, Clothing & more', tone: 'orange', kind: 'shop', query: 'Shop' },
  { name: 'Services', description: 'Electrician, Plumber, Salon & more', tone: 'green', kind: 'service', query: 'Services' },
  { name: 'Libraries', description: 'Study spaces, Book rental', tone: 'violet', kind: 'library', query: 'Library' },
  { name: 'PG / Hostels', description: 'Rooms, PG, Hostels', tone: 'rose', kind: 'other', query: 'PG' },
  { name: 'Food & Beverages', description: 'Restaurants, Cafes & more', tone: 'amber', kind: 'other', query: 'Food' },
  { name: 'Healthcare', description: 'Clinics, Pharmacies, Diagnostic centers', tone: 'emerald', kind: 'other', query: 'Healthcare' },
  { name: 'Education', description: 'Coaching, Tuition, Skill classes', tone: 'sky', kind: 'other', query: 'Education' },
  { name: 'More', description: 'Repair, Events, Others', tone: 'gray', kind: 'other', query: 'Other' },
]

const CITIES = [
  { name: 'Bhopal', isDefault: true }, { name: 'Indore' }, { name: 'Jabalpur' }, { name: 'Gwalior' },
  { name: 'Ujjain' }, { name: 'Sagar' }, { name: 'Rewa' }, { name: 'Ratlam' },
].map((c) => ({ state: 'Madhya Pradesh', ...c }))

const PROMOS = [
  { section: 'shops', tone: 'sky', title: 'Need a Shop?', highlight: 'Explore Verified Local Shops', points: ['Grocery Stores', 'Electronics', 'Clothing & Fashion', 'Daily Essentials', 'and more...'], ctaLabel: 'Explore Shops', searchQuery: 'Shop' },
  { section: 'services', tone: 'orange', title: 'Need a Service?', highlight: 'Find Trusted Local Experts', points: ['Electrician', 'Plumber', 'AC Repair', 'Home Cleaning', 'Salon & Grooming', 'and more...'], ctaLabel: 'Book a Service', searchQuery: 'Services' },
  { section: 'libraries', tone: 'orange', title: 'Find a Library?', highlight: 'Study · Read · Grow', points: ['Study Spaces', 'Book Rentals', 'Quiet Environment', 'Student Friendly', 'and more...'], ctaLabel: 'Explore Libraries', searchQuery: 'Library' },
]

export async function seedHomeConfig() {
  let created = 0
  for (const [i, c] of CATEGORIES.entries()) {
    const slug = slugify(c.name)
    if (!(await Category.exists({ slug }))) { await Category.create({ ...c, slug, order: i }); created++ }
  }
  for (const [i, c] of CITIES.entries()) {
    const slug = slugify(c.name)
    if (!(await City.exists({ slug }))) { await City.create({ ...c, slug, order: i }); created++ }
  }
  for (const p of PROMOS) {
    if (!(await PromoCard.exists({ section: p.section }))) { await PromoCard.create(p); created++ }
  }
  return created
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`[seed:home] created ${await seedHomeConfig()} records`)
  await mongoose.disconnect()
}
