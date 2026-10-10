

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dns from 'node:dns'
import bcrypt from 'bcryptjs'


// ---------------------------------------------------------------------------
dns.setServers(['8.8.8.8', '1.1.1.1'])

// ---------------------------------------------------------------------------
// 2. ESM __dirname/__filename SHIM
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// 3. ENV LOADING — seed.js lives in /seed, so .env is one level up.
// ---------------------------------------------------------------------------
dotenv.config({ path: path.join(__dirname, '../.env') })
console.log('ENV CHECK:', process.env.MONGODB_URI)

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is missing. Check your .env file at project root.')
  process.exit(1)
}

const CREDENTIALS_FILE = path.join(__dirname, 'credentials.csv')

// ---------------------------------------------------------------------------
// 4. MODELS
// ---------------------------------------------------------------------------
import User from '../models/User.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import Sale from '../models/Sale.js'
import Credit from '../models/Credit.js'
import ServiceProvider from '../models/ServiceProvider.js'

// =============================================================================
// CONSTANTS / DATA DICTIONARIES
// =============================================================================

const CITIES = [
  {
    name: 'Delhi',
    state: 'Delhi',
    districts: ['New Delhi', 'South Delhi', 'North Delhi', 'Dwarka', 'Rohini'],
    lat: 28.7041,
    lng: 77.1025,
  },
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    districts: ['Andheri', 'Bandra', 'Dadar', 'Borivali', 'Thane'],
    lat: 19.076,
    lng: 72.8777,
  },
  {
    name: 'Bangalore',
    state: 'Karnataka',
    districts: ['Koramangala', 'Whitefield', 'Indiranagar', 'Jayanagar', 'Yelahanka'],
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    name: 'Pune',
    state: 'Maharashtra',
    districts: ['Kothrud', 'Hinjewadi', 'Viman Nagar', 'Camp', 'Hadapsar'],
    lat: 18.5204,
    lng: 73.8567,
  },
  {
    name: 'Hyderabad',
    state: 'Telangana',
    districts: ['Banjara Hills', 'Gachibowli', 'Secunderabad', 'Kukatpally', 'Madhapur'],
    lat: 17.385,
    lng: 78.4867,
  },
]

const CATEGORIES = [
  'Grocery',
  'Electronics',
  'Medical',
  'Hardware',
  'Fashion',
  'Furniture',
  'Mobile Store',
  'Bakery',
  'Paint',
  'Other',
]

