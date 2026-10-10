// Username rules (shop identity, Instagram-style):  shown as @username, routed as /:username
//
//   • a–z and 0–9 only, always lowercase, 5–20 characters
//   • at least 1 letter and at least 3 digits
//   • must not contain any "lucky/ugly" number pattern from BLOCKED_NUMBER_PATTERNS
//
// Storage keeps the existing convention (a leading "@", e.g. "@raj123") so every current lookup,
// link and seller record keeps working. Rules below apply to NEW or CHANGED usernames only —
// existing accounts are grandfathered (they are never re-validated unless the owner edits the username).

export const USERNAME_REGEX = /^(?=.*[a-z])(?=(?:.*\d){3,})[a-z0-9]{5,20}$/

export const BLOCKED_NUMBER_PATTERNS = [
  '786', '7860', '7861',
  '108', '1008', '1088', '1001', '10000',
  '7', '77', '9', '99', '11', '111', '13',
  '21', '51', '101',
  '313', '786786',
  '12', '40',
  '666', '777',
  '5', '10', '52', '84',
  '000', '111', '222', '333', '444', '555', '666', '777', '888', '999',
  '00', '11', '22', '33', '44', '55', '66', '77', '88', '99',
  '420', '007', '911', '112', '100', '101',
]

export const stripAt = (raw) => (typeof raw === 'string' ? raw.trim().replace(/^@/, '').toLowerCase() : '')

// Always lowercase, always with the leading "@" (the stored/display form).
export function normalizeUsername(raw) {
  const bare = stripAt(raw)
  return bare ? `@${bare}` : ''
}

export const findBlockedPattern = (bare) => BLOCKED_NUMBER_PATTERNS.find((p) => bare.includes(p)) || null

// → { ok: true } | { ok: false, error }
export function validateUsernameRules(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'Username is required.' }
  const bare = stripAt(raw)
  if (/\s/.test(bare)) return { ok: false, error: 'Username cannot contain spaces.' }
  if (/[^a-z0-9]/.test(bare)) return { ok: false, error: 'Use only letters (a–z) and numbers (0–9).' }
  if (bare.length < 5) return { ok: false, error: 'Username must be at least 5 characters.' }
  if (bare.length > 20) return { ok: false, error: 'Username can be at most 20 characters.' }
  if (!/[a-z]/.test(bare)) return { ok: false, error: 'Username needs at least 1 letter.' }
  if ((bare.match(/\d/g) || []).length < 3) return { ok: false, error: 'Username needs at least 3 digits.' }
  const blocked = findBlockedPattern(bare)
  if (blocked) return { ok: false, error: `Username can't contain the number pattern "${blocked}". Try different digits.` }
  if (!USERNAME_REGEX.test(bare)) return { ok: false, error: 'That username format is not allowed.' }
  return { ok: true }
}

export const isValidUsernameFormat = (raw) => validateUsernameRules(raw).ok

// _________________________________________________________________________
// =========================================================================
// Shared username availability check — used by both the seller-onboarding
// flow (sellerController) and the generic Edit Account flow (authController)
// so the two never drift out of sync with each other.
export async function assertUsernameAvailable(rawUsername) {
  // Deferred import avoids a circular dependency (User model doesn't need
  // to know about this util, but this util needs User for the lookup).
  const { default: User } = await import('../models/User.js')

  const rules = validateUsernameRules(rawUsername)
  if (!rules.ok) return { ok: false, error: rules.error }

  const username = normalizeUsername(rawUsername)
  const taken = await User.findOne({ username }).select('_id').lean()
  if (taken) return { ok: false, error: 'That username is already taken.' }

  return { ok: true, username }
}
