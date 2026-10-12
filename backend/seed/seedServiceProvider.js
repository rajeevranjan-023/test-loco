// Service Provider test environment — "CoolFix Home Services" (a hybrid: services + labour + materials + counter part sales).
//   npm run seed:service        → (re)creates the account + all dev data in the database (safe to run again)
//   AUTO_SEED=true (server start) → creates it the first time, if the login does not exist yet (never in production)
// The login is created through the normal User model (password hashed by its pre-save hook), exactly like a registered account.
// Credentials: DEVELOPMENT ONLY — see seed/DEV_ACCOUNTS.md. This script refuses to run in production (seed/guard.js).
import 'dotenv/config'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import User from '../models/User.js'
import ServiceProvider from '../models/ServiceProvider.js'
import ServiceItem from '../models/ServiceItem.js'
import Product from '../models/Product.js'
import Sale from '../models/Sale.js'
import Customer from '../models/Customer.js'
import Bill from '../models/Bill.js'
import BillCounter from '../models/BillCounter.js'
import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import { generateService, PROVIDER, CAPABILITIES } from './serviceProviderData.js'
import { assertDevSeedAllowed } from './guard.js'

export const SERVICE_LOGIN = { email: PROVIDER.email, password: 'ServicePro@123' } // development / testing only

// Only this account's own data is removed (everything is keyed by the provider's id) — nothing else in the database is touched.
async function wipe(email) {
  const old = await User.findOne({ email })
  if (!old) return
  const p = await ServiceProvider.findOne({ userId: old._id })
  if (p) {
    await Promise.all([ServiceItem, Product, Sale, Customer, Bill, BillCounter, Udhar, UdharHistory].map((M) => M.deleteMany({ shopId: p._id })))
    await ServiceProvider.deleteOne({ _id: p._id })
  }
  await User.deleteOne({ _id: old._id })
}

export async function seedServiceProvider() {
  assertDevSeedAllowed('Service Provider seed') // wipe() below deletes the account with this email — never in production
  await wipe(SERVICE_LOGIN.email)
  const user = await User.create({ name: PROVIDER.name, email: SERVICE_LOGIN.email, username: PROVIDER.username, password: SERVICE_LOGIN.password, role: 'seller', sellerType: 'service', phone: PROVIDER.phone, bio: 'AC and home-appliance repair — services, labour, parts.' })
  const provider = await ServiceProvider.create({
    userId: user._id, username: PROVIDER.username, name: PROVIDER.name, phone: PROVIDER.phone, email: PROVIDER.email, workType: PROVIDER.workType,
    description: `${PROVIDER.businessName}: AC service, gas refill, installation and home-appliance repair. Parts available at the counter.`,
    areas: [{ state: 'Madhya Pradesh', district: 'Sagar', area: 'Civil Lines' }], serviceArea: 'Civil Lines, Sagar',
    price: { amount: 450, unit: 'fixed' }, workingDays: 'Mon-Sat', timeSlots: '9 AM - 7 PM', availability: 'Available Today',
    location: { lat: 23.8388, lng: 78.7378 },
    billing: { capabilities: CAPABILITIES },
  })
  const d = generateService({ providerId: provider._id })
  await ServiceItem.insertMany(d.services)   // Mongoose validation runs on these
  await Product.insertMany(d.products)       // sets __v for optimistic concurrency, validates batches
  // back-dated documents go in raw (keeps their real createdAt), exactly like the shop and study seeds
  await Customer.collection.insertMany(d.customers)
  await Bill.collection.insertMany(d.bills)
  await Sale.collection.insertMany(d.sales)
  await BillCounter.collection.insertMany(d.billCounters)
  await Udhar.collection.insertMany(d.udhars)
  await UdharHistory.collection.insertMany(d.history)
  return { services: d.services.length, products: d.products.length, customers: d.customers.length, bills: d.bills.length, sales: d.sales.length, dues: d.udhars.filter((u) => u.totalAmount > 0).length }
}

export async function seedServiceIfMissing() {
  if (await User.findOne({ email: SERVICE_LOGIN.email })) return
  const r = await seedServiceProvider()
  console.log(`[auto-seed] ${SERVICE_LOGIN.email} ready (${r.services} services, ${r.products} parts, ${r.customers} customers, ${r.bills} bills)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mongoose.connect(process.env.MONGODB_URI)
  const r = await seedServiceProvider()
  console.log('Seeded CoolFix Home Services:', r)
  console.log(`Seeded dev account ${SERVICE_LOGIN.email} (credentials: seed/DEV_ACCOUNTS.md)`)
  await mongoose.disconnect()
}
