const KEY = 'lf_token'
const read = () => { try { return localStorage.getItem(KEY) || null } catch { return null } }

let token = read()
let epoch = 0
const inflight = new Set()
const resetters = new Set()
let unauthorized = null

export const getToken = () => token
export const storedToken = read // what localStorage says right now (may differ from `token` when another tab changed it)
export const getEpoch = () => epoch
export function setToken(next, { persist = true } = {}) {
  token = next || null
  if (!persist) return
  try { next ? localStorage.setItem(KEY, next) : localStorage.removeItem(KEY) } catch { /* private mode: memory only */ }
}

// Account-specific browser state (NOT public preferences such as the selected city or the theme).
const ACCOUNT_LOCAL_KEYS = ['lf_view_mode', 'lf_seller_prefs']
const ACCOUNT_SESSION_KEYS = ['lf_pending_action']
export function clearAccountStorage() {
  try { ACCOUNT_LOCAL_KEYS.forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
  try { ACCOUNT_SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k)) } catch { /* ignore */ }
}

// The identity changed: abort everything in flight, run the resetters, and hand out a new epoch.
export function beginIdentity() {
  epoch += 1
  for (const c of inflight) c.abort()
  inflight.clear()
  resetters.forEach((fn) => { try { fn() } catch { /* a reset must never block a logout */ } })
  return epoch
}
export const onIdentityReset = (fn) => { resetters.add(fn); return () => resetters.delete(fn) }

export const trackRequest = (controller) => { inflight.add(controller); return () => inflight.delete(controller) }
export const setUnauthorizedHandler = (fn) => { unauthorized = fn }
export const notifyUnauthorized = (usedToken) => { if (unauthorized) unauthorized(usedToken) }

// "Your session expired" notice: set when the server rejected our token, shown once on the login page, then forgotten.
const EXPIRED_KEY = 'lf_session_expired'
export const flagSessionExpired = () => { try { sessionStorage.setItem(EXPIRED_KEY, '1') } catch { /* private mode: no notice, still logged out */ } }
export const peekSessionExpired = () => { try { return sessionStorage.getItem(EXPIRED_KEY) === '1' } catch { return false } }
export const clearSessionExpired = () => { try { sessionStorage.removeItem(EXPIRED_KEY) } catch { /* ignore */ } }
