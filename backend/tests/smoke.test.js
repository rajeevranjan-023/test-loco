// End-to-end smoke test against an isolated, disposable MongoDB database.
// Preferred: set TEST_MONGODB_URI to a local disposable database.
// Otherwise mongodb-memory-server starts a temporary in-memory MongoDB instance.
// Never point TEST_MONGODB_URI at Atlas or another hosted cluster.

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'

let mongod = null

if (process.env.TEST_MONGODB_URI) {
  if (/mongodb\+srv:|\.mongodb\.net/.test(process.env.TEST_MONGODB_URI)) {
    console.error('BLOCKED: refusing to run against a hosted MongoDB cluster.')
    process.exit(2)
  }

  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI
} else {
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    mongod = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongod.getUri()
  } catch (error) {
    console.error(
      'BLOCKED: could not start mongodb-memory-server. Install/configure it or set TEST_MONGODB_URI to a local disposable database.',
      error.message
    )
    process.exit(2)
  }
}

const { default: mongoose } = await import('mongoose')
const { default: app } = await import('../server.js')
const { connectDB } = await import('../config/db.js')
const { default: User } = await import('../models/common/User.js')

await connectDB()

const server = app.listen(0)
const port = server.address().port
const base = `http://127.0.0.1:${port}`

let failures = 0

function assert(condition, message) {
  if (!condition) {
    failures++
    console.error('❌ FAIL:', message)
  } else {
    console.log('✅', message)
  }
}

async function req(method, path, body, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined || body === null
      ? undefined
      : JSON.stringify(body),
  })

  let data = null

  try {
    data = await response.json()
  } catch {
    // Some responses may not contain JSON.
  }

  return {
    status: response.status,
    data,
  }
}

