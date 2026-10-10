// Tiny fixed-window in-memory limiter (per process). Good enough to blunt brute force on a single instance; if the API is
// scaled to several instances, swap the Map for a shared store (Redis) — the call sites don't change.
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
      res.set('Retry-After', String(Math.ceil((b.reset - now) / 1000)))
      return res.status(429).json({ message })
    }
    next()
  }
}
