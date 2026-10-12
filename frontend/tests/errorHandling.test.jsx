// @vitest-environment jsdom
// Frontend error handling: the REAL services/api.js interceptors, apiError normaliser, AuthContext, ErrorBoundary, ConnectionBanner and
// useApiData run against a fake axios adapter (no network, no server). Same conventions as the other tests in this folder.
import React, { useState } from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './_support/adapterSwitch.js' // must come before anything that imports services/api.js
import { setOverride } from './_support/adapterSwitch.js'
import axios from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { backend, mountApp, live, settle, signInAs, act, tick } from './_support/mountApp.jsx'

const { api } = await import('../src/services/api.js')
const { MESSAGES, normalizeApiError, userMessage, ApiError } = await import('../src/services/apiError.js')
const { reportReachable, getConnectivity } = await import('../src/services/connectivity.js')
const { peekSessionExpired, clearSessionExpired } = await import('../src/services/session.js')
const { ErrorBoundary, RouteErrorBoundary } = await import('../src/components/ErrorBoundary.jsx')
const { default: ErrorState } = await import('../src/components/ErrorState.jsx')
const { default: ConnectionBanner } = await import('../src/components/ConnectionBanner.jsx')
const { useApiData } = await import('../src/hooks/useApiData.js')
const { default: AuthPage } = await import('../src/features/auth/AuthPage.jsx')
const { AuthProvider } = await import('../src/context/AuthContext.jsx')

// ── fake transport: delegate to the shared fake backend unless a test installs an override ──
let _o = null
const set = (fn) => { _o = fn; setOverride(fn) }
const seen = []
const http = (status, data, headers = {}) => (config) => { seen.push(config); return Promise.reject(new axios.AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, { data, status, statusText: 'x', headers, config })) }
const net = (code = 'ERR_NETWORK', message = 'Network Error') => (config) => { seen.push(config); return Promise.reject(new axios.AxiosError(message, code, config, {})) }
const ok = (data = { ok: true }) => (config) => { seen.push(config); return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config }) }
const fail = async (fn) => { try { await fn(); return null } catch (e) { return e } }

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); backend.reset(); set(null); seen.length = 0; reportReachable() })
afterEach(() => { cleanup(); set(null) })

const TECH = /localhost|Network Error|status code|mongodb|mongoose|E11000|ECONN|stack|node_modules|TypeError|<html|<!DOCTYPE|at Object|\/home\//i

