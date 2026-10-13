// @vitest-environment jsdom
// Shop Billing screen — the REAL BillingPage, api.js and BillActions run against a fake axios transport (no server, no database).
// Covers: 4th quick button (Pending Amount · +₹ old udhar · −₹ advance) · View & Print / View Only · Share in Recent Bills · Udhar account block · default discount (applied once, editable, per-shop config).
// Runs under real vitest (`npm test`) and under the sandbox runner:  node --import ./tests/_harness/register.mjs tests/_harness/run.mjs tests/billingFlow.test.jsx
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './_support/adapterSwitch.js' // must come before anything that imports services/api.js
import { setOverride } from './_support/adapterSwitch.js'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'

const { default: BillingPage } = await import('../src/features/analytics/pages/BillingPage.jsx')
const { BusinessProvider } = await import('../src/context/BusinessContext.jsx')
const { buildDocument } = await import('../src/features/analytics/billCore.js')

Element.prototype.scrollIntoView = () => {}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const settle = (ms = 30) => act(async () => { await tick(ms) })

const CAPS = { products: true, discount: true, partialPayment: true, udhar: true, context: [], defaultDiscountEnabled: true, defaultDiscountType: 'percent', defaultDiscountValue: 10 }
const ASHA = { source: 'local', id: 'c1', name: 'Asha', phone: '9876543210', udharDue: 200, credit: 0, usageCount: 1 }
const RAVI = { ...ASHA, id: 'c2', name: 'Ravi', udharDue: 0, credit: 0 }          // no account balance
const MEERA = { ...ASHA, id: 'c3', name: 'Meera', udharDue: 0, credit: 150 }      // holds an Advance Balance
const NEHA = { ...ASHA, id: 'c4', name: 'Neha', udharDue: 0, credit: 1000 }       // advance bigger than the bill
const savedDoc = () => buildDocument({
  business: { name: 'Test Shop' }, payments: [{ method: 'cash', amount: 100 }],
  bill: { displayId: '#ORDB1', createdAt: new Date('2026-10-13T10:00:00Z'), customerName: 'Asha', customerPhone: '9876543210', status: 'udhar', paymentMethod: 'cash', transactionType: 'sale',
    items: [{ type: 'product', name: 'Sugar', qty: 1, rate: 400, total: 400, discount: 0 }], subtotal: 400, discount: 0, totalAmount: 400, paidAmount: 100, unpaidAmount: 300,
    balanceBefore: 200, balanceAfter: 500, receivedAmount: 100, returnedAmount: 0, creditUsed: 0 },
})

let caps, posts, opened, who = ASHA
const transport = (config) => {
  const url = String(config.url).replace(/^https?:\/\/[^/]+/, ''), method = config.method.toUpperCase()
  const ok = (data) => Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config })
  if (method === 'POST' && url === '/api/seller/sales') { posts.push(JSON.parse(config.data)); return ok({ billId: 'NEW1', status: 'Pending', settlement: {} }) }
  if (method !== 'GET') return ok({ ok: true })
  if (url === '/api/seller/billing/config') return ok({ capabilities: caps, lineTypes: [{ type: 'product', label: 'Product', addLabel: 'Add Product' }], business: { name: 'Test Shop' } })
  if (url === '/api/seller/billing/products') return ok([{ id: 'p1', name: 'Sugar', price: 400, priceUnit: 'unit', stock: 50, topQty: 1 }])
  if (url.startsWith('/api/seller/billing/recent')) return ok([{ billId: 'B1', id: '#ORDB1', time: new Date().toISOString(), customer: 'Asha', customerId: 'c1', amount: 400, payment: 'Cash', status: 'Pending', transactionType: 'sale', typeLabel: 'Sale' }])
  if (url === '/api/seller/billing/bills/B1/document') return ok(savedDoc())
  if (url.startsWith('/api/customers/search')) return ok([who])
  return ok([]) // drafts · services · anything else
}

beforeEach(() => { caps = { ...CAPS }; posts = []; opened = []; who = ASHA; setOverride(transport); window.open = (u) => { opened.push(u) } })
afterEach(() => { cleanup(); setOverride(null) })

