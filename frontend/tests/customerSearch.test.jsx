// @vitest-environment jsdom
// Billing → "Select Customer": shop customers first, then the global-directory suggestion (name only, click to use),
// Enter-key behaviour while a search is still running, stale replies and request economy.
// The REAL BillingPage + api.js run against a fake axios transport (no server, no database).
// Runs under real vitest (`npm test`) and under the sandbox runner:  node --import ./tests/_harness/register.mjs tests/_harness/run.mjs tests/customerSearch.test.jsx
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './_support/adapterSwitch.js' // must come before anything that imports services/api.js
import { setOverride } from './_support/adapterSwitch.js'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

const { default: BillingPage } = await import('../src/features/analytics/pages/BillingPage.jsx')
const { BusinessProvider } = await import('../src/context/BusinessContext.jsx')

Element.prototype.scrollIntoView = () => {}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const settle = (ms = 40) => act(async () => { await tick(ms) })

const PHONE = '9876543210'
const ASHA = { source: 'local', id: 'c1', name: 'Asha', phone: PHONE, udharDue: 0, credit: 0, usageCount: 2 }
const GLOBAL = { source: 'global', globalUserId: 'g1', name: 'Ravi', phone: PHONE, exact: true } // exactly what the API returns: no count, no other names
const SAVED = { source: 'local', id: 'c9', name: 'Ravi', phone: PHONE, usageCount: 5, globalUserId: 'g1', udharDue: 0, credit: 0 }

let searches, posts, searchImpl, selectImpl
const httpError = (config, status, message) => Object.assign(new Error('Request failed'), { isAxiosError: true, config, response: { status, data: { message }, headers: {}, config } })
const transport = (config) => {
  const url = String(config.url).replace(/^https?:\/\/[^/]+/, ''), method = config.method.toUpperCase()
  const ok = (data, status = 200) => Promise.resolve({ data, status, statusText: 'OK', headers: {}, config })
  if (method === 'POST' && url === '/api/seller/billing/customers/select') { const body = JSON.parse(config.data); posts.push({ url, body }); return selectImpl(body, config).then((d) => ok(d, 201)) }
  if (method === 'POST' && url === '/api/seller/billing/customers') { const body = JSON.parse(config.data); posts.push({ url, body }); return ok({ source: 'local', id: 'c10', ...body, usageCount: 0, udharDue: 0, credit: 0 }, 201) }
  if (method !== 'GET') return ok({ ok: true })
  if (url === '/api/seller/billing/config') return ok({ capabilities: { products: true, partialPayment: true, udhar: true, context: [] }, lineTypes: [{ type: 'product', label: 'Product', addLabel: 'Add Product' }], business: { name: 'Test Shop' } })
  if (url === '/api/seller/billing/products') return ok([{ id: 'p1', name: 'Sugar', price: 400, priceUnit: 'unit', stock: 50, topQty: 1 }])
  if (url.startsWith('/api/customers/search')) {
    const q = decodeURIComponent(url.split('q=')[1]); searches.push(q)
    return searchImpl(q).then((r) => ok(r))
  }
  return ok([]) // recent bills · drafts · anything else
}
const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms))

beforeEach(() => {
  searches = []; posts = []
  searchImpl = async () => []
  selectImpl = async () => SAVED
  setOverride(transport)
})
afterEach(() => { cleanup(); setOverride(null) })

async function mount() {
  render(<MemoryRouter initialEntries={['/raj236/billing']}><BusinessProvider><Routes><Route path="/:username/billing" element={<BillingPage />} /></Routes></BusinessProvider></MemoryRouter>)
  await settle(60)
}
const box = () => screen.getByLabelText('Customer')
const type = (v) => fireEvent.change(box(), { target: { value: v } })
const rows = () => screen.queryAllByRole('option')
const rowTexts = () => rows().map((o) => o.textContent)
const row = (re) => rows().find((o) => re.test(o.textContent))
const enter = () => fireEvent.keyDown(box(), { key: 'Enter' })
const modalOpen = () => !!screen.queryByLabelText('Mobile number (10 digits)')
const selects = () => posts.filter((p) => p.url.endsWith('/select'))