describe('api errors: every failure becomes a safe, specific message', () => {
  it('network failure / connection refused: friendly text, no API address, no Axios wording; GET is retryable, POST is not', async () => {
    set(net())
    const g = await fail(() => api.get('/api/shops')), p = await fail(() => api.post('/api/seller/sales', {}))
    expect(g instanceof ApiError).toBe(true); expect(g.kind).toBe('network'); expect(g.message).toBe(MESSAGES.network); expect(g.message).not.toMatch(TECH)
    expect(g.retryable).toBe(true); expect(p.retryable).toBe(false)
  })
  it('offline browser: "You appear to be offline"', async () => {
    set(net()); const orig = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try { const e = await fail(() => api.get('/api/shops')); expect(e.kind).toBe('offline'); expect(e.message).toBe(MESSAGES.offline) }
    finally { orig ? Object.defineProperty(navigator, 'onLine', orig) : delete navigator.onLine }
  })
  it('timeout: requests carry a timeout, and a timed-out request becomes "took too long" (retryable only when it is a GET)', async () => {
    set(net('ECONNABORTED', 'timeout of 30000ms exceeded'))
    const g = await fail(() => api.get('/api/shops')), p = await fail(() => api.put('/api/seller/products/1', {}))
    expect(seen[0].timeout).toBe(30000)
    expect(g.kind).toBe('timeout'); expect(g.message).toBe(MESSAGES.timeout); expect(g.message).not.toMatch(/30000|exceeded/)
    expect(g.retryable).toBe(true); expect(p.retryable).toBe(false)
  })
  it('HTML error page from a proxy (502/503/504) is never shown; wording comes from the status', async () => {
    for (const [status, kind] of [[502, 'unavailable'], [503, 'unavailable'], [504, 'timeout']]) {
      set(http(status, '<!DOCTYPE html><html><body><h1>Bad Gateway</h1>nginx/1.2</body></html>'))
      const e = await fail(() => api.get('/api/shops')); expect(e.kind).toBe(kind); expect(e.message).not.toMatch(TECH); expect(e.message).not.toContain('nginx'); expect(e.data).toBe(null)
    }
  })
  it('unexpected 500: generic message even if the backend body carries a stack / driver text', async () => {
    set(http(500, { message: 'MongoServerError: E11000 at Object.<anonymous> (/home/app/server.js:10)', stack: 'Error: boom\n    at x (/home/app/y.js:1:1)' }))
    const e = await fail(() => api.get('/api/x')); expect(e.kind).toBe('server'); expect(e.message).toBe(MESSAGES.server); expect(e.message).not.toMatch(TECH)
  })
  it('database unavailable (503 DATABASE_UNAVAILABLE) is distinguished from a generic outage', async () => {
    set(http(503, { message: 'We are having trouble reaching our database. Please try again in a moment.', code: 'DATABASE_UNAVAILABLE', retryAfter: 5 }))
    const e = await fail(() => api.get('/api/x')); expect(e.kind).toBe('unavailable'); expect(e.message).toBe(MESSAGES.database); expect(e.retryAfter).toBe(5)
  })
  it('validation: field-specific messages are preserved when safe, unsafe ones are dropped; message stays useful', async () => {
    set(http(400, { message: 'Email is not valid. Name is required.', code: 'VALIDATION_ERROR', errors: { email: 'Email is not valid.', name: 'Name is required.', hack: 'E11000 duplicate key mongodb://u:p@h' } }))
    const e = await fail(() => api.post('/api/auth/register', {}))
    expect(e.kind).toBe('validation'); expect(e.status).toBe(400); expect(e.message).toBe('Email is not valid. Name is required.')
    expect(e.fieldErrors).toEqual({ email: 'Email is not valid.', name: 'Name is required.' }); expect(e.data.code).toBe('VALIDATION_ERROR')
  })
  it('authored backend messages for 4xx are kept: forbidden, not found, duplicate, out-of-stock style', async () => {
    set(http(403, { message: 'Only the owner of this shop can access this.' })); expect((await fail(() => api.get('/x'))).message).toBe('Only the owner of this shop can access this.')
    set(http(404, { message: 'No account with that username.' })); expect((await fail(() => api.get('/x'))).message).toBe('No account with that username.')
    set(http(409, { message: 'That username is already taken.', code: 'DUPLICATE_RECORD', errors: { username: 'That username is already taken.' } }))
    const d = await fail(() => api.post('/x', {})); expect(d.kind).toBe('conflict'); expect(d.message).toBe('That username is already taken.'); expect(d.fieldErrors.username).toBe('That username is already taken.')
    set(http(409, { code: 'DUPLICATE_RECORD' })); expect((await fail(() => api.post('/x', {}))).message).toBe(MESSAGES.duplicate)
    set(http(403, {})); expect((await fail(() => api.get('/x'))).message).toBe(MESSAGES.forbidden)
    set(http(404, '<html>Not Found</html>')); expect((await fail(() => api.get('/x'))).message).toBe(MESSAGES.notFound)
  })
  it('unsafe 4xx text (driver wording, paths, URLs) falls back to the standard message instead of being shown', async () => {
    set(http(400, { message: 'Cast to ObjectId failed for value "abc" at path "_id" for model "Shop"' }))
    const e = await fail(() => api.get('/x')); expect(e.message).toBe(MESSAGES.client); expect(e.message).not.toMatch(TECH)
  })
  it('rate limit: tells the user how long to wait (Retry-After header or body) and marks the GET retryable', async () => {
    set(http(429, { message: '', code: 'RATE_LIMITED' }, { 'retry-after': '12' }))
    const e = await fail(() => api.get('/x')); expect(e.kind).toBe('rateLimited'); expect(e.retryAfter).toBe(12); expect(e.message).toBe('Too many requests. Please wait 12 seconds and try again.')
    set(http(429, { message: 'Too many requests. Please slow down and try again shortly.', retryAfter: 3 })); expect((await fail(() => api.post('/x', {}))).retryable).toBe(false)
  })
  it('a 401 on a login attempt keeps the backend wording; it is not mislabelled "session expired"', async () => {
    set(http(401, { message: 'That password is not correct.' })); const e = await fail(() => api.post('/api/auth/login', {}))
    expect(e.kind).toBe('unauthorized'); expect(e.message).toBe('That password is not correct.')
  })
  it('non-API JavaScript errors never leak through userMessage(); canceled requests produce no message', () => {
    expect(userMessage(new TypeError("Cannot read properties of undefined (reading 'x')"), 'Could not read that file.')).toBe('Could not read that file.')
    expect(userMessage(Object.assign(new Error('cancelled'), { canceled: true }))).toBe('')
    expect(userMessage(normalizeApiError({ response: { status: 404, data: {} }, config: {} }))).toBe(MESSAGES.notFound)
  })
})

