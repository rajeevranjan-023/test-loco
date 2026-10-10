// Demo data for the analytics dashboard.
//   npm run seed:demo          → (re)creates the demo seller accounts below
//   AUTO_SEED (server start)   → creates them automatically the first time, if missing
import 'dotenv/config'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import User from '../models/User.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import Sale from '../models/Sale.js'
import Bill from '../models/Bill.js'
import Credit from '../models/Credit.js'
import Offer from '../models/Offer.js'
import Message from '../models/Message.js'
import Customer from '../models/Customer.js'
import Udhar from '../models/Udhar.js'
import UdharHistory from '../models/UdharHistory.js'
import { generateDemo } from './demoData.js'
import { migrateLedger } from '../utils/ledger.js'

export const ACCOUNTS = [
  { email: 'rajeevranjan@gmail.com', password: 'Priya@4369', name: 'Rajeev Ranjan', username: 'rajeev', shopName: 'Grocery Corner', shopCode: '#GCR001', seed: 23 },
  { email: 'golu@loco.com', password: 'golu12345', name: 'Rajesh Gupta', username: 'golu', shopName: 'Gupta Kirana Store', shopCode: '#GKS001', seed: 11 },
]
const DAY = 864e5

async function wipe(email) {
  const old = await User.findOne({ email })
  if (!old) return
  const shop = await Shop.findOne({ userId: old._id })
  if (shop) {
    await Promise.all([Product, Sale, Bill, Credit, Offer, Message, Customer, Udhar, UdharHistory].map((M) => M.deleteMany({ shopId: shop._id })))
    await Shop.deleteOne({ _id: shop._id })
  }
  await User.deleteOne({ _id: old._id })
}

export async function seedAccount(a) {
  await wipe(a.email)
  const user = await User.create({ name: a.name, email: a.email, username: a.username, password: a.password, role: 'seller', sellerType: 'shop', phone: '9876543210' }) // hashed by the User pre-save hook
  const shop = await Shop.create({
    userId: user._id, username: a.username, shopName: a.shopName, shopCode: a.shopCode, ownerName: a.name, phone: '9876543210', email: a.email,
    category: 'Grocery', description: 'Daily groceries, dairy and household needs.', homeDelivery: true, rating: 4.7, reviewCount: 96,
    location: { address: 'MG Road', state: 'Madhya Pradesh', district: 'Bhopal', area: 'Arera Colony', lat: 23.2599, lng: 77.4126 },
  })
  const d = generateDemo({ shopId: shop._id, seed: a.seed })
  // raw collection inserts keep our back-dated createdAt values and skip per-doc validation hooks (fast for ~7k docs)
  await Product.collection.insertMany(d.products)
  await Bill.collection.insertMany(d.bills)
  await Sale.collection.insertMany(d.sales)
  await Customer.collection.insertMany(d.customers)
  await Udhar.collection.insertMany(d.udhars)
  await UdharHistory.collection.insertMany(d.history)
  await migrateLedger() // fills Customer.creditBalance for customers who ended with an Advance Balance
  await Offer.insertMany([
    { shopId: shop._id, title: 'Dairy Fresh Week', discountPercent: 10, appliesTo: 'Dairy', validUntil: new Date(Date.now() + 7 * DAY) },
    { shopId: shop._id, title: 'Snack Combo Deal', discountPercent: 15, appliesTo: 'Snacks', validUntil: new Date(Date.now() + 14 * DAY) },
    { shopId: shop._id, title: 'Monthly Grocery Saver', discountPercent: 8, appliesTo: 'Grocery', validUntil: new Date(Date.now() + 20 * DAY) },
    { shopId: shop._id, title: 'Festive Clearance', discountPercent: 25, appliesTo: 'All products', validUntil: new Date(Date.now() - 3 * DAY), active: false },
  ])
  const chats = [['Rahul Verma', 'Bhai milk hai kya?'], ['Priya Sharma', '1kg sugar chahiye kal'], ['Amit Kumar', 'Oil ka price bata do'], ['Neha Singh', 'Biscuits ka stock hai?'], ['Suresh Yadav', 'Udhar me de dena']]
  await Message.insertMany(chats.map(([customerName, text], i) => ({ shopId: shop._id, customerName, direction: 'in', text, read: false, createdAt: new Date(Date.now() - [5, 12, 35, 60, 120][i] * 6e4) })))
  await Message.insertMany([
    { shopId: shop._id, customerName: 'Anita Jain', direction: 'in', text: 'Is the shop open on Sunday?', read: true, createdAt: new Date(Date.now() - DAY) },
    { shopId: shop._id, customerName: 'Anita Jain', direction: 'out', text: 'Yes, 9am to 9pm all week.', read: true, createdAt: new Date(Date.now() - DAY + 6e4) },
  ])
  return { products: d.products.length, orders: d.bills.length, lines: d.sales.length, udhar: d.history.length }
}

export async function seedAll() {
  for (const a of ACCOUNTS) { const r = await seedAccount(a); console.log(`Seeded ${a.email}: ${r.products} products, ${r.orders} orders, ${r.lines} sale lines, ${r.udhar} udhar ledger lines`) }
}
// First-run helper used by server.js: only seeds accounts that don't exist yet.
export async function seedIfMissing() {
  for (const a of ACCOUNTS) if (!(await User.findOne({ email: a.email }))) { const r = await seedAccount(a); console.log(`[auto-seed] ${a.email} ready (${r.orders} orders, ${r.products} products)`) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mongoose.connect(process.env.MONGODB_URI)
  await seedAll()
  console.log('Logins → rajeevranjan@gmail.com / Priya@4369   |   golu@loco.com / golu12345')
  await mongoose.disconnect()
}
