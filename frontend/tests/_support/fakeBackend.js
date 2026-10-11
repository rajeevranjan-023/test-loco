// An in-memory stand-in for the Loco API, plugged into axios as its adapter (so the REAL api.js, interceptors and AuthContext run).
// Import this BEFORE anything that imports services/api.js.
import axios from 'axios'

export const USERS = {
  A: { id: 'uA', name: 'Alice Anand', username: '@alice236', email: 'alice@test.com', role: 'consumer', sellerType: null, followingCount: 1, avatarUrl: '' },
  B: { id: 'uB', name: 'Bilal Bose', username: '@bilal482', email: 'bilal@test.com', role: 'consumer', sellerType: null, followingCount: 0, avatarUrl: 'https://img.test/b.png' },
  S: { id: 'uS', name: 'Sana Seller', username: '@sana238', email: 'sana@test.com', role: 'seller', sellerType: 'shop', followingCount: 0, avatarUrl: '' },
  S2: { id: 'uS2', name: 'Study Owner', username: '@study238', email: 'study@test.com', role: 'seller', sellerType: 'study_center', followingCount: 0, avatarUrl: '' },
}
const PASSWORDS = { 'alice@test.com': 'pw-A', 'bilal@test.com': 'pw-B', 'sana@test.com': 'pw-S', 'study@test.com': 'pw-S2' }

export function installBackend() {
  const b = {
    log: [], revoked: new Set(), delays: [], counter: 0,
    tokens: {}, // token → user
    requirements: { uA: [{ _id: 'r1', title: 'Need a plumber (Alice)', status: 'open', createdAt: '2026-10-01T10:00:00Z' }], uB: [{ _id: 'r2', title: 'Need a tutor (Bilal)', status: 'closed', createdAt: '2026-10-02T10:00:00Z' }] },
    delay(re, ms) { b.delays.push([re, ms]) },
    issue(userKey) { const tok = `tok-${userKey}-${++b.counter}`; b.tokens[tok] = USERS[userKey]; return tok },
    revoke(tok) { b.revoked.add(tok) },
    reset() { b.log.length = 0; b.revoked.clear(); b.delays.length = 0; b.counter = 0; b.tokens = {} },
  }
  axios.defaults.adapter = (config) => new Promise((resolve, reject) => {
    const url = String(config.url).replace(/^https?:\/\/[^/]+/, ''), method = config.method.toUpperCase()
    const auth = (config.headers?.Authorization || config.headers?.get?.('Authorization') || '').replace('Bearer ', '') || null
    const body = config.data ? JSON.parse(config.data) : {}
    b.log.push({ method, url, auth });
    const ok = (data, status = 200) => resolve({ data, status, statusText: 'OK', headers: {}, config })
    const err = (status, message) => reject(new axios.AxiosError(message, 'ERR_BAD_REQUEST', config, null, { data: { message }, status, statusText: 'x', headers: {}, config }))
    const user = auth && b.tokens[auth] && !b.revoked.has(auth) ? b.tokens[auth] : null
    const run = () => {
      if (method === 'POST' && url === '/api/auth/login') {
        const key = Object.keys(USERS).find((k) => USERS[k].email === body.identifier)
        if (!key || PASSWORDS[body.identifier] !== body.password) return err(401, 'Invalid credentials')
        return ok({ token: b.issue(key), user: USERS[key] })
      }
      if (method === 'GET' && url === '/api/auth/me') return user ? ok({ user }) : err(401, 'Session expired or invalid, please log in again.')
      if (method === 'POST' && url === '/api/auth/logout') { if (!user) return err(401, 'no'); b.revoke(auth); return ok({ ok: true }) }
      if (method === 'GET' && url === '/api/requirements/mine') return user ? ok(b.requirements[user.id] || []) : err(401, 'Not authorized, please log in.')
      if (method === 'GET' && url.startsWith('/api/follow/following/')) return ok([])
      if (method === 'GET' && url === '/api/private') return user ? ok({ owner: user.id, secret: `secret of ${user.name}` }) : err(401, 'Not authorized')
      return err(404, `no fake route ${method} ${url}`)
    }
    const d = (b.delays.find(([re]) => re.test(url)) || [])[1] || 0
    const onAbort = () => { clearTimeout(timer); reject(new axios.CanceledError('canceled', config)) }
    if (config.signal?.aborted) return onAbort()
    config.signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => { config.signal?.removeEventListener('abort', onAbort); run() }, d)
  })
  return b
}
export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