describe('sessions and connectivity', () => {
  it('expired session: the 401 ends the session ONCE (no request loop), says why, and the login page shows the notice', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30)
    expect(live.auth.isAuthenticated).toBe(true)
    const tok = backend.log.find((l) => l.url === '/api/auth/me').auth; backend.revoke(tok)
    const before = backend.log.length; let err
    await act(async () => { err = await fail(() => live.auth.refreshUser()); await tick(40) })
    expect(err.kind).toBe('unauthorized'); expect(err.message).toBe(MESSAGES.sessionExpired)
    expect(live.auth.isAuthenticated).toBe(false); expect(localStorage.getItem('lf_token')).toBe(null)
    expect(backend.log.slice(before).filter((l) => l.url === '/api/auth/me').length).toBe(1) // exactly one call: no redirect / retry loop
    expect(peekSessionExpired()).toBe(true)
    cleanup()
    const login = render(<MemoryRouter initialEntries={['/login']}><AuthProvider><AuthPage mode="login" /></AuthProvider></MemoryRouter>)
    await act(async () => { await tick(20) })
    expect(login.container.textContent).toContain(MESSAGES.sessionExpired)
    await act(async () => { await tick(5) }); expect(peekSessionExpired()).toBe(false) // shown once, then forgotten
  })
  it('an ordinary network failure does NOT log the user out and keeps their token', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30)
    set(net()); let err
    await act(async () => { err = await fail(() => live.auth.refreshUser()); await tick(20) })
    expect(err.kind).toBe('network'); expect(live.auth.isAuthenticated).toBe(true); expect(!!localStorage.getItem('lf_token')).toBe(true); expect(peekSessionExpired()).toBe(false)
  })
  it('a database outage (503 on the profile check) does NOT log the user out either', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30)
    set(http(503, { message: 'x', code: 'DATABASE_UNAVAILABLE' }))
    await act(async () => { await fail(() => live.auth.refreshUser()); await tick(20) })
    expect(live.auth.isAuthenticated).toBe(true); expect(!!localStorage.getItem('lf_token')).toBe(true)
  })
  it('ConnectionBanner: many failed requests show ONE notice; it clears when the server answers again', async () => {
    const v = render(<ConnectionBanner />); set(net())
    await act(async () => { await Promise.all([1, 2, 3, 4, 5].map(() => fail(() => api.get('/api/shops')))); await tick(5) })
    expect(v.container.querySelectorAll('[role="status"]').length).toBe(1); expect(v.container.textContent).toContain("can't reach the server"); expect(getConnectivity().down).toBe(true)
    set(ok()); await act(async () => { await api.get('/api/shops'); await tick(5) })
    expect(v.container.querySelectorAll('[role="status"]').length).toBe(0)
  })
  it('a specific refusal (404 / 403 / "uploads not configured" 503) does not raise the global "server unreachable" notice', async () => {
    const v = render(<ConnectionBanner />)
    for (const spec of [http(404, { message: 'nope' }), http(403, {}), http(503, { message: 'Photo uploads are not configured yet. You can add a photo later.' })]) {
      set(spec); await act(async () => { await fail(() => api.get('/x')); await tick(2) })
      expect(v.container.querySelectorAll('[role="status"]').length).toBe(0)
    }
  })
})