// Category -> { icon, priceRange:[min,max], items[] }. Products for a shop are
// ONLY ever pulled from that shop's own category — never mixed.
const CATEGORY_CATALOG = {
  Grocery: {
    icon: '🛒',
    priceRange: [20, 600],
    items: ['Basmati Rice (5kg)', 'Toned Milk (1L)', 'Sunflower Oil (1L)', 'Sugar (1kg)', 'Wheat Atta (5kg)', 'Toor Dal (1kg)', 'Tea Powder (250g)', 'Iodised Salt (1kg)', 'Glucose Biscuits', 'Garam Masala (100g)'],
  },
  Electronics: {
    icon: '🔌',
    priceRange: [300, 60000],
    items: ['Smartphone', 'Laptop', 'Mobile Charger', 'Wireless Earphones', 'Power Bank (10000mAh)', 'Bluetooth Speaker', 'Smartwatch', 'Tablet', 'Digital Camera', 'Wireless Keyboard'],
  },
  Medical: {
    icon: '💊',
    priceRange: [10, 1500],
    items: ['Paracetamol Strip', 'Vitamin C Tablets', 'Cough Syrup', 'Adhesive Bandage Pack', 'Digital Thermometer', 'Surgical Mask (Box)', 'Hand Sanitizer (500ml)', 'Disposable Syringe Pack', 'Antiseptic Ointment', 'Multivitamin Bottle'],
  },
  Hardware: {
    icon: '🔧',
    priceRange: [30, 4000],
    items: ['Claw Hammer', 'Electric Drill Machine', 'Screws Assortment Box', 'Paint Brush Set', 'Copper Wire (10m)', 'PVC Pipe (3m)', 'Door Lock', 'Iron Nails (1kg)', 'Tool Kit Set', 'Cement Bag (5kg)'],
  },
  Fashion: {
    icon: '👕',
    priceRange: [150, 3500],
    items: ['Cotton Shirt', 'Denim Jeans', 'Cotton Kurta', 'Silk Saree', 'Winter Jacket', 'Printed T-Shirt', 'Casual Shoes', 'Leather Belt', 'Baseball Cap', 'Wool Scarf'],
  },
  Furniture: {
    icon: '🛋️',
    priceRange: [800, 45000],
    items: ['3-Seater Sofa', 'Dining Table', 'Study Chair', 'Queen Size Bed', 'Wardrobe', 'Bookshelf', 'Dining Set (4 Chairs)', 'Wooden Stool', 'Storage Cabinet', 'Foam Mattress'],
  },
  'Mobile Store': {
    icon: '📱',
    priceRange: [50, 55000],
    items: ['Mobile Phone', 'Mobile Back Cover', 'Tempered Screen Guard', 'USB Charging Cable', 'In-Ear Earphones', 'Power Bank (5000mAh)', 'Prepaid SIM Card', 'Memory Card (32GB)', 'Mobile Stand', 'Mini Bluetooth Speaker'],
  },
  Bakery: {
    icon: '🎂',
    priceRange: [15, 1200],
    items: ['Chocolate Cake (1kg)', 'Brown Bread Loaf', 'Cream Pastry', 'Butter Cookies (Pack)', 'Blueberry Muffin', 'Dinner Bun (Pack of 6)', 'Glazed Donut', 'Veg Puff', 'Rusk (Pack)', 'Pizza Base (Pack of 2)'],
  },
  Paint: {
    icon: '🎨',
    priceRange: [150, 5000],
    items: ['Wall Emulsion Paint (10L)', 'Enamel Paint (1L)', 'Wall Primer (5L)', 'Paint Roller Set', 'Paint Brush (Set of 3)', 'Paint Thinner (1L)', 'Wall Putty (5kg)', 'Spray Paint Can', 'Wood Polish (500ml)', 'Waterproof Coating (4L)'],
  },
  Other: {
    icon: '🛍️',
    priceRange: [50, 3000],
    items: ['Umbrella', 'Stationery Set', 'Kids Toy', 'Gift Hamper', 'Plasticware Set', 'Casual Footwear', 'Wrist Watch', 'Travel Bag', 'Scented Candle Set', 'Wall Decor Item'],
  },
}

const SERVICE_TYPES = [
  { workType: 'Plumber', unit: 'hour', priceRange: [150, 600] },
  { workType: 'Electrician', unit: 'hour', priceRange: [150, 700] },
  { workType: 'Tutor', unit: 'hour', priceRange: [200, 1000] },
  { workType: 'Mechanic', unit: 'fixed', priceRange: [300, 2500] },
]

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan',
  'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Kavya', 'Priya', 'Isha', 'Neha', 'Riya', 'Sneha',
  'Rahul', 'Amit', 'Vikram', 'Sanjay', 'Rajesh', 'Suresh', 'Manoj', 'Deepak', 'Anil', 'Ashok',
  'Pooja', 'Anjali', 'Meera', 'Kiran', 'Divya', 'Nisha', 'Swati', 'Rekha', 'Shalini', 'Preeti',
]

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Patel', 'Iyer', 'Nair', 'Reddy', 'Rao', 'Singh', 'Kumar',
  'Mehta', 'Joshi', 'Chopra', 'Malhotra', 'Kapoor', 'Agarwal', 'Bansal', 'Desai', 'Pillai', 'Menon',
]

const CUSTOMER_FIRST_NAMES = [...FIRST_NAMES]
const CUSTOMER_LAST_NAMES = [...LAST_NAMES]

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

