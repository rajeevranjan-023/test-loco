import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
const g = globalThis
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent']) Object.defineProperty(g, k, { value: dom.window[k], configurable: true })
g.IS_REACT_ACT_ENVIRONMENT = true; g.requestAnimationFrame = (f) => setTimeout(f, 0)
dom.window.HTMLElement.prototype.scrollIntoView = () => {}
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client'); const { act } = await import('react-dom/test-utils')
const posted = []
const mkApi = (cfg) => (m, path, body) => {
  if (m === 'post') posted.push({ path, body })
  if (path.startsWith('/api/seller/billing/config')) return Promise.resolve(cfg)
  if (path.startsWith('/api/seller/billing/products')) return Promise.resolve([{ id: 'p1', name: 'Rice (1 kg)', price: 60, priceUnit: 'kg', stock: 50, sellable: true, topQty: 1 }, { id: 'p2', name: 'Capacitor', price: 200, priceUnit: 'unit', stock: 5, sellable: false, topQty: 1 }])
  if (path.startsWith('/api/seller/billing/services')) return Promise.resolve([{ id: 's1', kind: 'service', name: 'AC General Service', rate: 500, pricing: 'fixed', unit: '' }, { id: 's2', kind: 'labour', name: 'Technician', rate: 300, pricing: 'hourly', unit: 'hr' }])
  if (path.startsWith('/api/seller/billing/drafts')) return Promise.resolve([])
  if (path.includes('/document')) return Promise.resolve({})
  if (path.startsWith('/api/customers/search')) return Promise.resolve([{ source: 'local', id: 'c1', name: 'Raj', phone: '9876543210', udharDue: 0, credit: 0 }])
  if (m === 'post' && path === '/api/seller/sales') return Promise.resolve({ billId: '261007A0101', status: 'Cleared', settlement: {} })
  return Promise.resolve([])
}
const caps = (o) => ({ partialPayment: true, udhar: true, context: [], ...o })
globalThis.__docs = []
const CFG = {
  grocery: { capabilities: caps({ products: true }), lineTypes: [{ type: 'product' }] },
  hybrid: { business: { name: 'Raj Garage', phone: '9876543210', address: 'MG Road', logoUrl: '' }, capabilities: caps({ products: true, services: true, materials: true, labour: true, otherCharges: true, discount: true, tax: true, taxRate: 18, taxName: 'GST', editRate: true, terms: 'Warranty 30 days.', context: [{ key: 'vehicle', label: 'Vehicle', required: false }] }), lineTypes: ['product', 'service', 'material', 'labour', 'other'].map((type) => ({ type })) },
  provider: { capabilities: caps({ services: true, labour: true }), lineTypes: [{ type: 'service' }, { type: 'labour' }] },
}
const { default: BillingPage } = await import('./out.mjs'); const { default: BillPage } = await import('./outbill.mjs')
const tick = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const txt = () => document.body.textContent
const btn = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent))
const setVal = async (el, v) => { await act(async () => { const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })) }) }
const key = async (el, k) => act(async () => { el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true })) })
let fails = 0; const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) fails++ }

async function mount(name) {
  document.body.innerHTML = '<div id="root"></div>'; posted.length = 0
  g.__api = mkApi(CFG[name]); const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(BillingPage)) }); await tick(60)
  return root
}


import fs from 'node:fs'
const mountBill = async (file) => { document.body.innerHTML = '<div id="root"></div>'; const order = JSON.parse(fs.readFileSync(file, 'utf8')); g.__seller = () => order; g.__api = mkApi(CFG.hybrid); const root = createRoot(document.getElementById('root')); await act(async () => { root.render(React.createElement(BillPage)) }); await tick(60); return root }

