// The Universal Billing Engine — PURE, dependency-free functions. ONE calculation pipeline for every business type:
//   line totals → subtotal → discounts → tax → grand total → paid → due.
// This exact file is mirrored byte-for-byte to frontend/src/features/analytics/billCore.js (a test enforces it), so the screen
// and the server can never disagree on a total.
//   line item type  : product · service · material · labour · other        (what each row IS)
//   transaction type: sale · service · labour · mixed                        (what the whole bill IS — derived, never asked)
//   charge mode     : charged (customer pays) · included (inside a service price — shown as "included", ₹0) · internal (inventory only, not on the customer's bill)
export const BASE_LINE_TYPES = ['product', 'service', 'material', 'labour', 'other']   // every business
// Study Center item types (membership · course fee · book/study material · fine · registration · seat fee). They flow through the SAME pipeline;
// which of them a business may bill is decided by its schema (utils/businessSchema.js) and capabilities (utils/billingConfig.js).
export const LINE_TYPES = [...BASE_LINE_TYPES, 'membership', 'course', 'book', 'fine', 'registration', 'seat']
export const CHARGE_MODES = ['charged', 'included', 'internal']
export const PRICING = ['fixed', 'per_unit', 'hourly', 'custom']

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// goods (product/material) → sale · service → service · labour → labour · two or more of those → mixed.
// "Other charge" is neutral (a cleaning fee must not turn a plain sale into a mixed bill); an other-only bill counts as service.
const STUDY_KIND = { membership: 'membership', registration: 'membership', seat: 'membership', course: 'course', book: 'book', fine: 'fine' }
export function deriveTransactionType(lines) {
  const kinds = new Set()
  for (const l of lines) {
    if (STUDY_KIND[l.type]) kinds.add(STUDY_KIND[l.type])
    else if (l.type === 'product' || l.type === 'material') kinds.add('sale')
    else if (l.type === 'service') kinds.add('service')
    else if (l.type === 'labour') kinds.add('labour')
  }
  if (kinds.size > 1) return 'mixed'
  return kinds.size === 1 ? [...kinds][0] : 'service'
}

// ── discounts ──  { type: 'percent' | 'fixed', value }
export function cleanDiscount(raw) {
  if (raw && typeof raw === 'object') {
    const value = Number(raw.value)
    if (!(value > 0)) return { type: 'fixed', value: 0 }
    return raw.type === 'percent' ? { type: 'percent', value: Math.min(value, 100) } : { type: 'fixed', value }
  }
  const v = Number(raw)
  return { type: 'fixed', value: v > 0 ? v : 0 } // a bare number = fixed ₹ (older clients)
}
const discountOn = (base, d) => (base <= 0 ? 0 : Math.min(d.type === 'percent' ? (base * d.value) / 100 : d.value, base))