async function mountBilling() {
  render(<MemoryRouter initialEntries={['/raj236/billing']}><BusinessProvider><Routes><Route path="/:username/billing" element={<BillingPage />} /></Routes></BusinessProvider></MemoryRouter>)
  await settle(60)
}
// pick Asha (owes ₹200) and put one Sugar (₹400) on the bill
async function startBill(c = ASHA) {
  who = c
  await mountBilling()
  fireEvent.change(screen.getByLabelText('Customer'), { target: { value: c.name } }); await settle(350)
  fireEvent.mouseDown(screen.getAllByRole('option').find((o) => o.textContent.includes(c.name))); await settle()
  fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'Sugar' } }); await settle()
  fireEvent.mouseDown(screen.getAllByRole('option').find((o) => /Sugar/.test(o.textContent))); await settle()
  fireEvent.click(screen.getByText(/Add \(Enter\)/)); await settle()
}
const received = () => screen.getByLabelText('Amount received').value
const discountBox = () => document.getElementById('bill-discount')
const choose = async (button, item) => { fireEvent.click(screen.getByRole('button', { name: button })); fireEvent.click(await screen.findByRole('menuitem', { name: item })); await settle() }

describe('Amount Received — 4th quick option', () => {
  it('customer with no net balance: the 4th option is simply not shown (no Pending Amount, no +/−, no Compensate)', async () => {
    await startBill(RAVI)
    expect(screen.queryByText('Pending Amount')).toBeNull()
    expect(screen.queryByRole('button', { name: /^[+-]₹/ })).toBeNull(); expect(screen.queryByRole('button', { name: 'Compensate' })).toBeNull()
    expect(received()).toBe('360') // default: paid in full (₹400 − 10% default discount)
  })
  it('the existing quick amounts still work, and a bill left fully on Udhar (Udhar method) posts the same fields a ₹0 part payment always did', async () => {
    await startBill(RAVI)
    fireEvent.click(screen.getByText('₹500')); await settle(); expect(received()).toBe('500')
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '0' } }); await settle()
    expect(received()).toBe('0')
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    expect(posts.length).toBe(1)
    const b = posts[0]
    expect(b.receivedAmount).toBe(0); expect(b.amountPaid).toBe(0); expect(b.addRemainingToUdhar).toBe(true)
    expect(b.customerName).toBe('Ravi'); expect(b.items.length).toBe(1); expect(b.advanceToUse).toBe(0)
  })
})

describe('View & Print / View Only', () => {
  it('replaces the direct 80mm / A4 print buttons — no print happens until the viewer is open', async () => {
    await startBill()
    expect(screen.queryByRole('button', { name: '80mm Print' })).toBeNull(); expect(screen.queryByRole('button', { name: 'A4 Print' })).toBeNull()
    expect(screen.getByRole('button', { name: '80mm' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'A4' })).toBeTruthy()
  })
  for (const [label, fmt] of [['80mm', 'thermal'], ['A4', 'a4']]) {
    it(`${label} View & Print: opens the preview with a Print button and the correct bill; nothing is saved`, async () => {
      await startBill()
      await choose(label, 'View & Print')
      const dlg = screen.getByRole('dialog'); const html = dlg.querySelector('iframe').getAttribute('srcdoc')
      expect(!!within(dlg).getByRole('button', { name: 'Print' })).toBe(true) // (the Recent Bills rows have their own Print button — look inside the viewer)
      expect(html).toContain('Asha'); expect(html).toContain('Sugar'); expect(html).toContain('₹360')
      expect(html).not.toContain('display:none!important')
      expect(posts.length).toBe(0) // no bill, payment or stock movement was created
    })
    it(`${label} View Only: same bill, no Print button, printing disabled inside and around the frame; nothing is saved`, async () => {
      await startBill()
      await choose(label, 'View Only')
      const dlg = screen.getByRole('dialog'); const f = dlg.querySelector('iframe'), html = f.getAttribute('srcdoc')
      expect(within(dlg).queryByRole('button', { name: 'Print' })).toBeNull()
      expect(html).toContain('Asha'); expect(html).toContain('Sugar'); expect(html).toContain('₹360')
      expect(html).toContain('@media print{html,body{display:none!important}}')
      expect(f.getAttribute('sandbox')).toBe('') // no scripts, no window.print()
      expect(!!document.head.querySelector('style') && [...document.head.querySelectorAll('style')].some((s) => /body>\*\{display:none!important\}/.test(s.textContent))).toBe(true)
      expect(posts.length).toBe(0)
      fireEvent.keyDown(window, { key: 'Escape' }); await settle()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect([...document.head.querySelectorAll('style')].some((s) => /body>\*\{display:none!important\}/.test(s.textContent))).toBe(false) // print rule removed on close
    })
  }
})

