# Error handling — how it works

## API contract (backend)
Every error is JSON: `{ message, code, errors?, retryAfter?, requestId, stack? }`.
`message` already existed; `code`, `errors`, `retryAfter`, `requestId` are additive. `stack` is **never** sent in production
(`isProduction()` = NODE_ENV=production / RENDER / VERCEL) and is redacted in development.

| Situation | Status | `code` |
|---|---|---|
| Validation (Mongoose) | 400 | `VALIDATION_ERROR` (+ `errors: {field: msg}`) |
| Malformed / oversized body | 400 / 413 | `INVALID_JSON` / `PAYLOAD_TOO_LARGE` |
| Bad id (CastError) | 400 | `INVALID_ID` |
| Not logged in / expired / revoked | 401 | `SESSION_EXPIRED` |
| Forbidden | 403 | – (authored message) |
| Unknown route | 404 | `ROUTE_NOT_FOUND` |
| Duplicate key | 409 | `DUPLICATE_RECORD` (+ `errors` for email/username/phone) |
| Rate limited | 429 | `RATE_LIMITED` (+ `Retry-After`, `retryAfter`) |
| Database unreachable | 503 | `DATABASE_UNAVAILABLE` (+ `Retry-After`) |
| Request exceeded `REQUEST_TIMEOUT_MS` | 504 | `REQUEST_TIMEOUT` |
| Anything unexpected | 500 | `INTERNAL_ERROR` |

Deliberate user-facing failures keep the existing convention: `throw Object.assign(new Error(msg), { status, expose: true })`.

## Startup / recovery behaviour changes (please review)
* **Startup, DB unreachable:** unchanged — the process logs a redacted reason and exits with code 1 (supervisor restarts it).
  The wait is now bounded: `serverSelectionTimeoutMS` 8 s (was driver default 30 s), `connectTimeoutMS` 10 s.
  Env overrides: `MONGO_SERVER_SELECTION_TIMEOUT_MS`, `MONGO_CONNECT_TIMEOUT_MS`, optional `MONGO_HEARTBEAT_MS` (≥500).
* **After startup, DB lost:** the driver reconnects by itself (unchanged). New: `/api` requests get an immediate 503 while
  `mongoose.connection.readyState !== 1`; transitions are logged ("connection lost" / "restored"). No restart is needed.
* **Health:** `GET /api/health` and `/api/health/ready` now return **503** `{status:'unavailable',database:'down'}` while the DB is
  down (they used to always say `ok`). `GET /api/health/live` always returns 200 — **if your host restarts the instance when the
  health check fails, point it at `/api/health/live`**, otherwise a DB outage will restart the app needlessly.
* **Request timeout:** `/api` requests (except media upload) are answered with 504 after `REQUEST_TIMEOUT_MS` (default 60000, 0 disables).
  This does not cancel the underlying work, so the 504 text tells users to check before repeating a change.
* **Unhandled rejections** are logged and the process keeps running; **uncaught exceptions** are logged and the process exits(1).
* **No automatic write retries** were added anywhere (driver-level `retryWrites` is the driver default and untouched).
* Access log (morgan) now prints `:method :safe-url :status …` with sensitive query values masked (no colours).

## Frontend
* `services/apiError.js` — every failed request becomes an `ApiError` whose `.message` is safe; `.status`/`.data` keep working.
  `retryable` is true only for GET/HEAD on transient failures. Default Axios timeout 30 s (`VITE_API_TIMEOUT_MS`), uploads 120 s.
* `services/connectivity.js` + `ConnectionBanner` — one shared "can't reach the server" notice (no duplicates, self-clearing).
* `ErrorBoundary` — root + route-level + layout-level; `ErrorState` — failure state with retry only when safe.
* Sessions: a 401 on an authenticated request ends the session once and the login page explains why. Network/DB failures never log out.