let usernameCounter = 1000 // guarantees global uniqueness across users/shops/services

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min, max, decimals = 2) {
  const val = Math.random() * (max - min) + min
  return Number(val.toFixed(decimals))
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)]
}

function pickMany(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, arr.length))
}

function jitter(value, spread) {
  return value + randomFloat(-spread, spread, 4)
}

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
}

function randomCustomerName() {
  return `${pick(CUSTOMER_FIRST_NAMES)} ${pick(CUSTOMER_LAST_NAMES)}`
}

function randomPhone() {
  const prefixes = ['9', '8', '7']
  let num = pick(prefixes)
  for (let i = 0; i < 9; i++) num += randomInt(0, 9)
  return `+91${num}`
}

function randomPrice(min, max) {
  return Math.round(randomFloat(min, max, 0))
}

function randomDate(daysAgo = 30) {
  const now = Date.now()
  const past = now - randomInt(0, daysAgo) * 24 * 60 * 60 * 1000
  return new Date(past - randomInt(0, 86400000)) // add sub-day jitter
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14)
}

function uniqueUsername(seedText) {
  usernameCounter += 1
  return `${slugify(seedText)}${usernameCounter}`
}

function uniqueEmail(username) {
  return `${username}@example.com`
}

// Readable-but-varied per-user password, e.g. "Rohan@4821" — unique enough
// for a real-looking credentials export, still easy to read/copy by hand.
function randomPassword(seedName) {
  const base = seedName.split(' ')[0]
  return `${base}@${randomInt(1000, 9999)}`
}

// Collects one row per user as they're generated, so the CSV export at the
// end doesn't need a second pass over the database.
const credentialRows = []

// =============================================================================
// CONNECTION
// =============================================================================

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('STEP 1: Connected')
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message)
    process.exit(1)
  }
}

async function clearCollections() {
  try {
    await Promise.all([
      User.deleteMany({}),
      Shop.deleteMany({}),
      Product.deleteMany({}),
      Sale.deleteMany({}),
      Credit.deleteMany({}),
      ServiceProvider.deleteMany({}),
    ])
    console.log('STEP 2: Data Cleared')
  } catch (err) {
    console.error('❌ Failed clearing collections:', err.message)
    process.exit(1)
  }
}

// =============================================================================
// STEP 3 — USERS
// One user per shop (role: seller, sellerType: shop) and one user per
// service provider (role: seller, sellerType: service). Passwords are
// pre-hashed here because insertMany() does NOT run Mongoose's
// pre('save') hooks, so User's built-in hashing middleware never fires
// for bulk inserts — hashing manually keeps every seeded login usable.
// =============================================================================

async function buildUsers(shopPlan, serviceCount) {
  // Build the plain (unhashed) records first, then hash every password in
  // parallel with Promise.all — avoids hundreds of sequential awaits.
  const shopUsers = shopPlan.map((plan) => {
    const ownerName = randomName()
    const username = uniqueUsername(ownerName)
    return {
      _id: new mongoose.Types.ObjectId(),
      name: ownerName,
      email: uniqueEmail(username),
      username,
      role: 'seller',
      sellerType: 'shop',
      location: {
        lat: jitter(plan.city.lat, 0.05),
        lng: jitter(plan.city.lng, 0.05),
        updatedAt: new Date(),
      },
      _ownerName: ownerName, // internal helper field, stripped before insert
      _plainPassword: randomPassword(ownerName), // internal only, stripped before insert
      _city: plan.city.name,
      _category: plan.category,
    }
  })

  const serviceUsers = []
  for (let i = 0; i < serviceCount; i++) {
    const name = randomName()
    const username = uniqueUsername(name)
    serviceUsers.push({
      _id: new mongoose.Types.ObjectId(),
      name,
      email: uniqueEmail(username),
      username,
      role: 'seller',
      sellerType: 'service',
      location: { lat: null, lng: null, updatedAt: null },
      _ownerName: name,
      _plainPassword: randomPassword(name),
      _city: '',
      _category: '',
    })
  }

  const allDraftUsers = [...shopUsers, ...serviceUsers]

  // Hash every password concurrently instead of one-by-one.
  const hashes = await Promise.all(allDraftUsers.map((u) => bcrypt.hash(u._plainPassword, 10)))

  allDraftUsers.forEach((u, i) => {
    u.password = hashes[i]
    credentialRows.push({
      name: u._ownerName,
      email: u.email,
      username: u.username,
      password: u._plainPassword,
      role: u.role,
      sellerType: u.sellerType,
      city: u._city,
      category: u._category,
    })
  })

  const allUserDocs = allDraftUsers.map(
    ({ _ownerName, _plainPassword, _city, _category, ...doc }) => doc
  )

  const inserted = await User.insertMany(allUserDocs, { ordered: false })
  console.log(`STEP 3: Users Created (${inserted.length})`)

  return {
    shopUsers: shopUsers.map((u, i) => ({ ...u, _insertedId: inserted[i]._id })),
    serviceUsers: serviceUsers.map((u, i) => ({
      ...u,
      _insertedId: inserted[shopUsers.length + i]._id,
    })),
  }
}

