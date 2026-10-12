import 'dotenv/config'

import express from 'express'
import { corsMiddleware, warnProductionConfig } from './middleware/corsConfig.js'
import morgan from 'morgan'



import { connectDB } from './config/db.js'
import { seedIfMissing } from './seed/seedDemo.js'
import { seedHomeConfig } from './seed/seedHome.js'
import { seedStudyIfMissing } from './seed/seedStudyCenter.js'
import { seedServiceIfMissing } from './seed/seedServiceProvider.js'
import { autoSeedEnabled, autoSeedBlockedReason } from './seed/guard.js'
import { migrateLedger } from './utils/common/ledger.js'
import { ensureBillIndexes } from './utils/common/billId.js'
import { migrateInventory } from './utils/common/stock.js'
import { notFound, errorHandler, requestId } from './middleware/errorHandler.js'
import { requireDatabase } from './middleware/dbGuard.js'
import { requestTimeout } from './middleware/requestTimeout.js'
import { isDbReady } from './config/db.js'
import { logger, redactUrl } from './utils/logger.js'
import { installProcessHandlers } from './utils/processHandlers.js'
import { assertOtpConfig, otpMode } from './utils/otp.js'



// https://local-backend-7wqg.onrender.com



const app = express()
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY) // needed behind Render/NGINX so rate limits see the real client IP

app.use(corsMiddleware())
app.use(requestId) // every response carries X-Request-Id; error bodies and server log lines share it
app.use(express.json())
// Anything answered to an authenticated request is private: never let a browser/proxy cache reuse it for another account.
app.use('/api', (req, res, next) => { if (req.headers.authorization) { res.set('Cache-Control', 'no-store'); res.vary('Authorization') } next() })
if (process.env.NODE_ENV !== 'test') {
  morgan.token('safe-url', (req) => redactUrl(req.originalUrl)) // never log OAuth code/state, reset tokens … from the query string
  app.use(morgan(':method :safe-url :status :response-time ms - :res[content-length]'))
}
// _________________________________________________________________________
// =========================================================================
// Health. /api/health/live = "the process is up" (always 200 — use for restart-on-failure probes).
// /api/health and /api/health/ready = "can this instance serve traffic" — 503 while the required database is not connected.
app.get('/api/health/live', (req, res) => res.set('Cache-Control', 'no-store').json({ status: 'ok' }))
const readiness = (req, res) => {
  res.set('Cache-Control', 'no-store')
  if (isDbReady()) return res.json({ status: 'ok', database: 'up' })
  res.set('Retry-After', '5').status(503).json({ status: 'unavailable', database: 'down' })
}
app.get('/api/health', readiness)
app.get('/api/health/ready', readiness)

app.use('/api', requestTimeout())  // bounded wait for the client (see middleware/requestTimeout.js)
app.use('/api', requireDatabase)   // database down → immediate 503 instead of a queued query that times out

import listingRoutes from './routes/listingRoutes.js'
app.use('/api', listingRoutes)

import homeRoutes from './routes/homeRoutes.js'
app.use('/api', homeRoutes)

import searchRoutes from './routes/searchRoutes.js'
app.use('/api/search', searchRoutes)

import authRoutes from './routes/authRoutes.js'
app.use('/api/auth', authRoutes)

import sellerRoutes from './routes/sellerRoutes.js'
app.use('/api/seller', sellerRoutes)

import billRoutes from './routes/common/billRoutes.js'
app.use('/api/bills', billRoutes)

import customerRoutes from './routes/common/customerRoutes.js'
app.use('/api/customers', customerRoutes)
app.use('/api/seller/customers', customerRoutes) 


import profileRoutes from './routes/profileRoutes.js'
app.use('/api/profile', profileRoutes)

import reviewRoutes from './routes/reviewRoutes.js'
app.use('/api/reviews', reviewRoutes)

import requirementRoutes from './routes/requirementRoutes.js'
app.use('/api/requirements', requirementRoutes)

import followRoutes from './routes/followRoutes.js'
app.use('/api/follow', followRoutes)

import mediaRoutes from './routes/mediaRoutes.js'
app.use('/api/media', mediaRoutes)

import studyPublicRoutes from './routes/library/studyPublicRoutes.js'
app.use('/api/study', studyPublicRoutes)


// _________________________________________________________________________
// =========================================================================
app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

async function start() {
  installProcessHandlers()
  warnProductionConfig()
  assertOtpConfig() // refuses to boot if the fixed dev OTP is enabled in production, or production has no SMS provider
  console.log(`[otp] mode: ${otpMode()}`)
  await connectDB()
  await ensureBillIndexes().catch((e) => logger.error('bill-index', `failed: ${e.message}`))
  await migrateLedger().catch((e) => logger.error('ledger-migrate', `failed: ${e.message}`))
  // Dev seed data is OPT-IN (AUTO_SEED=true) and never runs in production (seed/guard.js). An empty database stays empty.
  if (autoSeedBlockedReason()) console.warn(`[auto-seed] ${autoSeedBlockedReason()}`)
  if (autoSeedEnabled()) {
    await seedIfMissing().catch((e) => logger.error('auto-seed', `failed: ${e.message}`))
    await seedStudyIfMissing().catch((e) => logger.error('study-seed', `failed: ${e.message}`))
    await seedServiceIfMissing().catch((e) => logger.error('service-seed', `failed: ${e.message}`))
  }
  await seedHomeConfig().catch((e) => logger.error('home-seed', `failed: ${e.message}`))
  await migrateInventory().then((r) => (r.coded || r.batched) && console.log(`[inventory-migrate] ${r.coded} product ids, ${r.batched} opening batches`)).catch((e) => logger.error('inventory-migrate', `failed: ${e.message}`))
  app.listen(PORT, () => console.log(`Local Finder API running on http://localhost:${PORT}`))
}

if (process.env.NODE_ENV !== 'test') {
  start()
}

export default app