describe('Udhar account block on the current bill', () => {
  it('shows previous udhar, this bill, paid now and the remaining udhar — and does not double count', async () => {
    await startBill()
    fireEvent.click(screen.getByRole('button', { name: 'Udhar' })); await settle()
    expect(screen.getByText(/Previous udhar ₹200/)).toBeTruthy()
    expect(screen.getByText(/Remaining udhar ₹560/)).toBeTruthy() // 200 + 360 − 0
    await choose('A4', 'View Only')
    const html = screen.getByRole('dialog').querySelector('iframe').getAttribute('srcdoc')
    for (const t of ['UDHAR ACCOUNT', 'Previous Udhar', '₹200', 'This bill', 'Paid now', 'Remaining Udhar', '₹560']) expect(html).toContain(t)
    expect(html).not.toMatch(/cost|profit/i) // nothing internal in a customer document
  })
  it('paying in full leaves only the older udhar outstanding', async () => {
    await startBill() // default received = ₹360 = the bill
    expect(screen.getByText(/Remaining udhar ₹200/)).toBeTruthy()
  })
})

describe('Recent Bills — View replaced by Share', () => {
  it('the redundant View button is gone (the row itself opens the details); Share sends the saved bill incl. the Udhar account', async () => {
    await mountBilling()
    expect(screen.queryByRole('button', { name: 'View' })).toBeNull()
    expect(screen.getByText('Recent Bills')).toBeTruthy() // the section itself stays
    expect(screen.getByRole('button', { name: 'Print' })).toBeTruthy()
    const shareBtns = screen.getAllByRole('button', { name: 'Share' }); fireEvent.click(shareBtns[shareBtns.length - 1])
    fireEvent.click(await screen.findByRole('menuitem', { name: 'WhatsApp' })); await settle()
    expect(opened.length).toBe(1); const text = decodeURIComponent(opened[0])
    expect(opened[0]).toContain('wa.me/919876543210'); expect(text).toContain('#ORDB1'); expect(text).toContain('Previous Udhar: ₹200'); expect(text).toContain('Remaining Udhar: ₹500')
  })
})

