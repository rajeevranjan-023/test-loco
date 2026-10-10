import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import morgan from 'morgan'



import { connectDB } from './config/db.js'
import { seedIfMissing } from './seed/seedDemo.js'
import { seedHomeConfig } from './seed/seedHome.js'
import { seedStudyIfMissing } from './seed/seedStudyCenter.js'
import { migrateLedger } from './utils/ledger.js'
import { ensureBillIndexes } from './utils/billId.js'
import { migrateInventory } from './utils/stock.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import { assertOtpConfig, otpMode } from './utils/otp.js'



// https://local-backend-7wqg.onrender.com



const app = express()
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY) // needed behind Render/NGINX so rate limits see the real client IP

app.use(cors())
app.use(express.json())
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}
// _________________________________________________________________________
// =========================================================================
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

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

import billRoutes from './routes/billRoutes.js'
app.use('/api/bills', billRoutes)

import customerRoutes from './routes/customerRoutes.js'
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

import studyPublicRoutes from './routes/studyPublicRoutes.js'
app.use('/api/study', studyPublicRoutes)


// _________________________________________________________________________
// =========================================================================
app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

async function start() {
  assertOtpConfig() // refuses to boot if the fixed dev OTP is enabled in production, or production has no SMS provider
  console.log(`[otp] mode: ${otpMode()}`)
  await connectDB()
  await ensureBillIndexes().catch((e) => console.error('[bill-index] failed:', e.message))
  await migrateLedger().catch((e) => console.error('[ledger-migrate] failed:', e.message))
  if (process.env.AUTO_SEED !== 'false') await seedIfMissing().catch((e) => console.error('[auto-seed] failed:', e.message))
  if (process.env.AUTO_SEED !== 'false') await seedStudyIfMissing().catch((e) => console.error('[study-seed] failed:', e.message))
  await seedHomeConfig().catch((e) => console.error('[home-seed] failed:', e.message))
  await migrateInventory().then((r) => (r.coded || r.batched) && console.log(`[inventory-migrate] ${r.coded} product ids, ${r.batched} opening batches`)).catch((e) => console.error('[inventory-migrate] failed:', e.message))
  app.listen(PORT, () => console.log(`Local Finder API running on http://localhost:${PORT}`))
}

if (process.env.NODE_ENV !== 'test') {
  start()
}

export default app
