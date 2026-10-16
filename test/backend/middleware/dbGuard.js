import { isDbReady, dbStateName } from '../config/db.js'
import { DB_UNAVAILABLE } from './errorHandler.js'
import { logThrottled } from '../utils/logger.js'

export function requireDatabase(req, res, next) {
  if (isDbReady()) return next()
  logThrottled('warn', 'db-unavailable', 10_000, 'db', `Refusing ${req.method} requests: database is ${dbStateName()}.`)
  res.set('Retry-After', String(DB_UNAVAILABLE.retryAfter))
  res.status(DB_UNAVAILABLE.status).json({ message: DB_UNAVAILABLE.message, code: DB_UNAVAILABLE.code, retryAfter: DB_UNAVAILABLE.retryAfter, requestId: req.id })
}
