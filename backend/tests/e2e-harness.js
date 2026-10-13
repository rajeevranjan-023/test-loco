import express from 'express'
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'e2e-secret'; process.env.OTP_DEV_FIXED = 'true'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'; process.env.GOOGLE_CLIENT_ID = 'fake'; process.env.GOOGLE_CLIENT_SECRET = 'fake'
process.env.API_PUBLIC_URL = 'http://localhost:5000'
const { default: mongoose } = await import('mongoose'); mongoose.set('autoIndex', false)
const { default: inner } = await import('../server.js')
const { connectDB } = await import('../config/db.js')
const { googleOAuth } = await import('../utils/googleOAuth.js')
{ const { assertDisposableDb } = await import('./_safeDb.js'); assertDisposableDb(process.env.MONGODB_URI, 'e2e-harness') } // never drop a non-local database
await connectDB(); await mongoose.connection.dropDatabase()
for (const M of Object.values(mongoose.models)) for (const [f, o] of M.schema.indexes()) { const x = { ...o }; delete x.expireAfterSeconds; delete x.background; await M.collection.createIndex(f, x).catch(() => {}) }

const ACCOUNTS = {
  rajeev: { sub: 'g-rajeev', email: 'rajeev@gmail.com', emailVerified: true, name: 'Rajeev Kumar', picture: '' },
  study: { sub: 'g-study', email: 'rjstudy@gmail.com', emailVerified: true, name: 'Rajeev Study', picture: '' },
}
googleOAuth.buildAuthUrl = ({ state, nonce }) => `http://localhost:5000/__fake_google?state=${encodeURIComponent(state)}&nonce=${nonce}`
googleOAuth.exchangeCode = async (code) => ACCOUNTS[code]
const outer = express()
outer.get('/__fake_google', (req, res) => res.send(`<html><body style="font-family:sans-serif"><h2>Continue with Google (test stand-in)</h2>${Object.entries(ACCOUNTS).map(([k, a]) => `<p><a id="acct-${k}" href="/api/auth/google/callback?code=${k}&state=${encodeURIComponent(req.query.state)}">${a.name} — ${a.email}</a></p>`).join('')}</body></html>`))
outer.use(inner)
outer.listen(5000, () => console.log('E2E API on :5000'))

// seed one public shop so there is something to follow
const base = 'http://localhost:5000'; const post = (p, b, t) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(b) }).then((r) => r.json())
const t = (await post('/api/auth/register', { name: 'Demo Owner', email: 'demo@shop.com', password: 'demo-pass-1' })).token
await post('/api/seller/start', { username: '@demo2346', sellerType: 'shop', shopName: 'Demo Kirana', ownerName: 'Demo Owner', phone: '9876500001', category: 'Grocery', address: 'Bhopal' }, t)
const t2 = (await post('/api/auth/register', { name: 'Pappu Plumber', email: 'plumber@shop.com', password: 'demo-pass-1' })).token
await post('/api/seller/start', { username: '@plumb2346', sellerType: 'service', name: 'Pappu Plumber', phone: '9876500002', workType: 'Plumber', priceAmount: 300 }, t2)
console.log('seeded @demo2346 and @plumb2346')
