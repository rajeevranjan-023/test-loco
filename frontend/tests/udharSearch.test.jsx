// @vitest-environment jsdom
// Udhar page — Universal Customer Search. The REAL UdharPage, CustomerSearch, EntryModal and api.js run against a scripted fake transport.
// Runs under real vitest and under the sandbox runner:  node --import ./tests/_harness/register.mjs tests/_harness/run.mjs tests/udharSearch.test.jsx
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './_support/adapterSwitch.js'
import { setOverride } from './_support/adapterSwitch.js'
import { MemoryRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'

const { default: UdharPage } = await import('../src/features/analytics/pages/UdharPage.jsx')
const { BusinessProvider, SHOP_BUSINESS } = await import('../src/context/BusinessContext.jsx')
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const settle = (ms = 30) => act(async () => { await tick(ms) })
Element.prototype.scrollIntoView = () => {}

const CUST = [
  { source: 'local', id: 'c-asha', name: 'Asha Verma', phone: '9876500001', udharDue: 200, credit: 0 },
  { source: 'local', id: 'c-ravi', name: 'Ravi Kumar', phone: '9876500002', udharDue: 0, credit: 0 }, // has never had an udhar entry
  { source: 'local', id: 'c-rajesh', name: 'Rajesh', phone: '9111100003', udharDue: 0, credit: 75 },
]
const GLOBAL = { source: 'global', globalUserId: 'g-meena', name: 'Meena', phone: '9000000001', exact: true }
const overview = { range: {}, kpis: { pending: { amount: 200, customers: 1 }, recovered: { amount: 0 }, advance: { amount: 0, customers: 0 }, totalCustomers: 1, overdue: { amount: 0, customers: 0 } }, trend: [], pinned: [], pending: [], advance: [], cleared: [] }

let log, hold, fail, searchImpl
const transport = (config) => {
  const url = String(config.url).replace(/^https?:\/\/[^/]+/, ''), method = config.method.toUpperCase(), body = config.data ? JSON.parse(config.data) : null
  log.push({ method, url, body })
  const ok = (data, status = 200) => Promise.resolve({ data, status, statusText: 'OK', headers: {}, config })
  const bad = (status, message) => Promise.reject(new (class extends Error { constructor() { super(message); this.isAxiosError = true; this.config = config; this.response = { status, data: { message }, headers: {}, statusText: 'x', config } } })())
  if (url.startsWith('/api/seller/udhar/overview')) return ok(overview)
  if (url.startsWith('/api/customers/search')) return searchImpl(decodeURIComponent(url.split('q=')[1]), ok, bad)
  if (method === 'POST' && url === '/api/seller/billing/customers/select') return ok({ source: 'local', id: 'c-meena', name: body.name, phone: body.phone, udharDue: 0, credit: 0 }, 201)
  if (method === 'POST' && url === '/api/seller/udhar/entries') return ok({ row: { id: body.customerId || 'c-new1', name: body.name || 'x', total: body.amount }, entries: [{ type: body.type, amount: body.amount }] }, 201)
  return ok([])
}
const defaultSearch = (q, ok) => { const d = q.replace(/\D/g, ''); const own = CUST.filter((c) => (/^[\d\s+-]+$/.test(q) ? c.phone.includes(d) : c.name.toLowerCase().includes(q.toLowerCase()))); return ok(d === '9000000001' ? [GLOBAL] : own) }

beforeEach(() => { log = []; hold = null; fail = null; searchImpl = defaultSearch; setOverride(transport) })
afterEach(() => { cleanup(); setOverride(null) })

const Where = () => <div data-testid="where">{useLocation().pathname}</div>
async function mount(business) {
  const ctx = { urange: { from: '2026-01-01', to: '2026-12-31' }, setUrange() {}, reloadSummary() {} }
  render(<MemoryRouter initialEntries={['/raj236/udhar']}><BusinessProvider business={business}><Routes><Route path="/:username" element={<Outlet context={ctx} />}><Route path="udhar" element={<UdharPage />} /><Route path="customer/:id" element={<Where />} /></Route></Routes></BusinessProvider></MemoryRouter>)
  await settle(40)
}
const box = (label = 'Search customer') => screen.getByLabelText(label)
const submitBtn = () => document.querySelector('form button[type="submit"]') // the Add-Udhar form's own submit button
const options = () => within(screen.getByRole('listbox')).getAllByRole('option') // (the page's <select>s have <option>s too — look only inside the dropdown)
const type = async (v, wait = 220) => { fireEvent.change(box(), { target: { value: v } }); await settle(wait) }
const searches = () => log.filter((l) => l.url.startsWith('/api/customers/search'))
const opt = (re) => options().find((o) => re.test(o.textContent))

describe('Udhar universal customer search', () => {
  it('sits at the top of the Udhar section; the dropdown opens at 2 letters or 3 digits, not before', async () => {
    await mount()
    expect(box()).toBeTruthy()
    await type('a'); expect(screen.queryByRole('listbox')).toBeNull(); expect(searches().length).toBe(0)
    await type('as'); expect(screen.getByRole('listbox')).toBeTruthy(); expect(searches().length).toBe(1)
    await type('98'); expect(screen.queryByRole('listbox')).toBeNull()
    await type('987'); expect(screen.getByRole('listbox')).toBeTruthy()
  })
  it('search by NAME shows the match with its balance; choosing it opens that customer’s existing account page', async () => {
    await mount()
    await type('asha')
    expect(opt(/Asha Verma/).textContent).toContain('9876500001'); expect(opt(/Asha Verma/).textContent).toContain('₹200')
    fireEvent.click(opt(/Asha Verma/)); await settle()
    expect(screen.getByTestId('where').textContent).toBe('/@raj236/customer/c-asha')
    expect(log.filter((l) => l.method === 'POST').length).toBe(0) // opening an account creates nothing
  })
  it('search by MOBILE NUMBER finds the customer (partial and full) and opens the right account', async () => {
    await mount()
    await type('98765'); expect(options().length).toBe(2)
    await type('9111100003'); expect(options().length).toBe(1)
    fireEvent.click(opt(/Rajesh/)); await settle()
    expect(screen.getByTestId('where').textContent).toBe('/@raj236/customer/c-rajesh')
  })
  it('finds a customer who has NO udhar entry with this shop and opens their account', async () => {
    await mount()
    await type('ravi'); expect(opt(/Ravi Kumar/).textContent).toContain('No udhar due')
    fireEvent.click(opt(/Ravi Kumar/)); await settle()
    expect(screen.getByTestId('where').textContent).toBe('/@raj236/customer/c-ravi')
  })
  it('keyboard: ↓ then Enter opens the highlighted customer; Esc closes', async () => {
    await mount(); await type('ra')
    fireEvent.keyDown(box(), { key: 'ArrowDown' }); fireEvent.keyDown(box(), { key: 'ArrowDown' }); fireEvent.keyDown(box(), { key: 'Enter' }); await settle()
    expect(screen.getByTestId('where').textContent).toMatch(/^\/@raj236\/customer\/c-/)
    cleanup(); await mount(); await type('ra'); fireEvent.keyDown(box(), { key: 'Escape' }); await settle(); expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows a loading state, and neither "No customer found" nor the create option while the search is running', async () => {
    let release; searchImpl = (q, ok) => new Promise((r) => { release = () => r(ok([])) })
    await mount(); await type('zorro', 200)
    expect(screen.getByText('Searching…')).toBeTruthy(); expect(screen.queryByText('No customer found')).toBeNull(); expect(screen.queryByRole('button', { name: /Add Customer & Udhar/ })).toBeNull()
    await act(async () => { release(); await tick(10) })
    expect(screen.getByText('No customer found')).toBeTruthy(); expect(screen.getByRole('button', { name: /Add Customer & Udhar/ })).toBeTruthy(); expect(screen.queryByText('Searching…')).toBeNull()
  })
  it('an API error is NOT an empty result: error + Retry, no "No customer found", no create option; Retry works', async () => {
    let n = 0; searchImpl = (q, ok, bad) => (n++ === 0 ? bad(500, 'boom') : ok(CUST.slice(0, 1)))
    await mount(); await type('asha')
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t complete the search'); expect(screen.queryByText('No customer found')).toBeNull(); expect(screen.queryByRole('button', { name: /Add Customer & Udhar/ })).toBeNull()
    fireEvent.click(screen.getByText('Retry')); await settle(250)
    expect(opt(/Asha Verma/)).toBeTruthy(); expect(screen.queryByRole('alert')).toBeNull()
  })
  it('an outdated slow answer can never replace the newest results', async () => {
    const waiting = {}; searchImpl = (q, ok) => (q === 'ra' ? new Promise((r) => { waiting.ra = () => r(ok([CUST[2]])) }) : ok([CUST[1]]))
    await mount(); await type('ra', 200); await type('rav', 220)
    expect(opt(/Ravi Kumar/)).toBeTruthy()
    await act(async () => { waiting.ra(); await tick(20) }) // the old "ra" answer arrives last
    expect(options().length).toBe(1); expect(opt(/Ravi Kumar/)).toBeTruthy(); expect(screen.queryByText(/Rajesh/)).toBeNull()
  })
  it('fast typing sends one request, and a repeated query is served from the cache', async () => {
    await mount()
    for (const v of ['as', 'ash', 'asha']) fireEvent.change(box(), { target: { value: v } })
    await settle(250); expect(searches().length).toBe(1)
    await type('ravi'); await type('asha', 20); expect(searches().length).toBe(2)
  })

  it('a customer known globally but not linked to this shop: "Add to my customers" uses the existing link endpoint, then opens the account — no duplicate', async () => {
    await mount(); await type('9000000001', 30)
    expect(opt(/Meena/).textContent).toContain('Add to my customers')
    fireEvent.click(opt(/Meena/)); await settle()
    const post = log.find((l) => l.method === 'POST')
    expect(post.url).toBe('/api/seller/billing/customers/select'); expect(post.body).toEqual({ globalUserId: 'g-meena', name: 'Meena', phone: '9000000001' })
    expect(log.filter((l) => l.method === 'POST').length).toBe(1)
    expect(screen.getByTestId('where').textContent).toBe('/@raj236/customer/c-meena')
  })
  it('a link refused by the server (name clash) shows its message and stays on the page', async () => {
    const orig = transport; setOverride((c) => (String(c.url).includes('/customers/select') ? Promise.reject(Object.assign(new Error('x'), { isAxiosError: true, config: c, response: { status: 409, data: { message: 'You already have a customer named “Meena” with a different number.' }, headers: {}, config: c } })) : orig(c)))
    await mount(); await type('9000000001', 30); fireEvent.click(opt(/Meena/)); await settle()
    expect(screen.getByRole('alert').textContent).toContain('already have a customer named'); expect(screen.queryByTestId('where')).toBeNull()
  })

  it('no match → Add Customer & Udhar opens the existing Add Udhar form with the typed name; saving creates the customer + udhar once and opens their account', async () => {
    await mount(); await type('Zed Zorro')
    fireEvent.click(screen.getByRole('button', { name: /Add Customer & Udhar/ })); await settle()
    expect(screen.getAllByDisplayValue('Zed Zorro').length).toBe(2) // the search box + the form's name field
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '350' } })
    fireEvent.click(submitBtn()); await settle(60)
    const posts = log.filter((l) => l.method === 'POST'); expect(posts.length).toBe(1)
    expect(posts[0].url).toBe('/api/seller/udhar/entries'); expect(posts[0].body).toEqual({ type: 'udhar', amount: 350, paymentType: 'cash', note: '', name: 'Zed Zorro', phone: '' })
    expect(screen.getByTestId('where').textContent).toBe('/@raj236/customer/c-new1')
  })
  it('a number with no match pre-fills the mobile field; the name is still required', async () => {
    await mount(); await type('9333300001')
    fireEvent.click(screen.getByRole('button', { name: /Add Customer & Udhar/ })); await settle()
    expect(screen.getAllByDisplayValue('9333300001').length).toBe(2) // search box + the form's mobile field
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '90' } })
    expect(submitBtn().disabled).toBe(true) // no name yet
    fireEvent.change(screen.getByLabelText(/New customer name/), { target: { value: 'Neha' } }); expect(submitBtn().disabled).toBe(false)
  })
  it('uses the business’s own words (study centre: Member / Dues)', async () => {
    const study = { ...SHOP_BUSINESS, type: 'study_center', terms: { ...SHOP_BUSINESS.terms, Customer: 'Member', customer: 'member', Customers: 'Members', customers: 'members', Udhar: 'Dues', udhar: 'dues' } }
    await mount(study); fireEvent.change(box('Search member'), { target: { value: 'Nobody Here' } }); await settle(250)
    expect(screen.getByText('No member found')).toBeTruthy(); expect(screen.getByRole('button', { name: /Add Member & Dues/ })).toBeTruthy()
  })
})

describe('existing Udhar page behaviour is untouched', () => {
  it('the toolbar “Add Udhar / Payment” still opens the normal form with its own customer picker (no prefilled new customer)', async () => {
    await mount()
    fireEvent.click(screen.getAllByRole('button').find((b) => /Add Udhar \/ Paym/.test(b.textContent))); await settle()
    expect(screen.getByPlaceholderText('Search by name or mobile…')).toBeTruthy()
    expect(screen.queryByDisplayValue('Zed Zorro')).toBeNull()
  })
})
