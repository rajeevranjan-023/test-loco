// Username rules — keep in sync with backend/utils/username.js (the server is the source of truth).
//   a–z / 0–9 only, lowercase, 5–20 chars, ≥1 letter, ≥3 digits, no blocked number patterns.
// Shown as @username, routed as /:username. Stored with a leading "@" (existing convention).

export const USERNAME_REGEX = /^(?=.*[a-z])(?=(?:.*\d){3,})[a-z0-9]{5,20}$/

export const BLOCKED_NUMBER_PATTERNS = [
  '786', '7860', '7861', '108', '1008', '1088', '1001', '10000', '7', '77', '9', '99', '11', '111', '13',
  '21', '51', '101', '313', '786786', '12', '40', '666', '777', '5', '10', '52', '84',
  '000', '111', '222', '333', '444', '555', '666', '777', '888', '999',
  '00', '11', '22', '33', '44', '55', '66', '77', '88', '99',
  '420', '007', '911', '112', '100', '101',
]

export const stripAt = (raw) => (typeof raw === 'string' ? raw.trim().replace(/^@/, '').toLowerCase() : '')

export function normalizeUsername(raw) {
  const bare = stripAt(raw)
  return bare ? `@${bare}` : ''
}

// Returns '' when valid, otherwise a human-readable reason (used for inline form errors).
export function describeUsernameError(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return 'Username is required.'
  const bare = stripAt(raw)
  if (/\s/.test(bare)) return 'Username cannot contain spaces.'
  if (/[^a-z0-9]/.test(bare)) return 'Use only letters (a–z) and numbers (0–9).'
  if (bare.length < 5) return 'Username must be at least 5 characters.'
  if (bare.length > 20) return 'Username can be at most 20 characters.'
  if (!/[a-z]/.test(bare)) return 'Username needs at least 1 letter.'
  if ((bare.match(/\d/g) || []).length < 3) return 'Username needs at least 3 digits.'
  const blocked = BLOCKED_NUMBER_PATTERNS.find((p) => bare.includes(p))
  if (blocked) return `Username can't contain the number pattern "${blocked}". Try different digits.`
  return USERNAME_REGEX.test(bare) ? '' : 'That username format is not allowed.'
}

export const isValidUsernameFormat = (raw) => describeUsernameError(raw) === ''

// ---- Routing helpers ---------------------------------------------------------------------------

// Cheap "could this be a username?" check for URLs. Deliberately lenient (safe characters only) so
// accounts created under the older rules keep working; the strict rules above apply when a username is created/changed.
// Runs BEFORE any API call, so junk URLs never hit the server.
export const looksLikeUsername = (param) => /^@?[a-z0-9_]{3,30}$/i.test(param || '')

// Instagram-style comparison: case-insensitive, "@" optional on either side.
export const usernameMatches = (a, b) => !!stripAt(a) && stripAt(a) === stripAt(b)

// "/@raj236", "/@raj236/billing"  (canonical, Instagram-style)
export const profilePath = (username, sub = '') => `/@${stripAt(username)}${sub ? `/${sub}` : ''}`

// ---- Owner-area paths ---------------------------------------------------------------------------
// Every management page lives under /:username/<section>. Older code (and the backend's notification links) still
// speak the legacy URLs (/analytics/orders, /customer/ID, /bill/ID …); toOwnerPath() translates them so nothing
// ever points at a global route.
const LEGACY_SUB = {
  '': 'analytics', overview: 'analytics', orders: 'dashboard', billing: 'billing', udhar: 'udhar',
  inventory: 'inventory', customers: 'customer', products: 'products', offers: 'offers',
  messages: 'messages', profile: 'shop', settings: 'settings',
}

export function toOwnerPath(username, to) {
  if (typeof to !== 'string' || !to.startsWith('/')) return to
  const bare = stripAt(username)
  if (!bare) return to
  const base = `/@${bare}`
  const bareBase = `/${bare}` // old-style link without the @ — still counts as already scoped
  if (to === bareBase || to.startsWith(`${bareBase}/`)) return `${base}${to.slice(bareBase.length)}`
  if (to === base || to.startsWith(`${base}/`) || to.startsWith(`${base}?`) || to.startsWith(`${base}#`)) return to // already scoped
  const [, path, rest = ''] = to.match(/^([^?#]*)(.*)$/)
  const seg = path.split('/').filter(Boolean)
  if (seg[0] === 'analytics' && seg.length <= 2) {
    const sub = LEGACY_SUB[seg[1] || '']
    if (!sub) return to
    if (sub === 'billing' && /[?&]new=1\b/.test(rest)) return `${base}/add`
    return `${base}/${sub}${rest}`
  }
  if (['customer', 'bill', 'order'].includes(seg[0]) && seg.length === 2) return `${base}/${seg[0]}/${seg[1]}${rest}`
  if (['members', 'seats', 'courses', 'dues'].includes(seg[0]) && seg.length <= 2) return `${base}/${seg.join('/')}${rest}` // study-centre sections
  return to // /, /settings, /faq … stay as they are
}

// "/raj236/billing/…" → "billing"; "/raj236" → ""
export const sectionOf = (pathname) => (pathname || '').split('/').filter(Boolean)[1] || ''
