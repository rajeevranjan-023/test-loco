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
const { default: BillingPage } = await import('./out.mjs')
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

const pickFirst = async () => { await act(async () => { document.querySelector('[role="option"]').dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })) }); await tick() }
const iframeHtml = async () => { await tick(500); const f = document.querySelector('iframe'); return f ? f.contentDocument.documentElement.outerHTML : '' }

// ── GROCERY: simple screen, three actions replace Print / Share, no tax/discount/edit extras
let root = await mount('grocery')
ok(!!btn(/80mm Print/) && !!btn(/A4 Print/) && !!btn(/Share/) && !btn(/Print \/ Share/), 'Grocery: [80mm Print] [A4 Print] [Share] replace the old Print / Share button')
ok(!/Discount/.test(txt()) && !/GST/.test(txt()) && !/Split payment/.test(txt()) === false, 'Grocery: no discount / tax UI (split payment link is the only payment extra)')
root.unmount()

// ── HYBRID
root = await mount('hybrid')
const cust = document.querySelector('input[aria-label="Customer"]'); await setVal(cust, 'raj'); await tick(400); await pickFirst()
await act(async () => { btn(/Add Service/).click() }); await tick()
await setVal(document.querySelector('input[aria-label="Service"]'), 'AC'); await tick(); await pickFirst()
await key(document.querySelector('input[aria-label="Rate"]'), 'Enter'); await tick()
// material, NOT charged
await act(async () => { btn(/Add Material/).click() }); await tick()
await setVal(document.querySelector('input[aria-label="Product"]'), 'cap'); await tick(); await pickFirst()
ok(!!document.querySelector('select[aria-label="Charge"]'), 'Material row offers “Charge customer?”')
await act(async () => { const sel = document.querySelector('select[aria-label="Charge"]'); Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(sel, 'internal'); sel.dispatchEvent(new dom.window.Event('change', { bubbles: true })) }); await tick()
ok(!document.querySelector('input[aria-label="Selling price"]'), 'Non-chargeable material hides the rate field')
await key(document.querySelector('input[aria-label="Quantity"]'), 'Enter'); await tick()
ok(/not charged/.test(txt()) && /Current Bill Items \(2\)/.test(txt()), 'Non-chargeable material is on the bill, flagged “not charged”')
ok(/₹590/.test(txt()), 'Total = ₹500 + 18% GST = ₹590 (internal material adds nothing)')
// other charge + edit its rate
await act(async () => { btn(/Other Charge/).click() }); await tick()
await setVal(document.querySelector('input[aria-label="Charge"]'), 'Cleaning'); await setVal(document.querySelector('input[aria-label="Rate"]'), '100'); await key(document.querySelector('input[aria-label="Rate"]'), 'Enter'); await tick()
ok(/₹708/.test(txt()), '+ Cleaning ₹100 → (500+100) + 18% = ₹708')
await act(async () => { document.querySelector('button[aria-label="Edit Cleaning"]').click() }); await tick()
await setVal(document.querySelector('input[aria-label="Edit rate"]'), '200'); await tick()
ok(/₹826/.test(txt()), 'Edit rate on the line (100 → 200) recalculates immediately: (500+200) + 18% = ₹826')
await setVal(document.querySelector('input[aria-label="Edit description"]'), 'Deep clean'); await tick()
ok(/Deep clean/.test(txt()), 'Edit description shows on the line')
await setVal(document.querySelector('input[aria-label="Edit item discount"]'), '50'); await tick()
ok(/₹767/.test(txt()), 'Item discount ₹50 on Cleaning → (500+150) + 18% = ₹767')
await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent === 'Done').click() }); await tick()
// bill-level discount ₹ then %
await setVal(document.querySelector('#bill-discount'), '50'); await tick()
ok(/₹708/.test(txt()) || /₹708\.0/.test(txt()), 'Bill discount ₹50 → (650−50)+18% = ₹708')
await act(async () => { const sel = document.querySelector('select[aria-label="Discount type"]'); Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(sel, 'percent'); sel.dispatchEvent(new dom.window.Event('change', { bubbles: true })) }); await setVal(document.querySelector('#bill-discount'), '10'); await tick()
ok(/₹690\.3/.test(txt()), 'Bill discount 10% → 650×0.9 = 585 + 18% = ₹690.3')
ok(/Subtotal ₹700/.test(txt()) && /Discount −₹115/.test(txt()) && /GST 18% \+₹105\.3/.test(txt()), 'summary line: Subtotal ₹700 · Discount −₹115 (₹50 item + ₹65 bill) · GST 18% +₹105.3')
// remove the material row
await act(async () => { document.querySelector('button[aria-label="Remove Capacitor"]').click() }); await tick()
ok(/Current Bill Items \(2\)/.test(txt()) && !/Capacitor/.test(document.querySelector('table').textContent), 'remove item works (3 → 2 lines, Capacitor gone)')
// split payment
await act(async () => { btn(/Split payment/).click() }); await tick()
await setVal(document.querySelector('input[aria-label="Cash amount"]'), '300'); await setVal(document.querySelector('input[aria-label="UPI amount"]'), '200'); await tick()
ok(/Received ₹500/.test(txt()) && /due/.test(txt()), 'Split payment: cash 300 + UPI 200 → “Received ₹500 · … due”')
await act(async () => { btn(/Generate Bill/).click() }); await tick(80)
const sale = posted.find((p) => p.path === '/api/seller/sales')
ok(sale && sale.body.payments?.length === 2 && sale.body.payments[0].method === 'cash' && sale.body.discount.type === 'percent' && sale.body.discount.value === 10, 'Generate posts payments[] (cash+upi) and discount {percent,10} through the one /sales endpoint')
const sl = sale.body.items.find((i) => i.type === 'other'); ok(sl.rate === 200 && sl.description === 'Deep clean' && sl.discountValue === 50, 'line extras (rate edit, description, item discount) reach the server')
// three actions produce real output from the live document
await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
root.unmount()