describe('React: crashes, loading, failure and recovery', () => {
  const quiet = async (fn) => { const o = console.error; console.error = () => {}; try { await fn() } finally { console.error = o } }
  it('a component that crashes while rendering shows a friendly fallback with recovery actions — never the exception text', async () => {
    let explode = true
    const Bomb = () => { if (explode) throw new Error('SECRET internal failure at /home/app/src/Bomb.jsx mongodb://u:p@h'); return <p>recovered content</p> }
    await quiet(async () => {
      const v = render(<MemoryRouter><ErrorBoundary><Bomb /></ErrorBoundary></MemoryRouter>)
      const text = v.container.textContent
      expect(text).toContain('Something went wrong'); expect(text).toContain('Try again'); expect(text).toContain('Back to Home'); expect(text).toContain('Reload page')
      expect(text).not.toContain('SECRET'); expect(text).not.toMatch(TECH)
      expect(v.container.querySelector('a[href="/"]')).toBeTruthy()
      explode = false; fireEvent.click(v.getByText('Try again')); expect(v.container.textContent).toContain('recovered content') // "Try again" re-renders once the cause is gone
    })
  })
  it('section-level boundary: a crashing page leaves the surrounding layout (header, footer) intact', async () => {
    const Bad = () => { throw new Error('page crash') }
    const App = ({ at }) => <MemoryRouter initialEntries={[at]}><header>NAVBAR</header><RouteErrorBoundary>{at === '/bad' ? <Bad /> : <p>fine page</p>}</RouteErrorBoundary><footer>FOOTER</footer></MemoryRouter>
    await quiet(async () => {
      const v = render(<App at="/bad" />); expect(v.container.textContent).toContain('NAVBAR'); expect(v.container.textContent).toContain('FOOTER'); expect(v.container.textContent).toContain('Something went wrong')
    })
  })
  it('loading state is cleared when a request fails; "Try again" appears for a GET and works', async () => {
    const Demo = () => { const s = useApiData(() => api.get('/api/shops'), []); if (s.loading) return <p>loading…</p>; if (s.error) return <ErrorState error={s.error} onRetry={s.retry} />; return <p>shops loaded</p> }
    set(net())
    const v = render(<Demo />); expect(v.container.textContent).toContain('loading…')
    await act(async () => { await tick(20) })
    expect(v.container.textContent).not.toContain('loading…'); expect(v.container.textContent).toContain(MESSAGES.network); expect(v.container.textContent).toContain('Try again')
    set(ok({ shops: [] })); await act(async () => { fireEvent.click(v.getByText('Try again')); await tick(20) })
    expect(v.container.textContent).toContain('shops loaded')
  })
  it('a failed form submit re-enables the button, shows a safe message, and offers no blind "retry" for a write', async () => {
    const Form = () => {
      const [busy, setBusy] = useState(false); const [e, setE] = useState(null)
      const submit = async () => { setBusy(true); setE(null); try { await api.post('/api/seller/sales', {}) } catch (x) { setE(x) } finally { setBusy(false) } }
      return <><button type="button" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>{e && <ErrorState error={e} onRetry={submit} />}</>
    }
    set(net()); const v = render(<Form />)
    await act(async () => { fireEvent.click(v.getByText('Save')); await tick(20) })
    const btn = v.container.querySelector('button'); expect(btn.disabled).toBe(false); expect(btn.textContent).toBe('Save')
    expect(v.container.textContent).toContain(MESSAGES.network); expect(v.container.textContent).not.toContain('Try again') // a failed write is not replayed automatically or by a one-click retry
  })
  it('production UI: nothing technical (stack, driver text, API address, HTML) can reach the screen from any failure', async () => {
    const bodies = [
      [500, { message: 'MongooseError: buffering timed out', stack: 'Error\n    at a (/home/app/a.js:1:1)' }], [500, '<html><pre>Error: ENOENT /var/app/x</pre></html>'],
      [503, '<html>upstream connect error</html>'], [400, { message: 'E11000 duplicate key mongodb://admin:pw@cluster0.x.mongodb.net' }], [418, { message: 'TypeError: x is not a function at /src/a.js' }],
    ]
    for (const [status, body] of bodies) {
      set(http(status, body)); const e = await fail(() => api.get('/x'))
      const v = render(<ErrorState error={e} onRetry={() => {}} />)
      expect(v.container.textContent).not.toMatch(TECH); expect(v.container.textContent).not.toContain('admin'); v.unmount()
    }
    set(net()); const n = await fail(() => api.get('/x')); const v2 = render(<ErrorState error={n} />); expect(v2.container.textContent).not.toMatch(TECH)
  })
})
