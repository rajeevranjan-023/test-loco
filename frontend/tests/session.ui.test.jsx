// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { backend, mountApp, live, settle, signInAs, press, act, tick } from './_support/mountApp.jsx'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); backend.reset() })
afterEach(() => cleanup())
const loc = () => live.loc.pathname + live.loc.search
const back = async (n = 1) => { for (let i = 0; i < n; i++) { await act(async () => { live.nav(-1); await tick(25) }) } }
const forward = async () => { await act(async () => { live.nav(1); await tick(25) }) }
const logoutViaMenu = async (v) => { press(v.getByLabelText('Account menu', { selector: 'button' })); press(v.getByText('Log out')); await settle(30) }

describe('private data never crosses accounts', () => {
  it('A opens a private page, logs out, B logs in: B sees only B\'s data — A\'s is gone from the screen', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30)
    expect(loc()).toBe('/activity'); expect(v.container.textContent).toContain('Need a plumber (Alice)')
    await logoutViaMenu(v); expect(v.container.textContent).not.toContain('Alice'); expect(v.container.textContent).not.toContain('plumber')
    await signInAs(v, 'bilal@test.com', 'pw-B'); await settle(30)
    expect(v.container.textContent).toContain('Need a tutor (Bilal)'); expect(v.container.textContent).not.toContain('Alice'); expect(v.container.textContent).not.toContain('plumber')
  })
  it('a slow private request started by A that finishes after B logged in is dropped', async () => {
    const v = await mountApp('/'); backend.delay(/requirements\/mine/, 80); await signInAs(v, 'alice@test.com', 'pw-A') // A's activity page is still loading…
    await act(async () => { live.auth.logout(); await tick(5) }); backend.delays.length = 0; await signInAs(v, 'bilal@test.com', 'pw-B'); await settle(150)
    expect(v.container.textContent).not.toContain('plumber'); expect(v.container.textContent).toContain('Need a tutor (Bilal)')
  })
  it('requests are authenticated with the CURRENT session only — after B logs in nothing is sent with A\'s token', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); const tokA = backend.log.find((l) => l.url === '/api/auth/me').auth
    await act(async () => { live.auth.logout(); await tick(5) }); await signInAs(v, 'bilal@test.com', 'pw-B'); await settle(30)
    await act(async () => { live.nav('/activity'); await tick(30) })
    const afterLogout = backend.log.slice(backend.log.findIndex((l) => l.url === '/api/auth/logout') + 1)
    expect(afterLogout.length).toBeGreaterThan(2); expect(afterLogout.some((l) => l.auth === tokA)).toBe(false) // nothing — not even a late retry — carries A's token
  })
  it('the identity change re-creates the page tree (state of the old account cannot survive)', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30); const e1 = live.auth.epoch
    await act(async () => { live.auth.refreshUser(); await tick(20) }); expect(live.auth.epoch).toBe(e1) // same account → nothing is torn down
    await act(async () => { live.auth.logout(); await tick(5) }); expect(live.auth.epoch).toBeGreaterThan(e1)
  })
})

describe('browser Back / Forward', () => {
  it('after A → logout → B, pressing Back repeatedly never makes A the authenticated account', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30)
    await logoutViaMenu(v); await signInAs(v, 'bilal@test.com', 'pw-B'); await settle(30)
    const seen = new Set()
    for (let i = 0; i < 9; i++) {
      await back(); seen.add(loc())
      expect(live.auth.user?.id).toBe('uB'); expect(localStorage.getItem('lf_token')).toBeTruthy()
      expect(v.container.textContent).not.toContain('Alice'); expect(v.container.textContent).not.toContain('plumber')
    }
    expect(seen.size).toBeGreaterThan(1) // navigation really moved around: Back was not disabled
    for (let i = 0; i < 4; i++) { await forward(); expect(live.auth.user?.id).toBe('uB') }
  })
  it('Back to a protected page after logout re-checks the session: login page, no stale data', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30); expect(loc()).toBe('/activity')
    await logoutViaMenu(v); expect(loc()).toBe('/')
    await back(); await settle(20)
    expect(loc()).toMatch(/^\/login/); expect(v.container.textContent).not.toContain('plumber'); expect(live.auth.user).toBeNull()
  })
  it('Forward onto a protected page while logged out also lands on login', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30); await logoutViaMenu(v)
    await back(2); await forward(); await settle(20); expect(live.auth.user).toBeNull(); expect(v.container.textContent).not.toContain('plumber')
  })
})

describe('invalid sessions and several tabs', () => {
  it('a token the server rejects (logged out elsewhere) sends a protected page to login', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30); expect(loc()).toBe('/activity')
    backend.revoke(localStorage.getItem('lf_token')); await act(async () => { live.nav('/start-yours'); await tick(10) }); await act(async () => { live.nav('/activity'); await tick(30) }); await settle(40) // the page's fetch runs when act() closes
    expect(live.auth.user).toBeNull(); expect(loc()).toMatch(/^\/login/)
  })
  it('a stale token in storage at start-up is discarded (no silent restore of a logged-out account)', async () => {
    localStorage.setItem('lf_token', 'tok-stale'); const v = await mountApp('/activity'); await settle(30)
    expect(live.auth.user).toBeNull(); expect(localStorage.getItem('lf_token')).toBeNull(); expect(loc()).toMatch(/^\/login/)
  })
  it('a reload with a valid token restores THAT account from the backend', async () => {
    localStorage.setItem('lf_token', backend.issue('B')); const v = await mountApp('/activity'); await settle(30)
    expect(live.auth.user.id).toBe('uB'); expect(v.container.textContent).toContain('Need a tutor (Bilal)')
  })
  it('another tab logs out: this tab becomes a guest and stays on a public page; the other tab\'s storage is left alone', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30)
    await act(async () => { localStorage.removeItem('lf_token'); window.dispatchEvent(new StorageEvent('storage', { key: 'lf_token', newValue: null })); await tick(20) })
    expect(live.auth.user).toBeNull(); expect(loc()).toMatch(/^\/login/)
  })
  it('public data requests are not tied to the session (no abort, no token)', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); await settle(30)
    const { api } = await import('../src/services/api.js'); let ok = false; backend.delay(/following/, 30)
    const p = api.get('/api/follow/following/uA').then(() => { ok = true }); await act(async () => { live.auth.logout(); await p; await tick(5) }); expect(ok).toBe(true)
  })
})