// =============================================================================
// BUILD SHOP PLAN — every city gets every category, each combo gets 3-6 shops.
// Built BEFORE users so we know exactly how many shop-users to create.
// =============================================================================

function buildShopPlan() {
  const plan = []
  for (const city of CITIES) {
    for (const category of CATEGORIES) {
      const shopsForCombo = randomInt(3, 6)
      for (let i = 0; i < shopsForCombo; i++) {
        plan.push({ city, category })
      }
    }
  }
  return plan
}

// =============================================================================
// STEP 4 — SHOPS
// =============================================================================

async function buildShops(shopPlan, shopUsers) {
  const shopDocs = shopPlan.map((plan, i) => {
    const user = shopUsers[i]
    const shopUsername = `@${user.username}` // Shop.username always carries the leading "@"
    const district = pick(plan.city.districts)
    const shopName = `${plan.category} ${pick(['Corner', 'Hub', 'Point', 'Bazaar', 'Store', 'Mart', 'Depot', 'Center'])}`

    return {
      _id: new mongoose.Types.ObjectId(),
      userId: user._insertedId,
      username: shopUsername,
      shopName,
      ownerName: user._ownerName,
      phone: randomPhone(),
      email: user.email,
      logoUrl: '',
      bannerUrl: '',
      description: `Trusted ${plan.category.toLowerCase()} shop serving ${district}, ${plan.city.name}.`,
      category: plan.category,
      location: {
        address: `${randomInt(1, 200)}, ${district} Main Road`,
        state: plan.city.state,
        district,
        area: district,
        lat: jitter(plan.city.lat, 0.08),
        lng: jitter(plan.city.lng, 0.08),
      },
      businessType: pick(['Retail', 'Wholesale', 'Both']),
      homeDelivery: Math.random() > 0.5,
      timing: {
        open: pick(['08:00', '09:00', '10:00']),
        close: pick(['19:00', '20:00', '21:00', '22:00']),
        openDays: pick(['Mon-Sat', 'All Week']),
      },
      rating: randomFloat(3.5, 5, 1),
      reviewCount: randomInt(0, 300),
      _category: plan.category, // internal helper, stripped before insert
    }
  })

  const cleanDocs = shopDocs.map(({ _category, ...doc }) => doc)
  const inserted = await Shop.insertMany(cleanDocs, { ordered: false })
  console.log(`STEP 4: Shops Created (${inserted.length})`)

  return shopDocs.map((doc, i) => ({ ...doc, _id: inserted[i]._id }))
}

// =============================================================================
// STEP 5 — PRODUCTS (strictly category-matched, never mixed)
// =============================================================================

