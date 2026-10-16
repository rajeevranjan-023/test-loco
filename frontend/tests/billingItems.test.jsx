// @vitest-environment jsdom
// Billing Options modal (study centre / library): seven item switches, saved per centre through the existing billing-config API, obeyed by the Billing screen.
// The real BillingOptions modal + BillingPage run against a stateful fake of /api/seller/billing/config that keeps ONE capability set PER CENTRE
// (the same shape the real server keeps on each centre's account) — no server, no database.
//   node --import ./tests/_harness/register.mjs tests/_harness/run.mjs tests/billingItems.test.jsx
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './_support/adapterSwitch.js'
import { setOverride } from './_support/adapterSwitch.js'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

const { default: BillingOptions, STUDY_ITEM_FLAGS } = await import('../src/features/analytics/BillingOptions.jsx')
const { default: BillingPage } = await import('../src/features/analytics/pages/BillingPage.jsx')
const { BusinessProvider, SHOP_BUSINESS } = await import('../src/context/BusinessContext.jsx')

Element.prototype.scrollIntoView = () => {}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const settle = (ms = 30) => act(async () => { await tick(ms) })

// ── fake of the server: per-centre capabilities, same order / labels as utils/businessSchema.js + billingConfig.js ──
const ORDER = [['membership', 'membership', 'Add Membership'], ['book', 'books', 'Add Book/Material'], ['course', 'courses', 'Add Course Fee'], ['fine', 'fines', 'Add Fine'], ['other', 'otherCharges', 'Add Other Charge'], ['registration', 'registration', 'Add Registration'], ['seat', 'seatFees', 'Add Seat Fee']]
const DEFAULTS = { membership: true, courses: true, books: true, fines: true, otherCharges: true, registration: true, seatFees: true, partialPayment: true, udhar: true, discount: true, context: [] }
let centres, active, puts
const lineTypes = (caps) => ORDER.filter(([, k]) => caps[k]).map(([type, , addLabel]) => ({ type, label: addLabel.replace('Add ', ''), addLabel }))
const transport = (config) => {
  const url = String(config.url).replace(/^https?:\/\/[^/]+/, ''), method = config.method.toUpperCase()
  const ok = (data) => Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config })
  if (url === '/api/seller/billing/config' && method === 'PUT') { const b = JSON.parse(config.data); puts.push(b); centres[active] = { ...centres[active], ...b }; return ok({ capabilities: centres[active], lineTypes: lineTypes(centres[active]) }) }
  if (url === '/api/seller/billing/config') return ok({ capabilities: centres[active], lineTypes: lineTypes(centres[active]), business: { name: active } })
  if (url === '/api/seller/study/billing/catalog') return ok({ window: {}, timeSlots: [], plans: [], seats: [], courses: [], materials: [], chargeTypes: [] })
  return ok([])
}
beforeEach(() => { centres = { A: { ...DEFAULTS }, B: { ...DEFAULTS } }; active = 'A'; puts = []; setOverride(transport) })
afterEach(() => { cleanup(); setOverride(null) })

const BILLING_ITEMS = STUDY_ITEM_FLAGS
// the modal exactly as BillingPage opens it: cfg from GET /billing/config, Save → PUT /billing/config, onSaved gets the server's answer
let lastCfg
const mountSettings = async (sellerType = 'study_center') => {
  const cfg = await new Promise((res) => transport({ url: '/api/seller/billing/config', method: 'get' }).then((r) => res({ ...r.data, sellerType })))
  render(<BillingOptions cfg={cfg} onClose={() => {}} onSaved={(c) => { lastCfg = c }} />); await settle()
}
const sw = (label) => screen.getByRole('switch', { name: label })
const on = (label) => sw(label).getAttribute('aria-checked') === 'true'
const flip = (label) => fireEvent.click(sw(label))
const save = async () => { fireEvent.click(screen.getByText('Save')); await settle() }
const STUDY = { ...SHOP_BUSINESS, type: 'study_center' }
const mountBilling = async () => { render(<MemoryRouter initialEntries={['/s1/billing']}><BusinessProvider business={STUDY}><Routes><Route path="/:username/billing" element={<BillingPage />} /></Routes></BusinessProvider></MemoryRouter>); await settle(80) }
const buttons = () => screen.queryAllByRole('button').map((b) => b.textContent.trim()).filter((t) => /^Add (Membership|Book\/Material|Course Fee|Fine|Other Charge|Registration|Seat Fee)$/.test(t))
const GENERIC = ['Sell products', 'Provide services', 'Use inventory materials', 'Charge labour', 'Discount', 'Tax', 'Change product rate on a bill']

