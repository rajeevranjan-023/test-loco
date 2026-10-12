import { logger, redactUrl } from '../utils/logger.js'

// Upper bound for how long a client waits for an answer (REQUEST_TIMEOUT_MS, default 60 s, 0 disables). If a handler is
// still running when it fires, the client gets a clear 504 instead of a hanging connection.
// IMPORTANT: this does NOT cancel the work already in flight. A write may still complete after the 504, so the message tells
// the user to check before repeating the action. Media uploads are exempt (slow links + large videos are legitimate).
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