try {
  // 1. Register a consumer.
  let r = await req('POST', '/api/auth/register', {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  })

  assert(
    r.status === 201,
    `register -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`
  )

  const consumerToken = r.data?.token
  const consumerId = r.data?.user?.id

  assert(!!consumerToken, 'register returns a token')

  assert(
    r.data?.user?.role === 'consumer',
    'new user defaults to consumer role'
  )

  // The legacy test registration endpoint does not create a username.
  // Add a valid username and phone to this disposable test account.
  if (consumerId) {
    await User.findByIdAndUpdate(consumerId, {
      username: '@smoketest236',
      phone: '9876543210',
    })
  } else {
    assert(false, 'registered consumer has an id for test setup')
  }

  // 2. Login.
  r = await req('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'password123',
  })

  assert(
    r.status === 200,
    `login -> 200 (got ${r.status})`
  )

  // 3. Wrong password.
  r = await req('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'wrong',
  })

  assert(
    r.status === 401,
    `login with wrong password -> 401 (got ${r.status})`
  )

  // 4. Duplicate email.
  r = await req('POST', '/api/auth/register', {
    name: 'Duplicate User',
    email: 'test@example.com',
    password: 'password123',
  })

  assert(
    r.status === 409,
    `duplicate email -> 409 (got ${r.status})`
  )

  // 5. Protected route without token.
  r = await req('GET', '/api/auth/me')

  assert(
    r.status === 401,
    `/api/auth/me without token -> 401 (got ${r.status})`
  )

  // 6. Protected route with token.
  r = await req('GET', '/api/auth/me', null, consumerToken)

  assert(
    r.status === 200 &&
      r.data?.user?.email === 'test@example.com',
    'GET /api/auth/me returns the user'
  )

  // 7. Start a shop with all required fields.
  r = await req(
    'POST',
    '/api/seller/start',
    {
      sellerType: 'shop',
      shopName: 'Test Shop',
      ownerName: 'Test User',
      phone: '9876543210',
      category: 'Electronics',
      address: '123 Main St',
      openTime: '09:00',
      closeTime: '20:00',
    },
    consumerToken
  )

  assert(
    r.status === 201,
    `start seller (shop) -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`
  )

  assert(
    r.data?.user?.role === 'seller' &&
      r.data?.user?.sellerType === 'shop',
    'user becomes seller/shop'
  )

  const shopId = r.data?.account?.id

  assert(!!shopId, 'shop account has an id')

  // Continue shop-specific tests only if shop creation succeeded.
  if (r.status === 201 && shopId) {
    // 8. Starting seller twice must fail with conflict.
    r = await req(
      'POST',
      '/api/seller/start',
      {
        sellerType: 'shop',
        shopName: 'Another Test Shop',
        ownerName: 'Test User',
        phone: '9876543210',
        address: '123 Main St',
      },
      consumerToken
    )

    assert(
      r.status === 409,
      `starting seller twice -> 409 (got ${r.status})`
    )

    // 9. Create product.
    r = await req(
      'POST',
      '/api/seller/products',
      {
        name: 'Test Fan',
        price: 1500,
        costPrice: 1000,
        stock: 20,
        icon: '🌀',
      },
      consumerToken
    )

    assert(
      r.status === 201,
      `create product -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`
    )

    const productId = r.data?._id || r.data?.product?._id

    // 10. List products.
    r = await req(
      'GET',
      '/api/seller/products',
      null,
      consumerToken
    )

    assert(
      r.status === 200 &&
        Array.isArray(r.data) &&
        r.data.length === 1,
      'list my products returns 1'
    )

    if (productId) {
      // 11. Record online sale.
      r = await req(
        'POST',
        '/api/seller/sales',
        {
          productId,
          quantity: 3,
          channel: 'online',
        },
        consumerToken
      )

      assert(
        r.status === 201,
        `record online sale -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`
      )

      // Record offline sale.
      r = await req(
        'POST',
        '/api/seller/sales',
        {
          productId,
          quantity: 2,
          channel: 'offline',
          customerName: 'Walk-in',
        },
        consumerToken
      )

      assert(
        r.status === 201,
        `record offline sale -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`
      )

      // 12. Analytics reflects both sales.
      r = await req(
        'GET',
        '/api/seller/analytics',
        null,
        consumerToken
      )

      assert(
        r.status === 200,
        `get analytics -> 200 (got ${r.status})`
      )

      if (r.status === 200 && r.data?.totals) {
        assert(
          r.data.totals.totalUnitsSold === 5,
          `totalUnitsSold === 5 (got ${r.data.totals.totalUnitsSold})`
        )

        assert(
          r.data.totals.totalSalesOnline === 4500,
          `totalSalesOnline === 4500 (got ${r.data.totals.totalSalesOnline})`
        )

        assert(
          r.data.totals.totalSalesOffline === 3000,
          `totalSalesOffline === 3000 (got ${r.data.totals.totalSalesOffline})`
        )

        assert(
          r.data.totals.totalProfit === 2500,
          `totalProfit === 2500 (got ${r.data.totals.totalProfit})`
        )

        assert(
          r.data.products?.[0]?.unitsSold === 5,
          'per-product analytics correct'
        )
      } else {
        assert(false, 'analytics response contains totals')
      }

      // 13. Stock should be decremented.
      r = await req(
        'GET',
        '/api/seller/products',
        null,
        consumerToken
      )

      assert(
        r.status === 200 && r.data?.[0]?.stock === 15,
        `stock decremented to 15 (got ${r.data?.[0]?.stock})`
      )

      // 14. Overselling should be blocked.
      r = await req(
        'POST',
        '/api/seller/sales',
        {
          productId,
          quantity: 999,
          channel: 'online',
        },
        consumerToken
      )

      assert(
        r.status === 400,
        `overselling blocked -> 400 (got ${r.status})`
      )
    }

    // 15. Credit ledger.
    r = await req(
      'POST',
      '/api/seller/credits',
      {
        customerName: 'Anita',
        amount: 500,
      },
      consumerToken
    )

    assert(
      r.status === 201,
      `add credit -> 201 (got ${r.status})`
    )

    const creditId = r.data?._id

    r = await req(
      'GET',
      '/api/seller/credits',
      null,
      consumerToken
    )

    assert(
      r.status === 200 && r.data?.totalDue === 500,
      `totalDue === 500 (got ${r.data?.totalDue})`
    )

    if (creditId) {
      r = await req(
        'PATCH',
        `/api/seller/credits/${creditId}/pay`,
        {},
        consumerToken
      )

      assert(
        r.status === 200 && r.data?.paid === true,
        'mark credit paid works'
      )
    }

    // 16. Unified profile fetch for the shop.
// The public profile endpoint expects a username, not a database ID.
const shopUsername = r.data?.account?.username || '@smoketest236'

r = await req('GET', `/api/profile/${encodeURIComponent(shopUsername)}`)

console.log(
  '\nSHOP PROFILE DEBUG:',
  JSON.stringify({ status: r.status, data: r.data }, null, 2)
)

assert(
  r.status === 200,
  `shop profile -> 200 (got ${r.status})`
)

assert(
  r.status === 200 &&
    (r.data?.type === 'shop' || r.data?.businessType === 'Retail'),
  `shop profile identifies the shop (type=${r.data?.type}, businessType=${r.data?.businessType})`
)

assert(
  r.status === 200 &&
    Array.isArray(r.data?.products) &&
    r.data.products.length === 1,
  'shop profile includes products'
)
  } else {
    console.error(
      '⚠️ Skipping shop-dependent checks because shop setup failed.'
    )
  }

  // 17. Register and start a service provider.
  r = await req('POST', '/api/auth/register', {
    name: 'Service Guy',
    email: 'svc@example.com',
    password: 'password123',
  })

  assert(
    r.status === 201,
    `register service user -> 201 (got ${r.status})`
  )

  const svcToken = r.data?.token
  const svcUserId = r.data?.user?.id

  if (svcUserId && svcToken) {
    await User.findByIdAndUpdate(svcUserId, {
      username: '@smokeservice236',
      phone: '9876543211',
    })

    r = await req(
      'POST',
      '/api/seller/start',
      {
        sellerType: 'service',
        workType: 'Plumber',
        priceAmount: 300,
        priceUnit: 'hour',
        serviceArea: 'Sector 9',
        description: 'Test plumbing service',
      },
      svcToken
    )

    assert(
      r.status === 201,
      `start service provider -> 201 (got ${r.status}: ${JSON.stringify(r.data)})`
    )

    const svcId = r.data?.account?.id
const svcUsername = r.data?.account?.username || '@smokeservice236'
if (svcId) {
  r = await req(
    'GET',
    `/api/profile/${encodeURIComponent(svcUsername)}`
  )

  console.log(
    '\nSERVICE PROFILE DEBUG:',
    JSON.stringify(
      {
        status: r.status,
        data: r.data,
      },
      null,
      2
    )
  )

  assert(
    r.status === 200,
    `service profile -> 200 (got ${r.status})`
  )

  assert(
    r.status === 200 &&
      (r.data?.type === 'service' || r.data?.workType === 'Plumber'),
    `service profile identifies provider (type=${r.data?.type}, workType=${r.data?.workType})`
  )
} else {
  assert(false, 'service account has an id')
}
  } else {
    assert(false, 'service test user has token and id')
  }

  // 18. Analytics route without authentication.
  r = await req('GET', '/api/seller/analytics')

  assert(
    r.status === 401,
    `analytics without auth -> 401 (got ${r.status})`
  )

  // 19. Search.
  r = await req('GET', '/api/search?q=fan')

  assert(
    r.status === 200 &&
      r.data?.products?.some((product) => product.name === 'Test Fan'),
    'search finds Test Fan'
  )

  assert(
    r.status === 200 &&
      r.data?.products?.every(
        (product, index, products) =>
          index === 0 ||
          products[index - 1].price <= product.price
      ),
    'search results sorted by price ascending'
  )

  // 20. Public listings.
  r = await req('GET', '/api/shops')

  assert(
    r.status === 200 &&
      Array.isArray(r.data) &&
      r.data.length >= 1,
    'GET /api/shops works'
  )

  r = await req('GET', '/api/services')

  assert(
    r.status === 200 &&
      Array.isArray(r.data) &&
      r.data.length >= 1,
    'GET /api/services works'
  )

  r = await req('GET', '/api/products')

  assert(
    r.status === 200 &&
      Array.isArray(r.data) &&
      r.data.length >= 1,
    'GET /api/products works'
  )

  // 21. Unknown profile ID returns 404.
  r = await req(
    'GET',
    '/api/profile/000000000000000000000000'
  )

  assert(
    r.status === 404,
    `unknown profile id -> 404 (got ${r.status})`
  )

  console.log(
    '\n' +
      (
        failures === 0
          ? '✅ ALL CHECKS PASSED'
          : `❌ ${failures} CHECK(S) FAILED`
      )
  )

  process.exitCode = failures === 0 ? 0 : 1
} finally {
  await new Promise((resolve) => server.close(resolve))
  await mongoose.disconnect()

  if (mongod) {
    await mongod.stop()
  }
}