describe('Options modal — library (study centre)', () => {
  it('shows exactly the seven library items, in order, each with its own switch — and none of the generic shop/service options', async () => {
    await mountSettings()
    expect(BILLING_ITEMS.map(([, l]) => l)).toEqual(['Membership', 'Book/Material', 'Course Fee', 'Fine', 'Other Charge', 'Registration', 'Seat Fee'])
    for (const [, l] of BILLING_ITEMS) expect(on(l)).toBe(true)
    for (const g of GENERIC) expect(screen.queryByText(g)).toBeNull()
    expect(screen.queryByLabelText('Default discount')).toBeNull()
  })
  it('each switch works on its own: Save sends only that item flipped, the other six stay as they were', async () => {
    for (const [k, l] of BILLING_ITEMS) {
      await mountSettings(); puts = []
      flip(l); expect(on(l)).toBe(false); await save()
      expect(puts.length).toBe(1); expect(puts[0][k]).toBe(false)
      for (const [k2] of BILLING_ITEMS) if (k2 !== k) expect(puts[0][k2]).toBe(true)
      expect(centres.A[k]).toBe(false); cleanup(); centres.A = { ...DEFAULTS }
    }
  })
  it('persists: re-opening the modal (refresh) shows what was saved', async () => {
    await mountSettings(); flip('Fine'); flip('Course Fee'); await save(); cleanup()
    await mountSettings()
    expect(on('Fine')).toBe(false); expect(on('Course Fee')).toBe(false); expect(on('Membership')).toBe(true); expect(on('Seat Fee')).toBe(true)
  })
  it('centres are independent: A\'s change never shows on B', async () => {
    await mountSettings(); flip('Seat Fee'); flip('Registration'); await save(); cleanup()
    active = 'B'; await mountSettings()
    expect(on('Seat Fee')).toBe(true); expect(on('Registration')).toBe(true)
  })
  it('the last switched-on item cannot be saved off — nothing is sent', async () => {
    centres.A = { ...DEFAULTS, books: false, courses: false, fines: false, otherCharges: false, registration: false, seatFees: false } // only Membership left
    await mountSettings(); puts = []
    flip('Membership'); await save()
    expect(puts.length).toBe(0); expect(screen.getByText(/Keep at least one billing item/)).toBeTruthy()
  })
})

describe('Options modal — other business types are unchanged', () => {
  it('a shop still gets the generic list (and no library items)', async () => {
    centres.A = { products: true, partialPayment: true, udhar: true, context: [] }
    await mountSettings('shop')
    for (const g of GENERIC) expect(screen.getByText(g)).toBeTruthy()
    expect(screen.queryByText('Seat Fee')).toBeNull(); expect(screen.queryByText('Membership')).toBeNull()
  })
  it('a service provider too', async () => {
    centres.A = { services: true, labour: true, partialPayment: true, udhar: true, context: [] }
    await mountSettings('service')
    expect(screen.getByText('Provide services')).toBeTruthy(); expect(screen.queryByText('Fine')).toBeNull()
  })
})

describe('Billing screen shows only the enabled item buttons', () => {
  it('everything on → all seven "+ Add …" buttons', async () => {
    await mountBilling()
    expect(buttons()).toEqual(['Add Membership', 'Add Book/Material', 'Add Course Fee', 'Add Fine', 'Add Other Charge', 'Add Registration', 'Add Seat Fee'])
  })
  it('Membership + Fine + Seat Fee on → exactly those three, the other four hidden', async () => {
    centres.A = { ...DEFAULTS, books: false, courses: false, otherCharges: false, registration: false }
    await mountBilling()
    expect(buttons()).toEqual(['Add Membership', 'Add Fine', 'Add Seat Fee'])
  })
  it('switch off in Settings → hidden in Billing; switch on again → back (same position)', async () => {
    await mountSettings(); flip('Fine'); await save(); cleanup()
    await mountBilling(); expect(buttons()).not.toContain('Add Fine'); expect(buttons().length).toBe(6); cleanup()
    await mountSettings(); flip('Fine'); await save(); cleanup()
    await mountBilling(); expect(buttons()).toEqual(['Add Membership', 'Add Book/Material', 'Add Course Fee', 'Add Fine', 'Add Other Charge', 'Add Registration', 'Add Seat Fee'])
  })
  it('another centre keeps its own buttons', async () => {
    centres.A = { ...DEFAULTS, fines: false, seatFees: false }
    active = 'B'; await mountBilling(); expect(buttons().length).toBe(7)
  })
  it('a single enabled item: no button row, and the heading names that item instead of "Add Product"', async () => {
    centres.A = { ...DEFAULTS, books: false, courses: false, fines: false, otherCharges: false, registration: false, seatFees: false }
    await mountBilling()
    expect(buttons().length).toBe(0); expect(screen.getByText('Add Membership')).toBeTruthy(); expect(screen.queryByText('Add Product')).toBeNull()
  })
})
