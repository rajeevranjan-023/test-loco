// Is this error "the database is unreachable / not ready" (→ 503, retry later) rather than a bug in our code (→ 500)?
// Pure function, no mongoose import, so the error handler and tests can use it without loading a database driver.

// MongoDB driver / Mongoose error class names that mean "cannot talk to the server right now".
const UNAVAILABLE_NAMES = new Set([
  'MongoServerSelectionError', 'MongooseServerSelectionError', // no suitable server within serverSelectionTimeoutMS
  'MongoNetworkError', 'MongoNetworkTimeoutError',
  'MongoNotConnectedError', 'MongoTopologyClosedError', 'MongoPoolClearedError', 'MongoPoolClosedError', 'MongoWaitQueueTimeoutError',
])

// Server-side error codes meaning the node is shutting down / stepping down / unreachable (transient by nature).
const UNAVAILABLE_CODES = new Set([6, 7, 89, 91, 189, 9001, 10107, 11600, 11602, 13435, 13436])

// Mongoose's own queue: operations issued while disconnected wait `bufferTimeoutMS`, then fail with this message.
const MONGOOSE_NOT_READY = /buffering timed out|before initial connection is complete|client must be connected|connection (was )?closed|topology (was )?destroyed/i

export function isDbUnavailableError(err) {
  for (let e = err, i = 0; e && typeof e === 'object' && i < 4; e = e.cause, i++) {
    if (UNAVAILABLE_NAMES.has(e.name)) return true
    if (e.name === 'MongoServerError' && UNAVAILABLE_CODES.has(e.code)) return true
    if ((e.name === 'MongooseError' || e.name === 'MongoRuntimeError') && MONGOOSE_NOT_READY.test(String(e.message))) return true
  }
  return false
}