describe('Default discount', () => {
  it('pre-fills the ONE bill discount (10% → ₹360), is editable, and is posted once', async () => {
    await startBill()
    expect(discountBox().value).toBe('10'); expect(screen.getByLabelText('Discount type').value).toBe('percent')
    expect(screen.getByText(/Default discount applied/)).toBeTruthy()
    expect(screen.getAllByText('₹360').length).toBeGreaterThan(0); expect(screen.queryByText('₹324')).toBeNull() // never 10% of 10%
    fireEvent.change(discountBox(), { target: { value: '5' } }); await settle()
    expect(screen.queryByText(/Default discount applied/)).toBeNull(); expect(screen.getAllByText('₹380').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    expect(posts[0].discount).toEqual({ type: 'percent', value: 5 })
    expect(discountBox().value).toBe('10') // the next bill starts from the default again
  })
  it('a fixed ₹ default works the same way', async () => {
    caps = { ...CAPS, defaultDiscountType: 'fixed', defaultDiscountValue: 50 }
    await startBill()
    expect(discountBox().value).toBe('50'); expect(screen.getByLabelText('Discount type').value).toBe('fixed'); expect(screen.getAllByText('₹350').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    expect(posts[0].discount).toEqual({ type: 'fixed', value: 50 })
  })
  it('stays out of the way when disabled, or when the business has Discount switched off', async () => {
    caps = { ...CAPS, defaultDiscountEnabled: false }
    await startBill(); expect(discountBox().value).toBe(''); cleanup()
    caps = { ...CAPS, discount: false }
    await mountBilling(); expect(discountBox()).toBeNull()
  })
  it('Clear All resets the bill to the shop default; the seller can clear the discount before generating', async () => {
    await startBill()
    fireEvent.change(discountBox(), { target: { value: '' } }); await settle()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    expect(posts[0].discount).toEqual({ type: 'percent', value: 0 })
  })
})

// ───────── 4th quick button: pending Udhar (+) and Advance Balance (−) ─────────
const lastPost = () => posts[posts.length - 1]
describe('4th button — customer has pending Udhar', () => {
  it('shows +₹<their udhar> in red/orange (not the bill\'s pending amount) and no longer shows Pending Amount', async () => {
    await startBill()
    const b = screen.getByRole('button', { name: '+₹200' })
    expect(b.className).toMatch(/red/)
    expect(screen.queryByText('Pending Amount')).toBeNull()
  })
  it('adds the udhar to Amount Received; the bill stays paid by ITS part only and the old udhar is cleared', async () => {
    await startBill() // bill ₹360, received 360, owes 200
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    expect(received()).toBe('560')
    expect(screen.getByText(/Remaining udhar ₹0/)).toBeTruthy()          // 200 + 360 − 560
    expect(screen.getByText(/Old udhar paid ₹200 · This bill paid ₹360/)).toBeTruthy()
    expect(screen.getByText('No change to return')).toBeTruthy()          // the 200 is NOT change to hand back
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost()
    expect(b.receivedAmount).toBe(560); expect(b.returnedAmount).toBe(0)
    expect(b.amountPaid).toBe(360); expect(b.oldUdharPaid).toBe(200)      // old udhar is not counted as payment of this bill
    expect(b.addRemainingToUdhar).toBe(false); expect(b.advanceToUse).toBe(0)
  })
  it('a second tap takes it back out', async () => {
    await startBill()
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    expect(received()).toBe('360'); expect(screen.getByText(/Remaining udhar ₹200/)).toBeTruthy()
  })
  it('ADDS the udhar to whatever Amount Received already holds (never replaces it); the added money is old-udhar money, not a payment of this bill', async () => {
    await startBill() // bill ₹360, owes ₹200
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '100' } }); await settle()
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    expect(received()).toBe('300')                                          // 100 + 200 — not replaced by 360 + 200
    expect(screen.getByText('To Udhar')).toBeTruthy()                       // the bill itself only got ₹100 → ₹260 still unpaid
    expect(screen.getByText(/Old udhar paid ₹200 · This bill paid ₹100/)).toBeTruthy()
    expect(screen.getByText(/Remaining udhar ₹260/)).toBeTruthy()           // 200 + 360 − 300 (the ₹200 settles the old udhar, ₹100 part-pays the bill)
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost()
    expect(b.receivedAmount).toBe(300); expect(b.amountPaid).toBe(100); expect(b.oldUdharPaid).toBe(200); expect(b.addRemainingToUdhar).toBe(true); expect(b.returnedAmount).toBe(0)
  })
  it('from the default (bill paid in full) the tap gives bill + old udhar; from a bill left on Udhar it gives just the old udhar', async () => {
    await startBill()
    fireEvent.click(screen.getByRole('button', { name: 'Udhar' })); await settle() // bill ₹360 → udhar, received 0
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    expect(received()).toBe('200'); expect(screen.getByText('To Udhar')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle() // undo
    expect(received()).toBe('0')
  })
  it('part-paid bill (₹100 typed) + old udhar → received 300; tapping again takes only that ₹200 back out', async () => {
    await startBill()
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '100' } }); await settle()
    expect(screen.getByText('To Udhar')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    expect(received()).toBe('300'); expect(screen.getByText('To Udhar')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    expect(received()).toBe('100')
  })
  it('REGRESSION (screen recording): after +₹udhar, picking the bill-amount chip / typing the bill amount pays the bill — never "To Udhar"', async () => {
    await startBill()
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    expect(received()).toBe('560')
    fireEvent.click(screen.getByRole('button', { name: '₹360' })); await settle() // the bill-amount chip
    expect(received()).toBe('360'); expect(screen.queryByText('To Udhar')).toBeNull()
    expect(screen.getByRole('button', { name: '+₹200' }).className).not.toMatch(/bg-red-500/) // no longer marked as selected
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '360' } }); await settle()
    expect(screen.queryByText('To Udhar')).toBeNull()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost(); expect(b.amountPaid).toBe(360); expect(b.addRemainingToUdhar).toBe(false); expect(b.oldUdharPaid).toBe(0)
  })
  it('the printed bill carries the udhar account with the old udhar cleared', async () => {
    await startBill()
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle()
    await choose('A4', 'View Only')
    const html = screen.getByRole('dialog').querySelector('iframe').getAttribute('srcdoc')
    for (const t of ['UDHAR ACCOUNT', 'Previous Udhar', '₹200', 'Paid for this bill', '₹360', 'Old Udhar collected', 'Remaining Udhar']) expect(html).toContain(t)
    expect(html).not.toContain('Paid now') // the old-udhar money is never shown as a payment of this bill
  })
})