// ── Bill View page with the REAL API payload for the five-type bill
let root = await mountBill('/tmp/order_five.json')
const T = document.body.textContent
ok(['PRODUCTS', 'SERVICES', 'MATERIALS', 'LABOUR', 'OTHER CHARGES'].every((s) => T.includes(s)), 'Bill View: PRODUCTS / SERVICES / MATERIALS / LABOUR / OTHER CHARGES sections are separate')
ok(['Engine Oil', 'AC Gas', 'AC Service', 'Repair Labour', 'Cleaning'].every((s) => T.includes(s)) && T.includes('2 hr'), 'Bill View: every real line with quantity + unit (2 hr)')
ok(T.includes('GST') && T.includes('₹486') && T.includes('₹3,186'), 'Bill View: tax line (GST ₹486) and Total ₹3,186')
ok(!!btn(/80mm Print/) && !!btn(/A4 Print/) && !!btn(/Share/), 'Bill View: the three actions')
ok(!/Print$/.test([...document.querySelectorAll('button')].map((b) => b.textContent).find((x) => /^Print$/.test(x)) || ''), 'Bill View: old plain “Print” button is gone')
root.unmount()
root = await mountBill('/tmp/order_split.json')
const T2 = document.body.textContent
ok(T2.includes('Cash') && T2.includes('UPI') && T2.includes('₹1,000') && /Card/.test(T2), 'Bill View (split bill): payment history lists Cash ₹1,000, UPI ₹1,000 and the later Card instalment')
root.unmount()

// ── Resume draft restores EVERYTHING
g.__sp = 'draft=d1'
const draft = { id: 'd1', customer: { source: 'local', id: 'c1', name: 'Raj', phone: '9876543210', udharDue: 0, credit: 0 }, state: { items: [
  { key: 'c1', type: 'service', name: 'Install', price: 1000, qty: 1, pricing: 'fixed', description: 'Split AC', discountType: 'percent', discountValue: '10' },
  { key: 'm:p2:internal', type: 'material', id: 'p2', name: 'Capacitor', price: 0, qty: 1, charge: 'internal' }], method: 'UPI', discount: '50', discountType: 'fixed', split: { cash: '500', upi: '200', card: '' }, context: { vehicle: 'UP32 AB 1234' }, mode: 'service' } }
const baseApi = mkApi(CFG.hybrid)
g.__seller = undefined
document.body.innerHTML = '<div id="root"></div>'; g.__api = (m, path, body) => (path.startsWith('/api/seller/billing/drafts/d1') ? Promise.resolve(draft) : baseApi(m, path, body))
root = createRoot(document.getElementById('root')); await act(async () => { root.render(React.createElement(BillingPage)) }); await tick(150)
const Tx = document.body.textContent
ok(/Current Bill Items \(2\)/.test(Tx) && Tx.includes('Install') && Tx.includes('Split AC') && Tx.includes('Capacitor') && /not charged/.test(Tx), 'Resume: both lines back, with description and “not charged” material')
ok(document.querySelector('#bill-discount').value === '50' && document.querySelector('select[aria-label="Discount type"]').value === 'fixed', 'Resume: bill discount ₹50 restored')
ok(document.querySelector('input[aria-label="Cash amount"]')?.value === '500' && document.querySelector('input[aria-label="UPI amount"]')?.value === '200', 'Resume: split payment (cash 500 + UPI 200) restored')
ok(document.querySelector('input[aria-label="Vehicle"]').value === 'UP32 AB 1234', 'Resume: vehicle context restored')
ok(document.querySelector('input[aria-label="Customer"]').value.startsWith('Raj'), 'Resume: customer restored in the customer field')
// 1000 −10% = 900, −50 = 850, +18% = 1003
ok(/₹1,003/.test(Tx), 'Resume: totals recomputed through the same pipeline: (1,000 − 10%) − ₹50 = 850 + 18% GST = ₹1,003')
root.unmount()
console.log(fails ? `\n${fails} FAILED` : '\nAll bill-view + resume UI checks passed'); process.exit(fails ? 1 : 0)
