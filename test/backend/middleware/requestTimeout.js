import { logger, redactUrl } from '../utils/logger.js'

export function requestTimeout({ ms = Number.parseInt(process.env.REQUEST_TIMEOUT_MS ?? '60000', 10), skip = (req) => req.originalUrl.startsWith('/api/media/upload') } = {}) {
  return (req, res, next) => {
    if (!(ms > 0) || skip(req)) return next()
    const timer = setTimeout(() => {
      if (res.headersSent) return
      logger.error('timeout', `${req.method} ${redactUrl(req.originalUrl)} exceeded ${ms} ms`, { requestId: req.id })
      res.status(504).json({
        message: 'This is taking longer than expected. Please check whether your change was saved before trying again.',
        code: 'REQUEST_TIMEOUT',
        requestId: req.id,
      })
    }, ms)
    timer.unref?.()
    const done = () => clearTimeout(timer)
    res.on('finish', done)
    res.on('close', done)
    next()
  }
}
