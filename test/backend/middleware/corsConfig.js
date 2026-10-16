import cors from 'cors'
import { isProduction } from '../seed/guard.js'

export const allowedOrigins = () =>
  (process.env.CLIENT_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)

export function corsOptions() {
  const list = allowedOrigins()
  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true) // non-browser clients (curl, server-to-server, health checks) send no Origin
      if (list.length) return cb(null, list.includes(origin.replace(/\/$/, '')))
      return cb(null, !isProduction()) // nothing configured: open in dev, closed in production
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'x-view-as', 'x-registration-token'],
    exposedHeaders: ['Retry-After', 'X-Request-Id'], // not CORS-safelisted: without this a cross-origin frontend cannot read them
    maxAge: 600,
  }
}

export const corsMiddleware = () => cors(corsOptions())

// Called once at boot (not under test): tell the operator about unsafe production configuration without printing values.
export function warnProductionConfig(log = console.warn) {
  if (!isProduction()) return
  if (!allowedOrigins().length) log('[config] CLIENT_ORIGIN is not set: cross-origin browser requests are blocked in production.')
  if (!process.env.TRUST_PROXY) log('[config] TRUST_PROXY is not set: behind a proxy every client shares one rate-limit bucket (req.ip).')
  log('[config] Rate limiting is in-memory and per instance; with more than one server instance the limits are per instance. Use a shared store (e.g. Redis) before scaling out.')
}
