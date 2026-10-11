// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import { backend, mountApp, live, settle, signInAs, press, act } from './_support/mountApp.jsx'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); backend.reset() })
afterEach(() => cleanup())
const loc = () => live.loc.pathname + live.loc.search

describe('left Loco logo → application menu', () => {
  it('opens a menu (does not navigate), and it is not the account menu', async () => {
    const v = await mountApp('/faq'); press(v.getByLabelText('Loco menu', { selector: 'button' }))
    expect(v.getByRole('menu', { name: 'Loco menu' })).toBeTruthy(); expect(v.queryByRole('menu', { name: /Account menu|Login or sign up/ })).toBeNull(); expect(loc()).toBe('/faq')
  })
  it('guest sees Home · Log in · Sign up · Start your business · Help & Support and no Log out', async () => {
    const v = await mountApp('/'); press(v.getByLabelText('Loco menu', { selector: 'button' })); const menu = v.getByRole('menu', { name: 'Loco menu' }), t = menu.textContent
    for (const x of ['Home', 'Log in', 'Sign up', 'Start your business', 'Help & Support']) expect(t).toContain(x)
    expect(t).not.toContain('Log out')
  })
  it('signed-in user sees Home · Switch account · Start your business · Help · Log out (no Log in / Sign up)', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); live.nav('/'); await settle()
    press(v.getByLabelText('Loco menu', { selector: 'button' })); const t = v.getByRole('menu', { name: 'Loco menu' }).textContent
    for (const x of ['Home', 'Switch account', 'Start your business', 'Help & Support', 'Log out']) expect(t).toContain(x)
    expect(t).not.toContain('Log in'); expect(t).not.toContain('Sign up')
  })
  it('a business owner is not offered "Start your business"', async () => {
    const v = await mountApp('/'); await signInAs(v, 'sana@test.com', 'pw-S'); live.nav('/'); await settle()
    press(v.getByLabelText('Loco menu', { selector: 'button' })); expect(v.getByRole('menu', { name: 'Loco menu' }).textContent).not.toContain('Start your business')
  })
  it('menu items navigate and close the menu', async () => {
    const v = await mountApp('/'); press(v.getByLabelText('Loco menu', { selector: 'button' })); press(v.getByText('Help & Support'))
    await settle(); expect(loc()).toBe('/faq'); expect(v.queryByRole('menu')).toBeNull()
  })
  it('closes on Escape and on an outside press', async () => {
    const v = await mountApp('/'); const btn = v.getByLabelText('Loco menu', { selector: 'button' })
    press(btn); expect(v.queryByRole('menu')).toBeTruthy(); fireEvent.keyDown(document, { key: 'Escape' }); expect(v.queryByRole('menu')).toBeNull()
    press(btn); expect(v.queryByRole('menu')).toBeTruthy(); fireEvent.mouseDown(document.body); expect(v.queryByRole('menu')).toBeNull()
  })
  it('Log out in the menu ends the session on the server and in the browser', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); const tok = backend.log.find((l) => l.url === '/api/auth/me').auth; live.nav('/'); await settle()
    press(v.getByLabelText('Loco menu', { selector: 'button' })); press(v.getByText('Log out')); await settle(30)
    expect(live.auth.user).toBeNull(); expect(localStorage.getItem('lf_token')).toBeNull(); expect(backend.revoked.has(tok)).toBe(true)
  })
})

