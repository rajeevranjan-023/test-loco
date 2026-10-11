// @vitest-environment jsdom
// REPRODUCTION of the "switch account → Back → previous account" family of bugs, written against the PUBLIC auth API only
// (AuthProvider · useAuth · api · ViewModeProvider), so the same file can be pointed at the old or the new code:
//     LOCO_SRC=/path/to/other/src node … run.mjs tests/session.repro.test.jsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, act, cleanup } from '@testing-library/react'
import { installBackend, tick, USERS } from './_support/fakeBackend.js'

const backend = installBackend()
const SRC = process.env.LOCO_SRC || new URL('../src', import.meta.url).pathname
const { AuthProvider, useAuth } = await import(`${SRC}/context/AuthContext.jsx`)
const { ViewModeProvider, useViewMode } = await import(`${SRC}/context/ViewModeContext.jsx`)
const { api } = await import(`${SRC}/services/api.js`)

let auth, mode
const Probe = () => { auth = useAuth(); mode = useViewMode(); return <div data-user={auth.user?.id || 'none'}>{auth.user?.name || 'guest'}</div> }
const mount = async () => { const r = render(<AuthProvider><ViewModeProvider><Probe /></ViewModeProvider></AuthProvider>); await act(async () => { await tick(5) }); return r }
const login = async (email, pw) => { await act(async () => { await auth.login(email, pw); await tick(5) }) }
const otherTabSwitches = async (token) => { // what the browser does when ANOTHER tab logs in as someone else
  await act(async () => { const old = localStorage.getItem('lf_token'); if (token) localStorage.setItem('lf_token', token); else localStorage.removeItem('lf_token'); window.dispatchEvent(new StorageEvent('storage', { key: 'lf_token', oldValue: old, newValue: token })); await tick(10) })
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); backend.reset() })
afterEach(() => cleanup())

describe('account switching', () => {
  it('login → logout → login as another user: the new user is the active identity', async () => {
    await mount(); await login('alice@test.com', 'pw-A'); expect(auth.user.id).toBe('uA')
    await act(async () => { auth.logout(); await tick(5) }); expect(auth.user).toBeNull(); expect(localStorage.getItem('lf_token')).toBeNull()
    await login('bilal@test.com', 'pw-B'); expect(auth.user.id).toBe('uB')
  })

  it('REPRO 1 — another tab switches account: this tab must not keep showing the previous account', async () => {
    await mount(); await login('alice@test.com', 'pw-A')
    const tokB = backend.issue('B'); await otherTabSwitches(tokB)
    expect(auth.user?.id).toBe('uB') // old code: still "uA" (and its requests now carry B's token)
  })

  it('REPRO 2 — page restored from the back/forward cache after the account changed: must show the CURRENT account', async () => {
    await mount(); await login('alice@test.com', 'pw-A')
    localStorage.setItem('lf_token', backend.issue('B')) // changed while this page was frozen (no storage event is delivered to a frozen page)
    await act(async () => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); await tick(10) })
    expect(auth.user?.id).toBe('uB')
  })

  it('REPRO 3 — a response that was started as user A must never reach user B', async () => {
    await mount(); await login('alice@test.com', 'pw-A')
    backend.delay(/^\/api\/private$/, 60)
    let outcome = 'pending'
    const p = api.get('/api/private', { requiresAuth: true }).then((d) => { outcome = d.secret }).catch((e) => { outcome = `rejected:${e.canceled ? 'canceled' : e.message}` })
    await tick(10) // the request has really been sent (as Alice) and is waiting for the server
    await act(async () => { auth.logout(); await tick(5) }); await login('bilal@test.com', 'pw-B')
    await act(async () => { await p; await tick(80) })
    expect(outcome).not.toBe('secret of Alice Anand') // old code delivers A's data to whoever is on screen
  })

  it('REPRO 4 — the next account must not inherit the previous account\'s view mode', async () => {
    await mount(); await login('sana@test.com', 'pw-S'); await act(async () => { mode.goAnalytics(); await tick(5) }); expect(mode.viewMode).toBe('seller')
    await act(async () => { auth.logout(); await tick(5) }); await login('study@test.com', 'pw-S2')
    expect(mode.viewMode).toBe('consumer') // old code: 'seller' carried over in memory
  })

  it('REPRO 5 — a session the server no longer accepts must end the login in the UI', async () => {
    await mount(); await login('alice@test.com', 'pw-A'); backend.revoke(localStorage.getItem('lf_token'))
    await act(async () => { await api.get('/api/private', { requiresAuth: true }).catch(() => {}); await tick(10) })
    expect(auth.user).toBeNull() // old code: still "logged in" with a dead token
  })
})
