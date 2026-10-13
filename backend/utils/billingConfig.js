// Business → billing capabilities. ONE resolver for every account type: nothing here is keyed on username or trade.
// A business turns capabilities on/off; the billing screen and the API both read the same resolved object.
import { LINE_TYPES, cleanDiscount } from './billing.js'
import { schemaFor } from './businessSchema.js'
export { LINE_TYPES }
export const LINE_LABEL = { product: 'Product', service: 'Service', material: 'Material', labour: 'Labour', other: 'Other Charge', membership: 'Membership', course: 'Course Fee', book: 'Book / Material', fine: 'Fine', registration: 'Registration Fee', seat: 'Seat Fee' }
// the label of an item type for THIS business (its schema may rename it: a study centre's `material` is still "Material", its `book` is "Book / Material")
export const labelFor = (sellerType, type) => schemaFor(sellerType).billing.labels[type] || LINE_LABEL[type] || type
export const addLabelFor = (sellerType, type) => schemaFor(sellerType).billing.addLabels[type] || ({ product: 'Add Product', service: 'Add Service', material: 'Add Material', labour: 'Add Labour', other: 'Other Charge' }[type]) || `Add ${labelFor(sellerType, type)}`
// capability flag that unlocks each line type
export const TYPE_CAP = { product: 'products', service: 'services', material: 'materials', labour: 'labour', other: 'otherCharges', membership: 'membership', course: 'courses', book: 'books', fine: 'fines', registration: 'registration', seat: 'seatFees' }
const FLAGS = ['defaultDiscountEnabled', 'products', 'services', 'materials', 'labour', 'otherCharges', 'membership', 'courses', 'books', 'fines', 'registration', 'seatFees', 'discount', 'tax', 'editRate', 'partialPayment', 'udhar']

// Defaults when a business never configured anything. A shop keeps today's product-only billing exactly.
// Default bill discount (per business, stored with the rest of the billing capabilities). OFF until the owner turns it on.
// It only PRE-FILLS the bill's one discount field on the billing screen — the engine (utils/billing.js) still applies a discount exactly once.
const DD = { defaultDiscountEnabled: false, defaultDiscountType: 'percent', defaultDiscountValue: 0 }
const DEFAULTS = {
  shop: { ...DD, products: true, services: false, materials: false, labour: false, otherCharges: false, discount: false, tax: false, editRate: false, taxRate: 0, taxName: 'GST', terms: '', partialPayment: true, udhar: true, context: [] },
  service: { ...DD, products: false, services: true, materials: false, labour: true, otherCharges: false, discount: false, tax: false, editRate: false, taxRate: 0, taxName: 'GST', terms: '', partialPayment: true, udhar: true, context: [] },
  // A study centre bills memberships, courses, books/material, fines and other charges; discount + part payment are on from day one. Shop-only item types stay OFF.
  study_center: { ...DD, products: false, services: false, materials: false, labour: false, otherCharges: true, membership: true, courses: true, books: true, fines: true, registration: true, seatFees: true, discount: true, tax: false, editRate: false, taxRate: 0, taxName: 'GST', terms: '', partialPayment: true, udhar: true, context: [] },
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)

// Optional context fields (Vehicle, Device, Job reference, Work location …) — configured per business, never mandatory by default.
export function sanitizeContext(list) {
  const seen = new Set(), out = []
  for (const f of Array.isArray(list) ? list.slice(0, 6) : []) {
    const label = String(f?.label || '').trim().slice(0, 30), key = slug(f?.key || label)
    if (!label || !key || seen.has(key)) continue
    seen.add(key); out.push({ key, label, required: !!f.required })
  }
  return out
}

// Keep only known boolean flags + a clean context list. Used for both reading stored config and validating a PUT.
export function sanitizeCapabilities(input) {
  const out = {}
  for (const k of FLAGS) if (typeof input?.[k] === 'boolean') out[k] = input[k]
  if (input && 'context' in input) out.context = sanitizeContext(input.context)
  if (input && ('defaultDiscountType' in input || 'defaultDiscountValue' in input)) {
    const d = cleanDiscount({ type: input.defaultDiscountType, value: input.defaultDiscountValue }) // % capped at 100, negatives → 0
    out.defaultDiscountType = d.type; out.defaultDiscountValue = d.value ? Math.round(d.value * 100) / 100 : 0
  }
  if (input && 'taxRate' in input) { const t = Number(input.taxRate); out.taxRate = t > 0 ? Math.min(Math.round(t * 100) / 100, 100) : 0 }
  if (input && 'taxName' in input) out.taxName = String(input.taxName || '').trim().slice(0, 12) || 'Tax'
  if (input && 'terms' in input) out.terms = String(input.terms || '').trim().slice(0, 300)
  return out
}

export function billingCapabilities(account, sellerType) {
  const base = DEFAULTS[sellerType] || DEFAULTS.service // (unknown type → service, as before)
  const caps = { ...base, ...sanitizeCapabilities(account?.billing?.capabilities) }
  // a business must always be able to bill *something*: if everything was switched off, fall back to its defaults
  if (!LINE_TYPES.some((t) => caps[TYPE_CAP[t]])) Object.assign(caps, Object.fromEntries(Object.values(TYPE_CAP).map((k) => [k, !!base[k]])))
  return caps
}
export const enabledTypes = (caps) => LINE_TYPES.filter((t) => caps[TYPE_CAP[t]])
