
export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err, req, res, next) {
  let status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500
  let message = err.message || 'Server error'

  if (err.status && err.expose) status = err.status // deliberate, user-facing errors (e.g. out of stock)
  if (err.name === 'VersionError') {
    status = 409
    message = 'This product was changed by another request. Please try again.'
  }
  if (err.name === 'ValidationError') {
    status = 400
    message = Object.values(err.errors).map((e) => e.message).join(', ')
  }
  if (err.code === 11000) {
    status = 409
    const field = Object.keys(err.keyValue || {})[0]
    message = `An account with this ${field} already exists.`
  }
  if (err.name === 'CastError') {
    status = 400
    message = `Invalid id: ${err.value}`
  }

  res.status(status).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  })
}
