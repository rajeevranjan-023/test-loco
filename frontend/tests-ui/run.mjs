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
  if (path.startsWith('/api/customers/search')) return Promise.resolve([{ source: 'local', id: 'c1', name: 'Raj', phone: '9876543210', udharDue: 0, credit: 0 }])
  if (m === 'post' && path === '/api/seller/sales') return Promise.resolve({ billId: '261007A0101', status: 'Cleared', settlement: {} })
  return Promise.resolve([])
}
const caps = (o) => ({ partialPayment: true, udhar: true, context: [], ...o })
const CFG = {
  grocery: { capabilities: caps({ products: true }), lineTypes: [{ type: 'product' }] },
  hybrid: { capabilities: caps({ products: true, services: true, materials: true, labour: true, otherCharges: true, discount: true, context: [{ key: 'vehicle', label: 'Vehicle', required: false }] }), lineTypes: ['product', 'service', 'material', 'labour', 'other'].map((type) => ({ type })) },
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
// 1) GROCERY — must look like today's screen
let root = await mount('grocery')
ok(/Add Product/.test(txt()) && !btn(/Add Service/) && !btn(/Add Labour/) && !btn(/Add Material/), 'Grocery: only “Add Product”, no Service/Labour/Material buttons')
ok(!/Discount/.test(txt()) && !/Vehicle/.test(txt()) && /Customer → Product → Payment/.test(txt()), 'Grocery: no discount / vehicle fields, original hint text')
ok(!!btn(/Cash/) && !!btn(/UPI/) && !!btn(/Card/) && !!btn(/Udhar/) && !!btn(/Generate Bill/) && !!btn(/Save as Draft/) && !!btn(/80mm Print/) && !!btn(/A4 Print/) && !!btn(/Share/), 'Grocery: Cash/UPI/Card/Udhar, Generate, Draft, 80mm/A4/Share all present')
ok(!!document.querySelector('input[aria-label="Product"]') && /Current Bill Items \(0\)/.test(txt()) && !document.querySelector('em[title]'), 'Grocery: product search + empty items table, no transaction chip')
root.unmount()

// 2) HYBRID
root = await mount('hybrid')
ok(['Add Product', 'Add Service', 'Add Material', 'Add Labour', 'Other Charge'].every((l) => btn(new RegExp(l))), 'Hybrid: all five “+ Add …” buttons shown')
ok(!!document.querySelector('input[aria-label="Vehicle"]'), 'Hybrid: configured optional Vehicle field appears')
// customer
const cust = document.querySelector('input[aria-label="Customer"]'); await setVal(cust, 'raj'); await tick(400)
await act(async () => { document.querySelector('[role="option"]').dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })) }); await tick()
// service
await act(async () => { btn(/Add Service/).click() }); await tick()
const sName = document.querySelector('input[aria-label="Service"]'); ok(!!sName, 'Service mode shows the service row')
await setVal(sName, 'AC'); await tick(); await act(async () => { document.querySelector('[role="option"]').dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })) }); await tick()
ok(document.querySelector('input[aria-label="Rate"]').value === '500', 'picking a saved service pre-fills its rate (₹500, fixed)')
await act(async () => { [...document.querySelectorAll('button')].find((b) => /Add \(Enter\)/.test(b.textContent) && b.closest('div.flex-wrap') && !b.disabled).click() }); await tick()
// material
await act(async () => { btn(/Add Material/).click() }); await tick()
const pin = document.querySelector('input[aria-label="Product"]'); await setVal(pin, 'cap'); await tick()
ok(document.querySelectorAll('[role="option"]').length === 1, 'Material list shows the service-only part (Capacitor)')
await act(async () => { document.querySelector('[role="option"]').dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })) }); await tick()
ok(document.querySelector('input[aria-label="Selling price"]')?.value === '200', 'Material shows an editable Rate prefilled ₹200')
await key(document.querySelector('input[aria-label="Quantity"]'), 'Enter'); await tick()
// product list must NOT offer service-only part
await act(async () => { btn(/Add Product/).click() }); await tick()
const pin2 = document.querySelector('input[aria-label="Product"]'); await setVal(pin2, 'cap'); await tick()
ok(![...document.querySelectorAll('[role="option"]')].some((o) => /Capacitor/.test(o.textContent)), 'Product list hides the service-only part')
// labour (hourly)
await act(async () => { btn(/Add Labour/).click() }); await tick()
const lName = document.querySelector('input[aria-label="Labour"]'); await setVal(lName, 'Tech'); await tick()
await act(async () => { document.querySelector('[role="option"]').dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })) }); await tick()
ok(!!document.querySelector('input[aria-label="Quantity"]') && document.querySelector('select[aria-label="Pricing"]').value === 'hourly', 'Hourly labour asks for Hours')
await setVal(document.querySelector('input[aria-label="Quantity"]'), '2'); await key(document.querySelector('input[aria-label="Rate"]'), 'Enter'); await tick()
// other
await act(async () => { btn(/Other Charge/).click() }); await tick()
await setVal(document.querySelector('input[aria-label="Charge"]'), 'Cleaning'); await setVal(document.querySelector('input[aria-label="Rate"]'), '100'); await key(document.querySelector('input[aria-label="Rate"]'), 'Enter'); await tick()
ok(/Current Bill Items \(4\)/.test(txt()), 'four mixed lines in the bill')
ok(/Mixed/.test(document.querySelector('h3').textContent) || /Mixed/.test(txt()), 'transaction type auto-derived: Mixed')
ok(/₹1,400/.test(document.body.textContent), 'Total = 500 + 200 + (2h × 300) + 100 = ₹1,400')
// discount
await setVal(document.querySelector('#bill-discount'), '100'); await tick()
ok(/₹1,300/.test(txt()), 'Discount ₹100 → total ₹1,300')
await setVal(document.querySelector('input[aria-label="Vehicle"]'), 'UP32 AB 1234')
// save draft payload
await act(async () => { btn(/Save as Draft/).click() }); await tick()
const d = posted.find((p) => p.path === '/api/seller/billing/drafts')
ok(d && d.body.state.items.length === 4 && d.body.state.discount === '100' && d.body.state.context.vehicle === 'UP32 AB 1234' && d.body.itemCount === 4 && d.body.total === 1300, 'Draft payload carries 4 typed lines, discount, context, total')
// rebuild the bill quickly (draft reset it) via resume is covered server-side; generate a fresh bill:
await act(async () => { btn(/Add Service/).click() }); await tick()
const cust2 = document.querySelector('input[aria-label="Customer"]'); await setVal(cust2, 'raj'); await tick(400)
await act(async () => { document.querySelector('[role="option"]').dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })) }); await tick()
await act(async () => { btn(/Add Service/).click() }); await tick()
await setVal(document.querySelector('input[aria-label="Service"]'), 'Deep clean'); await setVal(document.querySelector('input[aria-label="Rate"]'), '700'); await key(document.querySelector('input[aria-label="Rate"]'), 'Enter'); await tick()
await act(async () => { btn(/Generate Bill/).click() }); await tick(80)
const sale = posted.find((p) => p.path === '/api/seller/sales')
ok(sale && sale.body.items.length === 1 && sale.body.items[0].type === 'service' && sale.body.items[0].rate === 700 && sale.body.items[0].name === 'Deep clean' && sale.body.customerName === 'Raj' && sale.body.paymentMethod === 'cash', 'Generate Bill posts {type:service, name, rate} through the SAME /sales endpoint')
root.unmount()

// 3) PROVIDER
root = await mount('provider')
ok(!!btn(/Add Service/) && !!btn(/Add Labour/) && !btn(/Add Product/) && !btn(/Add Material/), 'Provider: only Service + Labour buttons')
ok(!!document.querySelector('input[aria-label="Service"]'), 'Provider: opens straight on the Service row')
root.unmount()
console.log(fails ? `\n${fails} FAILED` : '\nAll UI checks passed'); process.exit(fails ? 1 : 0)
