// @vitest-environment jsdom
// Billing → product search: selecting a product (Enter / click) must never lock the input. The REAL BillingPage runs against a fake transport.
// Runs under real vitest (`npm test`) and under the sandbox runner:  node --import ./tests/_harness/register.mjs tests/_harness/run.mjs tests/productSelect.test.jsx
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

const PRODUCTS = [
  { id: 'p1', name: 'Sugar', price: 40, priceUnit: 'unit', stock: 50, topQty: 1 },
  { id: 'p2', name: 'Salt', price: 20, priceUnit: 'unit', stock: 50, topQty: 1 },
  { id: 'p3', name: 'Rice', price: 60, priceUnit: 'unit', stock: 50, topQty: 1 },
]
const transport = (config) => {
  const url = String(config.url).replace(/^https?:\/\/[^/]+/, ''), method = config.method.toUpperCase()
  const ok = (data) => Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config })
  if (method !== 'GET') return ok({ ok: true })
  if (url === '/api/seller/billing/config') return ok({ capabilities: { products: true, partialPayment: true, udhar: true, context: [] }, lineTypes: [{ type: 'product', label: 'Product', addLabel: 'Add Product' }], business: { name: 'Test Shop' } })
  if (url === '/api/seller/billing/products') return ok(PRODUCTS)
  return ok([])
}
beforeEach(() => setOverride(transport))
afterEach(() => { cleanup(); setOverride(null) })

async function mount() {
  render(<MemoryRouter initialEntries={['/raj236/billing']}><BusinessProvider><Routes><Route path="/:username/billing" element={<BillingPage />} /></Routes></BusinessProvider></MemoryRouter>)
  await settle(60)
}
const box = () => screen.getByLabelText('Product')
const qtyBox = () => screen.getByLabelText('Quantity')
const type = (v) => fireEvent.change(box(), { target: { value: v } })
const key = (k, el = box()) => fireEvent.keyDown(el, { key: k })
const optionTexts = () => screen.queryAllByRole('option').map((o) => o.textContent)
const billCount = () => Number(/Current Bill Items \((\d+)\)/.exec(document.body.textContent)[1])
const billText = () => document.querySelector('table')?.textContent || ''
const addToBill = async () => { fireEvent.click(screen.getByText(/Add \(Enter\)/)); await settle() }
// type a query and press Enter on the highlighted suggestion
const searchAndEnter = async (q) => { type(q); await settle(); key('Enter'); await settle() }

describe('product search stays editable after a selection', () => {
  it('1 · searching and selecting with Enter selects the product (quantity opens up)', async () => {
    await mount(); await searchAndEnter('Sug')
    expect(box().value).toBe('Sugar'); expect(qtyBox().disabled).toBe(false)
  })

  it('2 · the field can be edited immediately after: not read-only, edit starts a fresh search with suggestions, selection is dropped', async () => {
    await mount(); const el = box(); await searchAndEnter('Sug')
    expect(el.readOnly).toBe(false)
    type('Sa'); await settle()
    expect(box()).toBe(el)                        // same input — never re-created
    expect(box().value).toBe('Sa')                // the typed text is kept
    expect(qtyBox().disabled).toBe(true)          // no product is selected any more
    expect(optionTexts().join('|')).toContain('Salt')   // fresh suggestions for the new text
  })

  it('3 · a different product can be searched and selected, then added', async () => {
    await mount(); await searchAndEnter('Sug')
    type('Sal'); await settle(); key('Enter'); await settle()
    expect(box().value).toBe('Salt'); expect(qtyBox().disabled).toBe(false)
    await addToBill()
    expect(billCount()).toBe(1); expect(billText()).toContain('Salt'); expect(billText()).not.toContain('Sugar')
  })

  it('4 · accidentally selecting the wrong product (Enter on the first suggestion) can be corrected by clearing and searching again', async () => {
    await mount(); await searchAndEnter('S')          // first suggestion = Sugar, but the seller wanted Rice
    expect(box().value).toBe('Sugar')
    type(''); await settle()                          // clear the field
    expect(qtyBox().disabled).toBe(true)
    await searchAndEnter('Ri')
    expect(box().value).toBe('Rice')
    await addToBill()
    expect(billCount()).toBe(1); expect(billText()).toContain('Rice'); expect(billText()).not.toContain('Sugar')
  })

  it('5 · items already on the bill are never touched while selecting / correcting products', async () => {
    await mount(); await searchAndEnter('Sug'); await addToBill()
    expect(billCount()).toBe(1); const before = billText()
    await searchAndEnter('Sal'); type('Ri'); await settle(); key('Enter'); await settle()   // wrong pick → corrected
    expect(billCount()).toBe(1); expect(billText()).toBe(before)
    key('Escape', qtyBox()); await settle()
    expect(billCount()).toBe(1); expect(billText()).toBe(before)
    await searchAndEnter('Ri'); await addToBill()
    expect(billCount()).toBe(2); expect(billText()).toContain('Sugar'); expect(billText()).toContain('Rice')
  })

  it('6 · everything works in place — the same input stays mounted and writable through select → edit → select', async () => {
    await mount(); const el = box()
    for (const q of ['Sug', 'Sal', 'Ri']) { await searchAndEnter(q); expect(box()).toBe(el); expect(el.readOnly).toBe(false) }
    expect(el.value).toBe('Rice')
  })
})

describe('keyboard on a selected product', () => {
  it('Enter on an already-selected product only moves to the quantity — it does not re-pick from an old list', async () => {
    await mount(); await searchAndEnter('Sug')
    box().focus(); key('Enter'); await settle()
    expect(box().value).toBe('Sugar'); expect(document.activeElement).toBe(qtyBox())
  })

  it('Esc clears the selected product and the text; ↓ reopens the search from its name', async () => {
    await mount(); await searchAndEnter('Sug')
    key('Escape'); await settle()
    expect(box().value).toBe(''); expect(qtyBox().disabled).toBe(true)
    await searchAndEnter('Sal'); key('ArrowDown'); await settle()
    expect(qtyBox().disabled).toBe(true); expect(box().value).toBe('Salt'); expect(optionTexts().join('|')).toContain('Salt')
  })

  it('clicking a suggestion still selects it, and a plain Enter with nothing typed still goes to payment once items exist', async () => {
    await mount(); type('Ri'); await settle()
    fireEvent.mouseDown(screen.getAllByRole('option').find((o) => /Rice/.test(o.textContent))); await settle()
    expect(box().value).toBe('Rice'); await addToBill()
    box().focus(); key('Enter'); await settle()
    expect(document.activeElement).toBe(screen.getByLabelText('Amount received'))
  })
})
