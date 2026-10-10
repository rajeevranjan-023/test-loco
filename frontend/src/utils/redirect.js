// Safe post-login redirects + "resume what the visitor was doing" for protected actions.
// Only same-site absolute paths are ever honoured — never another origin, "//host", "/\host", "javascript:" etc.
// (The backend applies the same rule to the `next` it round-trips through Google.)

export function safeNext(raw, fallback = '/') {
  if (typeof raw !== 'string') return fallback
  const v = raw.trim()
  if (!v || v.length > 500) return fallback
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return fallback
  try { if (new URL(v, 'http://loco.invalid').origin !== 'http://loco.invalid') return fallback } catch { return fallback }
  // never bounce someone back into an auth screen
  if (/^\/(login|signup|register|auth\/callback|forgot-password|reset-password)(\/|\?|$)/.test(v)) return fallback
  return v
}

export const loginUrl = (next) => {
  const n = safeNext(next, '')
  return n ? `/login?next=${encodeURIComponent(n)}` : '/login'
}
export const signupUrl = (next) => {
  const n = safeNext(next, '')
  return n ? `/signup?next=${encodeURIComponent(n)}` : '/signup'
}

// ── pending action (e.g. "follow this shop") kept for the round-trip through login/signup ────────────────────────────
const KEY = 'lf_pending_action'
const MAX_AGE_MS = 30 * 60 * 1000

export function setPendingAction(action) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...action, ts: Date.now() })) } catch { /* storage unavailable → we just return to the page */ }
}
// Returns (and clears) the stored action only if it matches `match` and is fresh.
export function takePendingAction(match) {
  try {
    const raw = sessionStorage.getItem(KEY); if (!raw) return null
    const a = JSON.parse(raw)
    if (Date.now() - a.ts > MAX_AGE_MS) { sessionStorage.removeItem(KEY); return null }
    if (Object.entries(match).some(([k, v]) => a[k] !== v)) return null
    sessionStorage.removeItem(KEY)
    return a
  } catch { return null }
}
export const clearPendingAction = () => { try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } }

// ── intended destination across the multi-step signup (survives refreshes and the Google round-trip) ──────────────────
const NEXT_KEY = 'lf_auth_next'
export const rememberNext = (next) => { try { sessionStorage.setItem(NEXT_KEY, safeNext(next)) } catch { /* ignore */ } }
export const peekNext = () => { try { return safeNext(sessionStorage.getItem(NEXT_KEY) || '/') } catch { return '/' } }
export const consumeNext = () => { const n = peekNext(); try { sessionStorage.removeItem(NEXT_KEY) } catch { /* ignore */ } return n }

// Where to send someone who has just authenticated: unfinished onboarding first, otherwise their intended page.
export function destinationAfterAuth(user, next) {
  if (user && user.onboardingCompleted === false) { rememberNext(next); return '/welcome' }
  return safeNext(next)
}