root = await mount('hybrid')
await act(async () => { btn(/Add Service/).click() }); await tick()
await setVal(document.querySelector('input[aria-label="Service"]'), 'Visit'); await setVal(document.querySelector('input[aria-label="Rate"]'), '1000'); await key(document.querySelector('input[aria-label="Rate"]'), 'Enter'); await tick()
await act(async () => { btn(/80mm Print/).click() }); let html = await iframeHtml()
ok(html.includes('@page{size:80mm auto') && html.includes('RAJ GARAGE') && html.includes('SERVICES') && html.includes('GST (18%)') && html.includes('₹1,180') && html.includes('Thank you!'), '80mm Print (live bill): 80mm layout, business name, SERVICES, GST 18%, total ₹1,180')
document.querySelectorAll('iframe').forEach((f) => f.remove())
await act(async () => { btn(/A4 Print/).click() }); html = await iframeHtml()
ok(html.includes('@page{size:A4') && html.includes('INVOICE') && html.includes('Raj Garage') && html.includes('MG Road') && html.includes('Warranty 30 days.') && html.includes('Grand Total'), 'A4 Print (live bill): A4 invoice with business, address, terms, Grand Total')
ok(!/cost/i.test(html), 'A4 output contains no cost data')
document.querySelectorAll('iframe').forEach((f) => f.remove())
let opened = []; dom.window.open = (u) => { opened.push(u) }
await act(async () => { btn(/^Share$/).click() }); await tick()
ok(['WhatsApp', 'SMS', 'Telegram'].every((n) => btn(new RegExp(`^${n}$`))), 'Share menu lists WhatsApp, SMS, Telegram')
await act(async () => { btn(/^WhatsApp$/).click() }); await tick(80)
ok(opened[0]?.startsWith('https://wa.me/') && decodeURIComponent(opened[0]).includes('🧾 RAJ GARAGE') && decodeURIComponent(opened[0]).includes('Total: ₹1,180'), 'WhatsApp opens wa.me with the structured text')
root.unmount()
console.log(fails ? `\n${fails} FAILED` : '\nAll phase-2 UI checks passed'); process.exit(fails ? 1 : 0)