// ── THE pipeline ──
// lines: [{ type, qty, rate, charge?, discountType?, discountValue? }]   opts: { discount, taxRate }
export function computeBill(lines, opts = {}) {
  const billDisc = cleanDiscount(opts.discount)
  const taxRate = Number(opts.taxRate) > 0 ? Math.min(Number(opts.taxRate), 100) : 0
  const rows = lines.map((l) => {
    const billed = (l.charge || 'charged') === 'charged'            // included / internal lines never add to what the customer owes
    const gross = billed ? l.rate * l.qty : 0
    const disc = billed ? discountOn(gross, cleanDiscount({ type: l.discountType, value: l.discountValue })) : 0
    return { gross, disc, net: gross - disc }
  })
  const sumGross = rows.reduce((s, x) => s + x.gross, 0)
  const sumNet = rows.reduce((s, x) => s + x.net, 0)
  // Σ of RAW line values rounded once — identical to how product-only bills were always totalled, so existing totals never move by a paisa.
  const subtotal = r2(sumGross)
  const billDiscount = discountOn(sumNet, billDisc)
  const taxable = r2(sumNet - billDiscount)
  const discount = r2(subtotal - taxable)                            // line + bill discount together; subtotal − discount = taxable (exact)
  const lineDiscount = r2(rows.reduce((s, x) => s + r2(x.disc), 0))
  const taxAmount = taxRate ? r2((taxable * taxRate) / 100) : 0
  const total = r2(taxable + taxAmount)
  // revenue by kind, net of discounts and EXCLUDING tax, always adding up to `taxable`
  // the five base kinds are always present (existing bills keep exactly the same shape); other kinds appear only when a line uses them
  const kinds = [...BASE_LINE_TYPES, ...LINE_TYPES.filter((k) => !BASE_LINE_TYPES.includes(k) && lines.some((l) => l.type === k))]
  const rev = Object.fromEntries(kinds.map((k) => [k, 0]))
  lines.forEach((l, i) => { rev[l.type] += rows[i].net })
  const revenue = {}
  for (const k of kinds) revenue[k] = sumNet > 0 ? r2((rev[k] / sumNet) * taxable) : 0
  const drift = r2(taxable - Object.values(revenue).reduce((a, b) => a + b, 0))
  if (drift) { const big = kinds.reduce((a, k) => (revenue[k] > revenue[a] ? k : a), kinds[0]); revenue[big] = r2(revenue[big] + drift) }
  return {
    subtotal, lineDiscount, billDiscount: r2(billDiscount), discount, taxable, taxRate, taxAmount, total, revenue,
    lines: rows.map((x) => ({ gross: r2(x.gross), discount: r2(x.disc), total: r2(x.net) })),
  }
}

// Cost of goods actually consumed (FIFO batch cost snapshot on each product/material line) — counted even for included/internal materials.
export function costBreakdown(lines) {
  const c = { product: 0, material: 0 }
  for (const l of lines) if ((l.type === 'product' || l.type === 'material') && l.cost) c[l.type] += l.cost * l.qty
  return { product: r2(c.product), material: r2(c.material) }
}

// Check + clean the optional context against the business's configured fields. Returns { values, error }.
export function resolveContext(fields, raw) {
  const given = raw && typeof raw === 'object' ? raw : {}
  const values = []
  for (const f of fields || []) {
    const v = String(given[f.key] ?? '').trim().slice(0, 120)
    if (f.required && !v) return { values: [], error: `${f.label} is required.` }
    if (v) values.push({ key: f.key, label: f.label, value: v }) // label is snapshotted so old bills read the same after a rename
  }
  return { values, error: null }
}

// Extras every line may carry: description, charge mode (material & labour only), item-level discount.
export function cleanLineExtras(raw, type) {
  const charge = (type === 'material' || type === 'labour') && CHARGE_MODES.includes(raw.charge) ? raw.charge : 'charged'
  const d = cleanDiscount({ type: raw.discountType, value: raw.discountValue })
  return { description: String(raw.description || '').trim().slice(0, 200), charge, discountType: d.value ? d.type : 'fixed', discountValue: d.value }
}

// Validate a non-inventory line (service · labour · other). Inventory lines are resolved against Product in the controller.
export function cleanChargeLine(raw, type) {
  const name = String(raw.name || '').trim().slice(0, 80)
  if (!name) return { error: `${type === 'other' ? 'Charge' : type === 'labour' ? 'Labour' : type === 'service' ? 'Service' : 'Item'} needs a name.` }
  const extras = cleanLineExtras(raw, type)
  const pricing = type === 'other' ? 'fixed' : PRICING.includes(raw.pricing) ? raw.pricing : 'fixed'
  let rate = Number(raw.rate ?? raw.price)
  if (extras.charge === 'charged' && !(rate > 0)) return { error: `Enter a valid rate for "${name}".` }
  if (!(rate > 0)) rate = 0 // included / internal labour carries no customer rate
  const qty = pricing === 'fixed' || type === 'other' ? 1 : Number(raw.qty ?? raw.quantity)
  if (!(qty > 0)) return { error: `Enter a valid ${pricing === 'hourly' ? 'number of hours' : 'quantity'} for "${name}".` }
  const unit = pricing === 'hourly' ? 'hr' : pricing === 'per_unit' ? String(raw.unit || 'unit').trim().slice(0, 12) || 'unit' : ''
  return { line: { type, name, qty: Math.round(qty * 1000) / 1000, unit, rate, pricing, serviceId: raw.serviceId || null, ...extras } }
}