async function buildProducts(shops) {
  const productDocs = []

  for (const shop of shops) {
    const catalog = CATEGORY_CATALOG[shop._category]
    const count = randomInt(5, 10)
    const chosenItems = pickMany(catalog.items, count)
    // If a shop needs more products than unique catalog items, allow repeats
    while (chosenItems.length < count) {
      chosenItems.push(pick(catalog.items))
    }

    for (const itemName of chosenItems) {
      const price = randomPrice(catalog.priceRange[0], catalog.priceRange[1])
      const costPrice = Math.round(price * randomFloat(0.55, 0.85, 2))
      productDocs.push({
        _id: new mongoose.Types.ObjectId(),
        shopId: shop._id,
        name: itemName,
        price,
        costPrice,
        stock: randomInt(10, 200),
        sold: 0, // filled in after sales are generated
        icon: catalog.icon,
      })
    }
  }

  const inserted = await Product.insertMany(productDocs, { ordered: false })
  console.log(`STEP 5: Products Created (${inserted.length})`)

  return productDocs.map((doc, i) => ({ ...doc, _id: inserted[i]._id }))
}

// =============================================================================
// STEP 6 — SALES (10-30 per shop, always within last 30 days)
// Also tracks per-product quantity sold so Product.sold/stock can be
// reconciled afterwards with a single bulkWrite.
// =============================================================================

async function buildSales(shops, products) {
  const productsByShop = new Map()
  for (const product of products) {
    const key = product.shopId.toString()
    if (!productsByShop.has(key)) productsByShop.set(key, [])
    productsByShop.get(key).push(product)
  }

  const saleDocs = []
  const soldTally = new Map() // productId -> total quantity sold

  for (const shop of shops) {
    const shopProducts = productsByShop.get(shop._id.toString()) || []
    if (shopProducts.length === 0) continue

    const salesCount = randomInt(10, 30)
    for (let i = 0; i < salesCount; i++) {
      const product = pick(shopProducts)
      const quantity = randomInt(1, 5)
      const priceAtSale = Math.max(1, Math.round(product.price * randomFloat(0.95, 1.05, 2)))
      const costAtSale = product.costPrice

      saleDocs.push({
        _id: new mongoose.Types.ObjectId(),
        shopId: shop._id,
        productId: product._id,
        quantity,
        priceAtSale,
        costAtSale,
        channel: Math.random() > 0.5 ? 'online' : 'offline',
        customerName: Math.random() > 0.3 ? randomCustomerName() : '',
        createdAt: randomDate(30),
      })

      const key = product._id.toString()
      soldTally.set(key, (soldTally.get(key) || 0) + quantity)
    }
  }

  const inserted = await Sale.insertMany(saleDocs, { ordered: false, timestamps: false })
  console.log(`STEP 6: Sales Created (${inserted.length})`)

  // Reconcile Product.sold / Product.stock against actual sales, in bulk.
  const bulkOps = []
  for (const product of products) {
    const soldQty = soldTally.get(product._id.toString()) || 0
    if (soldQty === 0) continue
    bulkOps.push({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            sold: soldQty,
            stock: Math.max(0, product.stock - soldQty),
          },
        },
      },
    })
  }
  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps, { ordered: false })
  }

  return saleDocs.map((doc, i) => ({ ...doc, _id: inserted[i]._id }))
}

// =============================================================================
// STEP 7 — CREDITS (only some sales generate a credit entry)
// =============================================================================

async function buildCredits(sales) {
  const creditDocs = []

  for (const sale of sales) {
    if (Math.random() > 0.15) continue // ~15% of sales create a credit line

    const isPaid = Math.random() > 0.4 // ~60% already paid
    const dueDate = new Date(sale.createdAt.getTime() + randomInt(3, 21) * 24 * 60 * 60 * 1000)

    creditDocs.push({
      _id: new mongoose.Types.ObjectId(),
      shopId: sale.shopId,
      customerName: sale.customerName || randomCustomerName(),
      phone: randomPhone(),
      amount: sale.priceAtSale * sale.quantity,
      dueDate,
      paid: isPaid,
      notes: isPaid ? 'Settled in full.' : 'Awaiting customer payment.',
    })
  }

  const inserted = await Credit.insertMany(creditDocs, { ordered: false })
  console.log(`STEP 7: Credits Created (${inserted.length})`)
  return inserted
}

