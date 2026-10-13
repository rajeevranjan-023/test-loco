const UNAVAILABLE_NAMES = new Set([
  'MongoServerSelectionError', 'MongooseServerSelectionError', // no suitable server within serverSelectionTimeoutMS
  'MongoNetworkError', 'MongoNetworkTimeoutError',
  'MongoNotConnectedError', 'MongoTopologyClosedError', 'MongoPoolClearedError', 'MongoPoolClosedError', 'MongoWaitQueueTimeoutError',
])

const UNAVAILABLE_CODES = new Set([6, 7, 89, 91, 189, 9001, 10107, 11600, 11602, 13435, 13436])

const MONGOOSE_NOT_READY = /buffering timed out|before initial connection is complete|client must be connected|connection (was )?closed|topology (was )?destroyed/i

export function isDbUnavailableError(err) {
  for (let e = err, i = 0; e && typeof e === 'object' && i < 4; e = e.cause, i++) {
    if (UNAVAILABLE_NAMES.has(e.name)) return true
    if (e.name === 'MongoServerError' && UNAVAILABLE_CODES.has(e.code)) return true
    if ((e.name === 'MongooseError' || e.name === 'MongoRuntimeError') && MONGOOSE_NOT_READY.test(String(e.message))) return true
  }
  return false
}