describe('4th button — customer has an Advance Balance', () => {
  it('shows −₹<advance> and does NOT silently deduct it any more', async () => {
    await startBill(MEERA) // bill ₹360, advance ₹150
    expect(screen.getByRole('button', { name: '-₹150' })).toBeTruthy()
    expect(screen.queryByText('Pending Amount')).toBeNull()
    expect(received()).toBe('360')                                         // nothing deducted yet
  })
  it('tapping applies it once: due drops to the remainder, advance is recorded as From Adv. Bal., remaining advance is 0', async () => {
    await startBill(MEERA)
    fireEvent.click(screen.getByRole('button', { name: '-₹150' })); await settle()
    expect(received()).toBe('210')
    expect(screen.getByText(/From Adv\. Bal\. −₹150 · Due now ₹210/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost()
    expect(b.advanceToUse).toBe(150); expect(b.amountPaid).toBe(210); expect(b.receivedAmount).toBe(210); expect(b.addRemainingToUdhar).toBe(false); expect(b.oldUdharPaid).toBe(0)
  })
  it('shows only the bill amount when the advance is bigger, and the rest is preserved', async () => {
    await startBill(NEHA) // bill ₹360, advance ₹1000
    expect(screen.getByRole('button', { name: '-₹360' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '-₹360' })); await settle()
    expect(received()).toBe('0')
    expect(screen.getByText('Return Amount')).toBeTruthy()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost()
    expect(b.advanceToUse).toBe(360); expect(b.amountPaid).toBe(0); expect(b.addRemainingToUdhar).toBe(false)
  })
  it('a part-advance leaves the unpaid remainder due when less is received', async () => {
    await startBill(MEERA)
    fireEvent.click(screen.getByRole('button', { name: '-₹150' })); await settle()
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '100' } }); await settle()
    expect(screen.getByText('To Udhar')).toBeTruthy()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost()
    expect(b.advanceToUse).toBe(150); expect(b.amountPaid).toBe(100); expect(b.addRemainingToUdhar).toBe(true) // 360 − 150 − 100 = 110 on udhar
  })
  it('replaces whatever was typed / a bill left on Udhar: received = what is still due after the advance', async () => {
    await startBill(MEERA)
    fireEvent.click(screen.getByRole('button', { name: 'Udhar' })); await settle() // bill ₹360 left on udhar, received 0
    fireEvent.click(screen.getByRole('button', { name: '-₹150' })); await settle()
    expect(received()).toBe('210')
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost()
    expect(b.advanceToUse).toBe(150); expect(b.amountPaid).toBe(210); expect(b.addRemainingToUdhar).toBe(false); expect(b.paymentMethod).toBe('cash')
  })
  it('tapping again undoes it (never deducted twice)', async () => {
    await startBill(MEERA)
    fireEvent.click(screen.getByRole('button', { name: '-₹150' })); await settle()
    fireEvent.click(screen.getByRole('button', { name: '-₹150' })); await settle()
    expect(received()).toBe('360')
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    expect(lastPost().advanceToUse).toBe(0)
  })
  it('the printed bill shows the advance used, the payment label and the advance left over', async () => {
    await startBill(NEHA)
    fireEvent.click(screen.getByRole('button', { name: '-₹360' })); await settle()
    await choose('A4', 'View Only')
    const html = screen.getByRole('dialog').querySelector('iframe').getAttribute('srcdoc')
    for (const t of ['Previous Advance', '₹1,000', 'Advance used (From Adv. Bal.)', '-₹360', 'Advance balance', '₹640']) expect(html).toContain(t)
    expect(html).toContain('Payment: <b>From Adv. Bal.</b>')              // not "Cash"
    expect(html).not.toContain('Remaining Udhar')
  })
})