// =============================================================================
// SERVICE PROVIDERS (20-40 total, spread across all 5 cities)
// =============================================================================

async function buildServiceProviders(serviceUsers) {
  const docs = serviceUsers.map((user) => {
    const svc = pick(SERVICE_TYPES)
    const city = pick(CITIES)
    const district = pick(city.districts)
    const username = `@${user.username}` // same leading "@" convention as Shop

    return {
      _id: new mongoose.Types.ObjectId(),
      userId: user._insertedId,
      username,
      name: user._ownerName,
      phone: randomPhone(),
      email: user.email,
      bannerUrl: '',
      description: `Experienced ${svc.workType.toLowerCase()} serving ${district} and nearby areas.`,
      workType: svc.workType,
      areas: pickMany(city.districts, randomInt(1, 3)).map((d) => ({
        state: city.state,
        district: d,
        area: d,
      })),
      serviceArea: `${district}, ${city.name}`,
      price: {
        amount: randomPrice(svc.priceRange[0], svc.priceRange[1]),
        unit: svc.unit,
      },
      workingDays: pick(['Mon-Sat', 'All Week']),
      timeSlots: pick(['9 AM - 6 PM', '8 AM - 8 PM', '10 AM - 7 PM', '24x7']),
      availability: pick(['Available Today', 'Available Tomorrow', 'Busy Until Evening']),
      location: {
        lat: jitter(city.lat, 0.08),
        lng: jitter(city.lng, 0.08),
      },
      rating: randomFloat(3.5, 5, 1),
      reviewCount: randomInt(0, 200),
    }
  })

  const inserted = await ServiceProvider.insertMany(docs, { ordered: false })
  console.log(`STEP 8: Service Providers Created (${inserted.length})`)
  return inserted
}

function csvEscape(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function exportCredentials(rows) {
  const header = ['name', 'email', 'username', 'password', 'role', 'sellerType', 'city', 'category']
  const lines = [header.join(',')]

  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(','))
  }

  fs.writeFileSync(CREDENTIALS_FILE, lines.join('\n'), 'utf8')
  console.log(`STEP 9: Credentials Exported (${rows.length}) → ${CREDENTIALS_FILE}`)
}

// =============================================================================
// MAIN
// =============================================================================

async function run() {
  const startedAt = Date.now()

  await connectDB()
  await clearCollections()

  // Plan shops first so we know exactly how many shop-owner users to create.
  const shopPlan = buildShopPlan()
  const serviceProviderCount = randomInt(20, 40)

  const { shopUsers, serviceUsers } = await buildUsers(shopPlan, serviceProviderCount)
  const shops = await buildShops(shopPlan, shopUsers)
  const products = await buildProducts(shops)
  const sales = await buildSales(shops, products)
  await buildCredits(sales)
  await buildServiceProviders(serviceUsers)
  exportCredentials(credentialRows)

  const totalUsers = shopUsers.length + serviceUsers.length
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)

  console.log('-----------------------------------------------------')
  console.log(`Users:             ${totalUsers}`)
  console.log(`Shops:              ${shops.length}`)
  console.log(`Products:           ${products.length}`)
  console.log(`Sales:              ${sales.length}`)
  console.log(`Service Providers:  ${serviceProviderCount}`)
  console.log(`Each user has a unique password — see ${CREDENTIALS_FILE}`)
  console.log(`Completed in ${seconds}s`)
  console.log('-----------------------------------------------------')
  console.log('FINAL: SUCCESS')

  await mongoose.disconnect()
  process.exit(0)
}

run().catch(async (err) => {
  console.error('❌ Seeding failed:', err)
  try {
    await mongoose.disconnect()
  } catch (_) {
    /* ignore */
  }
  process.exit(1)
})
