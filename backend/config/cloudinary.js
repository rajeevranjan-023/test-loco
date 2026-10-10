import { v2 as cloudinary } from 'cloudinary'

// Configured lazily (on first real use) rather than at module-import time.
// This is defense-in-depth against the exact class of bug that caused
// "Must supply api_key" here: in ESM, every `import` in server.js is
// hoisted and evaluated before server.js's own top-level code runs — so if
// anything imports this file (even indirectly, through a route file)
// before `dotenv.config()` has actually executed, a module-load-time
// `cloudinary.config({...})` call would silently run with empty env vars.
// Configuring inside a function instead means it only ever runs once an
// actual request comes in — by which point the server has fully booted
// and dotenv has definitely already loaded.
let configured = false

function ensureConfigured() {
  if (configured) return
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    })
  }
  configured = true
}

// A live check, not a boolean captured once — env vars are read fresh
// every time this is called, so it can't go stale relative to when
// dotenv actually finished loading.
export function isCloudinaryConfigured() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env
  return Boolean(
    CLOUDINARY_CLOUD_NAME &&
    CLOUDINARY_API_KEY &&
    CLOUDINARY_API_SECRET &&
    CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
    CLOUDINARY_API_KEY !== 'your_api_key' &&
    CLOUDINARY_API_SECRET !== 'your_api_secret'
  )
}

// Call this before any cloudinary.* call. Idempotent — safe to call on
// every request.
export function getCloudinary() {
  ensureConfigured()
  return cloudinary
}

export default cloudinary