// ───────── Return Amount → Compensate ─────────
const retBox = () => screen.getByText('Return Amount').nextSibling.textContent
const typeRecv = async (v) => { fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: String(v) } }); await settle() }
describe('Return Amount — Compensate', () => {
  it('does nothing by default: the normal Return Amount, Keep as advance and Custom keep working and the post carries no old-udhar payment', async () => {
    await startBill() // bill ₹360, owes ₹200
    await typeRecv(400)
    expect(retBox()).toBe('₹40')
    expect(screen.getByRole('button', { name: 'Compensate' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Keep as advance' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Custom' })).toBeTruthy()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost(); expect(b.receivedAmount).toBe(400); expect(b.returnedAmount).toBe(40); expect(b.oldUdharPaid).toBe(0); expect(b.amountPaid).toBe(360)
  })
  it('only after the seller taps it: Return Amount becomes ₹0, the change pays old udhar, remaining udhar is the rest; tapping again restores the normal behaviour', async () => {
    await startBill(); await typeRecv(400)
    fireEvent.click(screen.getByRole('button', { name: 'Compensate' })); await settle()
    expect(retBox()).toBe('₹0')
    expect(screen.getByText(/Compensate ON — ₹40 of the change pays old udhar · Udhar left ₹160/)).toBeTruthy() // 200 + 360 − 400
    expect(screen.getByText(/Remaining udhar ₹160/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    let b = lastPost(); expect(b.receivedAmount).toBe(400); expect(b.returnedAmount).toBe(0); expect(b.oldUdharPaid).toBe(40); expect(b.amountPaid).toBe(360); expect(b.addRemainingToUdhar).toBe(false)
  })
  it('tapping Compensate a second time goes back to the normal ₹ change', async () => {
    await startBill(); await typeRecv(400)
    fireEvent.click(screen.getByRole('button', { name: 'Compensate' })); await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Compensate' })); await settle()
    expect(retBox()).toBe('₹40'); expect(screen.queryByText(/Compensate ON/)).toBeNull()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    expect(lastPost().returnedAmount).toBe(40); expect(lastPost().oldUdharPaid).toBe(0)
  })
  it('payment clears everything → only the excess is change, and the seller still picks return / keep as Advance / custom', async () => {
    await startBill(); await typeRecv(700) // bill 360 + old 200 = 560 → excess 140
    fireEvent.click(screen.getByRole('button', { name: 'Compensate' })); await settle()
    expect(retBox()).toBe('₹140'); expect(screen.getByText(/Remaining udhar ₹0/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep as advance' })); await settle()
    expect(screen.getByText(/₹140 will be added to Asha’s Advance Balance/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    let b = lastPost(); expect(b.receivedAmount).toBe(700); expect(b.returnedAmount).toBe(0); expect(b.oldUdharPaid).toBe(200)
  })
  it('custom return of part of the excess keeps the rest as Advance', async () => {
    await startBill(); await typeRecv(700)
    fireEvent.click(screen.getByRole('button', { name: 'Compensate' })); await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Custom' })); await settle()
    fireEvent.change(screen.getByPlaceholderText('₹'), { target: { value: '50' } }); await settle()
    expect(screen.getByText(/₹90 will be added to Asha’s Advance Balance/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    const b = lastPost(); expect(b.returnedAmount).toBe(50); expect(b.oldUdharPaid).toBe(200)
  })
  it('works together with the 4th button: the ₹200 already added is not counted twice', async () => {
    await startBill(); await typeRecv(400)
    fireEvent.click(screen.getByRole('button', { name: '+₹200' })); await settle() // received 600, old 200, change 40
    expect(retBox()).toBe('₹40')
    fireEvent.click(screen.getByRole('button', { name: 'Compensate' })); await settle()
    expect(retBox()).toBe('₹40') // still just the excess over bill + old udhar
    fireEvent.click(screen.getByText(/Generate Bill/)); await settle(60)
    expect(lastPost().oldUdharPaid).toBe(200)
  })
  it('no stale compensation: switching customer drops it, and a customer with no udhar never sees the button', async () => {
    await startBill(); await typeRecv(400)
    fireEvent.click(screen.getByRole('button', { name: 'Compensate' })); await settle()
    who = RAVI
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Ravi' } }); await settle(350)
    fireEvent.mouseDown(screen.getAllByRole('option').find((o) => o.textContent.includes('Ravi'))); await settle()
    expect(screen.queryByRole('button', { name: 'Compensate' })).toBeNull()
    who = ASHA
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Asha' } }); await settle(350)
    fireEvent.mouseDown(screen.getAllByRole('option').find((o) => o.textContent.includes('Asha'))); await settle()
    await typeRecv(400)
    expect(screen.getByRole('button', { name: 'Compensate' }).getAttribute('aria-pressed')).toBe('false')
    expect(retBox()).toBe('₹40')
  })
  it('net zero balance: no udhar/advance button, no Compensate and no Pending Amount — the 4th option is empty', async () => {
    await startBill(RAVI)
    expect(screen.queryByText('Pending Amount')).toBeNull()
    expect(screen.queryByRole('button', { name: /^[+-]₹/ })).toBeNull(); expect(screen.queryByRole('button', { name: 'Compensate' })).toBeNull()
  })
})