// ── Customer-facing document ──
// The ONE place a bill is turned into something a customer may see. It is built by WHITELIST: cost, supplier, batches, internal
// notes and internal (non-charged) lines can never reach print / PDF / WhatsApp / SMS / Telegram because they are never copied in.
const SECTIONS = [['product', 'PRODUCTS'], ['service', 'SERVICES'], ['material', 'MATERIALS'], ['labour', 'LABOUR'], ['membership', 'MEMBERSHIP'], ['registration', 'REGISTRATION'], ['seat', 'SEAT FEES'], ['course', 'COURSE FEES'], ['book', 'BOOKS & STUDY MATERIAL'], ['fine', 'FINES'], ['other', 'OTHER CHARGES']]
const METHOD = { cash: 'Cash', upi: 'UPI', card: 'Card', udhar: 'Udhar', advance: 'Advance' }
export function paymentStatusOf(b) {
  if (!(b.unpaidAmount > 0.005)) return 'Paid'
  if (!(b.paidAmount > 0.005)) return b.status === 'udhar' ? 'Udhar' : 'Unpaid'
  return 'Partial'
}
export function buildDocument({ business = {}, bill, payments = [], terms = '', partyLabel = 'Customer', partyIdLabel = '' }) {
  const sections = SECTIONS.map(([key, title]) => ({
    key, title,
    items: (bill.items || []).filter((i) => i.type === key && i.charge !== 'internal').map((i) => ({
      name: i.name, description: i.description || '', qty: i.qty, unit: i.unit || '', rate: i.rate,
      discount: i.discount || 0, total: i.total, included: i.charge === 'included',
    })),
  })).filter((s) => s.items.length)
  const pays = payments.filter((p) => p.amount > 0).map((p) => ({ method: METHOD[p.method] || p.method, amount: p.amount }))
  const methods = [...new Set(pays.filter((p) => p.method !== 'Advance').map((p) => p.method))]
  const status = partyLabel === 'Customer' ? paymentStatusOf(bill) : (paymentStatusOf(bill) === 'Udhar' ? 'Unpaid' : paymentStatusOf(bill)) // "Udhar" is a shop word
  return {
    business: { name: business.name || '', phone: business.phone || '', address: business.address || '', logoUrl: business.logoUrl || '' },
    billNo: bill.displayId, date: bill.createdAt, transactionType: bill.transactionType || 'sale',
    customer: { name: bill.customerName || 'Walk-in', phone: bill.customerPhone || '' },
    party: { label: partyLabel, idLabel: partyIdLabel, id: bill.memberCode || '' }, // what the person is called on this business's documents (Customer / Member)
    context: (bill.context || []).map((c) => ({ label: c.label, value: c.value })),
    sections,
    totals: {
      subtotal: bill.subtotal ?? r2((bill.totalAmount || 0) + (bill.discount || 0) - (bill.taxAmount || 0)),
      discount: bill.discount || 0,
      tax: bill.taxAmount > 0 ? { name: bill.taxName || 'Tax', rate: bill.taxRate || 0, amount: bill.taxAmount } : null,
      total: bill.totalAmount, paid: bill.paidAmount, due: Math.max(bill.unpaidAmount || 0, 0),
    },
    payment: { method: methods.length ? methods.join(' + ') : status === 'Udhar' || status === 'Unpaid' ? 'Udhar' : METHOD[bill.paymentMethod] || 'Cash', status, payments: pays },
    terms: String(terms || ''),
  }
}
