const buckets = new Map()
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k) }, 60_000).unref()

export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many requests. Please slow down and try again shortly.', name = 'rl' }) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TEST !== 'true') return next()
    const id = `${name}:${key(req)}`
    const now = Date.now()
    let b = buckets.get(id)
    if (!b || b.reset <= now) { b = { count: 0, reset: now + windowMs }; buckets.set(id, b) }
    b.count++
    if (b.count > max) {
      const retryAfter = Math.ceil((b.reset - now) / 1000)
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({ message, code: 'RATE_LIMITED', retryAfter, requestId: req.id })
    }
    next()
  }
}