describe('phone search — the shop’s own customer first', () => {
  it('a number the shop already has shows that customer for selection (no global row, no Create-new row), and clicking it selects it', async () => {
    searchImpl = async () => [ASHA]
    await mount(); type(PHONE); await settle(80)
    expect(rowTexts().length).toBe(1); expect(rowTexts()[0]).toContain('Asha'); expect(rowTexts()[0]).toContain(PHONE)
    fireEvent.mouseDown(row(/Asha/)); await settle()
    expect(box().value).toContain('Asha'); expect(posts.length).toBe(0)
  })
})

describe('phone search — global-user suggestion', () => {
  it('shows ONLY the name (no phone, no count) plus “Create new customer”, and never selects it by itself', async () => {
    searchImpl = async () => [GLOBAL]
    await mount(); type(PHONE); await settle(80)
    const t = rowTexts()
    expect(t.length).toBe(2); expect(t[0]).toBe('Ravi'); expect(t[1]).toContain('Create new customer')
    expect(box().value).toBe(PHONE)            // nothing was selected
    expect(posts.length).toBe(0)               // nothing was saved / linked
  })

  it('clicking the name selects it through the existing select endpoint (id + name + number), and the customer is then used', async () => {
    searchImpl = async () => [GLOBAL]
    await mount(); type(PHONE); await settle(80)
    fireEvent.mouseDown(row(/^Ravi$/)); await settle()
    expect(selects().length).toBe(1); expect(selects()[0].body).toEqual({ globalUserId: 'g1', name: 'Ravi', phone: PHONE })
    expect(box().value).toContain('Ravi'); expect(box().value).toContain(PHONE)
  })

  it('a double click saves it once', async () => {
    searchImpl = async () => [GLOBAL]; selectImpl = async () => later(80, SAVED)
    await mount(); type(PHONE); await settle(80)
    const r = row(/^Ravi$/); fireEvent.mouseDown(r); fireEvent.mouseDown(r); await settle(150)
    expect(selects().length).toBe(1)
  })

  it('ignoring it: “Create new customer” opens an empty name with the number filled; a different name is saved as a NEW customer (no select call)', async () => {
    searchImpl = async () => [GLOBAL]
    await mount(); type(PHONE); await settle(80)
    fireEvent.mouseDown(row(/Create new customer/)); await settle()
    expect(modalOpen()).toBe(true)
    expect(screen.getByLabelText('Name').value).toBe(''); expect(screen.getByLabelText('Mobile number (10 digits)').value).toBe(PHONE)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ravi Kumar' } })
    fireEvent.click(screen.getByText('Save & use')); await settle()
    expect(selects().length).toBe(0)
    const adds = posts.filter((p) => p.url === '/api/seller/billing/customers')
    expect(adds.length).toBe(1); expect(adds[0].body).toEqual({ name: 'Ravi Kumar', phone: PHONE })
    expect(box().value).toContain('Ravi Kumar')
  })

  it('saving the new-customer form twice quickly sends one request', async () => {
    searchImpl = async () => [GLOBAL]
    await mount(); type(PHONE); await settle(80)
    fireEvent.mouseDown(row(/Create new customer/)); await settle()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ravi Kumar' } })
    const f = screen.getByText('Save & use').closest('form'); fireEvent.submit(f); fireEvent.submit(f); await settle()
    expect(posts.filter((p) => p.url === '/api/seller/billing/customers').length).toBe(1)
  })

  it('the shop already has another customer with that name → the confirm form opens with the server’s message so the name can be changed', async () => {
    searchImpl = async () => [GLOBAL]
    selectImpl = async (b, config) => { throw httpError(config, 409, 'You already have a customer named “Ravi” with a different number. Change the name to save this one.') }
    await mount(); type(PHONE); await settle(80)
    fireEvent.mouseDown(row(/^Ravi$/)); await settle()
    expect(modalOpen()).toBe(true); expect(screen.getByLabelText('Name').value).toBe('Ravi'); expect(screen.getByText(/Change the name to save this one/)).toBeTruthy()
  })
})