describe('right avatar → personal account menu', () => {
  it('opens the personal menu (not the application menu)', async () => {
    const v = await mountApp('/'); press(v.getByLabelText('Login or sign up'))
    expect(v.getByRole('menu', { name: 'Login or sign up' })).toBeTruthy(); expect(v.queryByRole('menu', { name: 'Loco menu' })).toBeNull()
  })
  it('guest: Log in and Sign up only', async () => {
    const v = await mountApp('/'); press(v.getByLabelText('Login or sign up')); const t = v.getByRole('menu').textContent
    expect(t).toContain('Log in'); expect(t).toContain('Sign up'); for (const x of ['Profile', 'Edit profile', 'Log out']) expect(t).not.toContain(x)
  })
  it('signed in: shows the REAL name, username and profile picture; Profile · Edit profile · Account settings · Log out; no business or fake items', async () => {
    const v = await mountApp('/'); await signInAs(v, 'bilal@test.com', 'pw-B'); live.nav('/'); await settle()
    press(v.getByLabelText('Account menu', { selector: 'button' })); const menu = v.getByRole('menu', { name: 'Account menu' }), t = menu.textContent
    expect(t).toContain('Bilal Bose'); expect(t).toContain('@bilal482'); expect(menu.querySelector('img').getAttribute('src')).toBe('https://img.test/b.png')
    for (const x of ['Profile', 'Edit profile', 'Account settings', 'Log out']) expect(t).toContain(x)
    for (const x of ['Products', 'Inventory', 'Billing', 'Login & security', 'Privacy']) expect(t).not.toContain(x)
  })
  it('Edit profile opens the existing editor; Account settings opens Settings; Profile (no business) opens the personal overview', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); live.nav('/'); await settle()
    press(v.getByLabelText('Account menu', { selector: 'button' })); press(v.getByText('Edit profile')); await settle(); expect(loc()).toBe('/settings?edit=1')
    press(v.getByLabelText('Account menu', { selector: 'button' })); press(v.getByText('Account settings')); await settle(); expect(loc()).toBe('/settings')
    press(v.getByLabelText('Account menu', { selector: 'button' })); press(v.getByText('Profile')); await settle(); expect(loc()).toBe('/activity')
  })
  it('a business owner\'s Profile opens their own profile page', async () => {
    const v = await mountApp('/'); await signInAs(v, 'sana@test.com', 'pw-S'); live.nav('/'); await settle()
    press(v.getByLabelText('Account menu', { selector: 'button' })); press(v.getByText('Profile')); await settle(); expect(loc()).toBe('/@sana238')
  })
  it('updates immediately when the account changes (no previous name left behind)', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); live.nav('/'); await settle()
    press(v.getByLabelText('Account menu', { selector: 'button' })); expect(v.getByRole('menu').textContent).toContain('Alice Anand')
    press(v.getByText('Log out')); await settle(30); await signInAs(v, 'bilal@test.com', 'pw-B'); live.nav('/'); await settle()
    press(v.getByLabelText('Account menu', { selector: 'button' })); const t = v.getByRole('menu').textContent; expect(t).toContain('Bilal Bose'); expect(t).not.toContain('Alice')
  })
  it('closes on Escape and outside press, and opening one menu closes the other', async () => {
    const v = await mountApp('/'); const logo = v.getByLabelText('Loco menu', { selector: 'button' }), avatar = v.getByLabelText('Login or sign up')
    press(avatar); fireEvent.keyDown(document, { key: 'Escape' }); expect(v.queryByRole('menu')).toBeNull()
    press(logo); press(avatar); expect(v.getAllByRole('menu')).toHaveLength(1); expect(v.getByRole('menu').getAttribute('aria-label')).toBe('Login or sign up')
  })
})

describe('Analytics follows the account', () => {
  const analytics = (v) => press(v.getByText('Analytics', { selector: 'button *, button' }))
  it('business owner → the existing merchant dashboard', async () => {
    const v = await mountApp('/'); await signInAs(v, 'sana@test.com', 'pw-S'); live.nav('/'); await settle(); analytics(v); await settle(); expect(loc()).toBe('/@sana238/dashboard')
  })
  it('study-centre owner → also their business dashboard', async () => {
    const v = await mountApp('/'); await signInAs(v, 'study@test.com', 'pw-S2'); live.nav('/'); await settle(); analytics(v); await settle(); expect(loc()).toBe('/@study238/dashboard')
  })
  it('normal user without a business → personal activity (never a business page)', async () => {
    const v = await mountApp('/'); await signInAs(v, 'alice@test.com', 'pw-A'); live.nav('/'); await settle(); analytics(v); await settle(); expect(loc()).toBe('/activity'); expect(v.container.textContent).toContain('Personal overview')
  })
  it('guest → login first, then the personal activity page', async () => {
    const v = await mountApp('/'); analytics(v); await settle(); expect(loc()).toBe('/login?next=%2Factivity')
  })
  it('switching from a merchant to a normal user changes what Analytics opens', async () => {
    const v = await mountApp('/'); await signInAs(v, 'sana@test.com', 'pw-S'); live.nav('/'); await settle(); analytics(v); await settle(); expect(loc()).toBe('/@sana238/dashboard')
    live.auth.logout(); await settle(30); await signInAs(v, 'alice@test.com', 'pw-A'); live.nav('/'); await settle(); analytics(v); await settle(); expect(loc()).toBe('/activity')
  })
})
