// Client-side validators — these mirror the backend rules in
// authController.updateMe exactly, so users get instant feedback and the
// server remains the final authority.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[0-9][0-9\s\-()]{6,17}$/
const USERNAME_REGEX = /^@[a-zA-Z0-9]+(_[a-zA-Z0-9]+)*$/

export function normalizeUsername(raw) {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

export function validateName(value) {
  if (!value || !value.trim()) return 'Name is required.'
  return ''
}

export function validateEmail(value) {
  if (!value || !value.trim()) return 'Email is required.'
  if (!EMAIL_REGEX.test(value.trim())) return 'Enter a valid email address.'
  return ''
}

// Phone is optional, but if provided it must look like a real number.
export function validatePhone(value) {
  if (!value || !value.trim()) return ''
  if (!PHONE_REGEX.test(value.trim())) return 'Enter a valid phone number (7-15 digits, may start with +).'
  return ''
}

// Username is optional for plain accounts; if provided it must be well-formed.
export function validateUsername(value) {
  if (!value || !value.trim()) return ''
  const u = normalizeUsername(value)
  if (u.length < 4 || !USERNAME_REGEX.test(u)) {
    return 'Use letters, numbers and underscores only (e.g. @rajeev_ranjan), at least 3 characters after @.'
  }
  return ''
}

export function validateBio(value) {
  if ((value || '').length > 160) return 'Bio must be 160 characters or fewer.'
  return ''
}