describe('Enter key', () => {
  it('pressed while the phone search is still running: nothing is created or selected; when only a global suggestion arrives it still waits for the seller', async () => {
    searchImpl = async () => later(150, [GLOBAL])
    await mount(); type(PHONE); await settle(10)
    enter(); await settle(20)
    expect(modalOpen()).toBe(false); expect(posts.length).toBe(0)           // nothing yet
    expect(rowTexts().join('|')).toContain('Searching')
    await settle(250)
    expect(rowTexts()[0]).toBe('Ravi')
    expect(modalOpen()).toBe(false); expect(selects().length).toBe(0)       // suggestion not auto-selected, new customer not auto-started
    enter(); await settle()                                                  // a second, deliberate Enter = the highlighted “Create new customer”
    expect(modalOpen()).toBe(true); expect(selects().length).toBe(0)
  })

  it('pressed while the search runs and the shop already has the number: that customer is used once the answer lands', async () => {
    searchImpl = async () => later(120, [ASHA])
    await mount(); type(PHONE); await settle(10)
    enter(); await settle(10)
    expect(box().value).toBe(PHONE)
    await settle(250)
    expect(box().value).toContain('Asha'); expect(modalOpen()).toBe(false)
  })

  it('pressed while the search runs and nothing is found anywhere: the new-customer form opens (intended flow) after the answer', async () => {
    searchImpl = async () => later(120, [])
    await mount(); type(PHONE); await settle(10)
    enter(); await settle(10)
    expect(modalOpen()).toBe(false)
    await settle(250)
    expect(modalOpen()).toBe(true); expect(screen.getByLabelText('Mobile number (10 digits)').value).toBe(PHONE)
  })

  it('typing again after the Enter cancels it (it never acts on the older text)', async () => {
    searchImpl = async (q) => later(120, q === PHONE ? [] : [ASHA])
    await mount(); type(PHONE); await settle(10)
    enter(); await settle(5)
    type('98765'); await settle(300)
    expect(modalOpen()).toBe(false)
  })

  it('with a global suggestion on screen, the arrow keys and Enter skip it: they land on “Create new customer”, never on the suggestion', async () => {
    searchImpl = async () => [GLOBAL]
    await mount(); type(PHONE); await settle(80)
    fireEvent.keyDown(box(), { key: 'ArrowUp' }); fireEvent.keyDown(box(), { key: 'ArrowDown' }); fireEvent.keyDown(box(), { key: 'ArrowUp' })
    expect(rows()[0].getAttribute('data-active')).toBe('false'); expect(rows()[1].getAttribute('data-active')).toBe('true')
    enter(); await settle()
    expect(selects().length).toBe(0); expect(modalOpen()).toBe(true)
  })

  it('with the shop’s own customer AND a settled list, Enter still picks the customer as before', async () => {
    searchImpl = async () => [ASHA]
    await mount(); type('Ash'); await settle(220)
    enter(); await settle()
    expect(box().value).toContain('Asha')
  })
})

describe('name search · performance', () => {
  it('name search still works, and “Create new customer” is offered after the results arrive', async () => {
    searchImpl = async () => [ASHA]
    await mount(); type('Ash'); await settle(220)
    const t = rowTexts(); expect(t[0]).toContain('Asha'); expect(t[t.length - 1]).toContain('Create new customer “Ash”')
  })

  it('a complete number is searched at once (no waiting); typing it digit by digit sends a single request', async () => {
    await mount()
    let v = ''; for (const d of PHONE) { v += d; type(v) }
    await settle(5)
    expect(searches).toEqual([PHONE])
  })

  it('below the threshold nothing is requested (name < 2 characters, phone < 3 digits)', async () => {
    await mount(); type('A'); await settle(200); type('98'); await settle(200)
    expect(searches.length).toBe(0)
  })

  it('an older, slower reply never replaces the newer results', async () => {
    searchImpl = async (q) => (q === 'Ra' ? later(250, [{ ...ASHA, id: 'x1', name: 'Ravi Old' }]) : later(20, [{ ...ASHA, id: 'x2', name: 'Rahul New' }]))
    await mount(); type('Ra'); await settle(150); type('Rah'); await settle(400)
    expect(searches).toEqual(['Ra', 'Rah'])
    const t = rowTexts().join('|'); expect(t).toContain('Rahul New'); expect(t).not.toContain('Ravi Old')
  })

  it('an identical query is served from the cache (backspacing does not search again)', async () => {
    searchImpl = async () => [ASHA]
    await mount(); type('Ash'); await settle(220); type('As'); await settle(220); type('Ash'); await settle(220)
    expect(searches.filter((q) => q === 'Ash').length).toBe(1)
  })
})
