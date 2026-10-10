import { MongoMemoryServer } from 'mongodb-memory-server'
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'

const mongod = await MongoMemoryServer.create()
process.env.MONGODB_URI = mongod.getUri()

const { default: app } = await import('../server.js')
const { default: mongoose } = await import('mongoose')
const { connectDB } = await import('../config/db.js')

await connectDB()

const http = await import('http')
const server = app.listen(0)
const port = server.address().port
const base = `http://localhost:${port}`

let failures = 0
function assert(cond, msg) {
  if (!cond) {
    failures++
    console.error('❌ FAIL:', msg)
  } else {
    console.log('✅', msg)
  }
}

async function req(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

// 1. Register consumer
let r = await req('POST', '/api/auth/register', { name: 'Test User', email: 'test@example.com', password: 'password123' })
assert(r.status === 201, `register -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`)
const consumerToken = r.data?.token
assert(!!consumerToken, 'register returns a token')
assert(r.data?.user?.role === 'consumer', 'new user defaults to consumer role')

// 2. Login
r = await req('POST', '/api/auth/login', { email: 'test@example.com', password: 'password123' })
assert(r.status === 200, `login -> 200 (got ${r.status})`)

// 3. Wrong password
r = await req('POST', '/api/auth/login', { email: 'test@example.com', password: 'wrong' })
assert(r.status === 401, `login with wrong password -> 401 (got ${r.status})`)

// 4. Duplicate email
r = await req('POST', '/api/auth/register', { name: 'Dup', email: 'test@example.com', password: 'password123' })
assert(r.status === 409, `duplicate email -> 409 (got ${r.status})`)

// 5. Protected route without token
r = await req('GET', '/api/auth/me')
assert(r.status === 401, `/api/auth/me without token -> 401 (got ${r.status})`)

// 6. Protected route with token
r = await req('GET', '/api/auth/me', null, consumerToken)
assert(r.status === 200 && r.data?.user?.email === 'test@example.com', 'GET /api/auth/me returns the user')

// 7. Start Yours -> shop
r = await req('POST', '/api/seller/start', {
  sellerType: 'shop',
  shopName: 'Test Shop',
  category: 'Electronics',
  address: '123 Main St',
  openTime: '09:00',
  closeTime: '20:00',
}, consumerToken)
assert(r.status === 201, `start seller (shop) -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`)
assert(r.data?.user?.role === 'seller' && r.data?.user?.sellerType === 'shop', 'user becomes seller/shop')
const shopId = r.data?.account?.id
assert(!!shopId, 'shop account has an id')

// 8. Starting seller twice fails
r = await req('POST', '/api/seller/start', { sellerType: 'shop', shopName: 'X' }, consumerToken)
assert(r.status === 409, `starting seller twice -> 409 (got ${r.status})`)

// 9. Create product
r = await req('POST', '/api/seller/products', { name: 'Test Fan', price: 1500, costPrice: 1000, stock: 20, icon: '🌀' }, consumerToken)
assert(r.status === 201, `create product -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`)
const productId = r.data?._id

// 10. List my products
r = await req('GET', '/api/seller/products', null, consumerToken)
assert(r.status === 200 && r.data.length === 1, 'list my products returns 1')

// 11. Record an online sale + offline sale
r = await req('POST', '/api/seller/sales', { productId, quantity: 3, channel: 'online' }, consumerToken)
assert(r.status === 201, `record online sale -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`)
r = await req('POST', '/api/seller/sales', { productId, quantity: 2, channel: 'offline', customerName: 'Walk-in' }, consumerToken)
assert(r.status === 201, `record offline sale -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`)

// 12. Analytics reflects merged sales
r = await req('GET', '/api/seller/analytics', null, consumerToken)
assert(r.status === 200, `get analytics -> 200 (got ${r.status})`)
assert(r.data.totals.totalUnitsSold === 5, `totalUnitsSold === 5 (got ${r.data.totals.totalUnitsSold})`)
assert(r.data.totals.totalSalesOnline === 4500, `totalSalesOnline === 4500 (got ${r.data.totals.totalSalesOnline})`)
assert(r.data.totals.totalSalesOffline === 3000, `totalSalesOffline === 3000 (got ${r.data.totals.totalSalesOffline})`)
assert(r.data.totals.totalProfit === 2500, `totalProfit === 2500 (got ${r.data.totals.totalProfit})`)
assert(r.data.products[0].unitsSold === 5, 'per-product analytics correct')

// 13. Stock decremented
r = await req('GET', '/api/seller/products', null, consumerToken)
assert(r.data[0].stock === 15, `stock decremented to 15 (got ${r.data[0].stock})`)

// 14. Overselling blocked
r = await req('POST', '/api/seller/sales', { productId, quantity: 999, channel: 'online' }, consumerToken)
assert(r.status === 400, `overselling blocked -> 400 (got ${r.status})`)

// 15. Credit ledger
r = await req('POST', '/api/seller/credits', { customerName: 'Anita', amount: 500 }, consumerToken)
assert(r.status === 201, `add credit -> 201 (got ${r.status})`)
const creditId = r.data?._id
r = await req('GET', '/api/seller/credits', null, consumerToken)
assert(r.data.totalDue === 500, `totalDue === 500 (got ${r.data.totalDue})`)
r = await req('PATCH', `/api/seller/credits/${creditId}/pay`, {}, consumerToken)
assert(r.status === 200 && r.data.paid === true, 'mark credit paid works')

// 16. Unified profile fetch — shop
r = await req('GET', `/api/profile/${shopId}`)
assert(r.status === 200 && r.data.type === 'shop', `unified profile detects shop (got type=${r.data?.type})`)
assert(r.data.products.length === 1, 'shop profile includes products')

// 17. Register + start a service provider, then unified profile detects service
r = await req('POST', '/api/auth/register', { name: 'Service Guy', email: 'svc@example.com', password: 'password123' })
const svcToken = r.data.token
r = await req('POST', '/api/seller/start', {
  sellerType: 'service', workType: 'Plumber', priceAmount: 300, priceUnit: 'hour', serviceArea: 'Sector 9',
}, svcToken)
const svcId = r.data?.account?.id
r = await req('GET', `/api/profile/${svcId}`)
assert(r.status === 200 && r.data.type === 'service', `unified profile detects service (got type=${r.data?.type})`)

// 18. Non-seller can't hit seller routes
r = await req('GET', '/api/seller/analytics', null, undefined)
assert(r.status === 401, `analytics without auth -> 401 (got ${r.status})`)

// 19. Search
r = await req('GET', '/api/search?q=fan')
assert(r.status === 200 && r.data.products.some(p => p.name === 'Test Fan'), 'search finds Test Fan')
assert(r.data.products.every((p, i, arr) => i === 0 || arr[i-1].price <= p.price), 'search results sorted by price ascending')

// 20. Public listings
r = await req('GET', '/api/shops')
assert(r.status === 200 && r.data.length >= 1, 'GET /api/shops works')
r = await req('GET', '/api/services')
assert(r.status === 200 && r.data.length >= 1, 'GET /api/services works')
r = await req('GET', '/api/products')
assert(r.status === 200 && r.data.length >= 1, 'GET /api/products works')

// 21. 404 for unknown profile id
r = await req('GET', '/api/profile/000000000000000000000000')
assert(r.status === 404, `unknown profile id -> 404 (got ${r.status})`)

console.log('\n' + (failures === 0 ? `✅ ALL CHECKS PASSED` : `❌ ${failures} CHECK(S) FAILED`))

server.close()
await mongoose.disconnect()
await mongod.stop()
process.exit(failures === 0 ? 0 : 1)
