// Business-schema + billing-configuration tests (no database): one engine, schema-driven behaviour, shops untouched.
import assert from 'node:assert/strict'
import { schemaFor, publicBusiness, navOf, capabilitiesOf, hasCapability, BUSINESS_TYPES } from '../utils/businessSchema.js'
import { billingCapabilities, enabledTypes, labelFor, addLabelFor, TYPE_CAP } from '../utils/billingConfig.js'
import { computeBill, cleanChargeLine, deriveTransactionType, buildDocument, LINE_TYPES } from '../utils/billing.js'
import { hooksFor } from '../utils/businessHooks.js'
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✅', name) }
const center = { config: { plans: [{ key: '1m', name: '1 Month', months: 1, price: 1000 }], features: {}, operatingHours: { open: '06:00', close: '22:00' } }, billing: undefined }

t('three business types are registered', () => assert.deepEqual(BUSINESS_TYPES, ['shop', 'service', 'study_center']))
t('SHOP navigation is exactly what it was', () => assert.deepEqual(navOf('shop', {}).map((x) => x.label), ['Profile', 'Dashboard', 'Billing', 'Udhar', 'Analytics', 'Inventory', 'Customer', 'Add']))
t('SERVICE navigation unchanged', () => assert.deepEqual(navOf('service', {}).map((x) => x.sub), ['', 'dashboard', 'billing', 'udhar', 'analytics', 'inventory', 'customer', 'add']))
t('STUDY CENTER navigation: Profile Dashboard Billing Members Courses Seats Analytics Pending Dues Add (no Inventory)', () => assert.deepEqual(navOf('study_center', center).map((x) => x.label), ['Profile', 'Dashboard', 'Billing', 'Members', 'Courses', 'Seats', 'Analytics', 'Pending Dues', 'Add']))
t('study centre gets Materials/Inventory only when it explicitly enables it', () => {
  assert.ok(!navOf('study_center', center).some((x) => x.key === 'inventory'))
  assert.ok(navOf('study_center', { config: { features: { inventory: true } } }).some((x) => x.key === 'inventory'))
})
t('terminology: Customer→Member, Udhar→Pending Dues, Shop ID→Center ID (shops keep theirs)', () => {
  const s = schemaFor('study_center').terms, h = schemaFor('shop').terms
  assert.equal(s.Customer, 'Member'); assert.equal(s.Customers, 'Members'); assert.equal(s.Udhar, 'Pending Dues'); assert.equal(s.DueFrom, 'Due from Member'); assert.equal(s.businessId, 'Center ID')
  assert.equal(h.Customer, 'Customer'); assert.equal(h.Udhar, 'Udhar'); assert.equal(h.businessId, 'Shop ID')
})
t('modules: study centre has seats/courses/members; shop has none of them; Add is the menu vs billing', () => {
  const s = schemaFor('study_center').modules, h = schemaFor('shop').modules
  assert.ok(s.seats && s.courses && s.members && s.dues); assert.equal(s.add, 'addMenu'); assert.equal(h.add, 'billing')
  assert.ok(!h.seats && !h.courses && !h.members && !h.dues)
})
t('capabilities: seatManagement only for study centres', () => { assert.ok(hasCapability('study_center', 'seatManagement')); assert.ok(!hasCapability('shop', 'seatManagement')); assert.ok(!hasCapability('service', 'seatManagement')) })
t('unknown / missing sellerType still falls back to the service schema (as before)', () => { assert.equal(schemaFor(null).type, 'service'); assert.equal(schemaFor('x').type, 'service') })

t('add menu: study centre lists its options and has NO "Add Product"', () => {
  const m = publicBusiness('study_center', center).addMenu.map((x) => x.label)
  for (const k of ['Add Member', 'Add Course', 'Add Membership Plan', 'Add Seat', 'Add Seat Zone', 'Add Time Slot', 'Add Study Material']) assert.ok(m.includes(k), k)
  assert.ok(!m.some((x) => /Product/.test(x))); assert.equal(publicBusiness('shop', {}).addMenu, null)
})

t('billing items: study centre = Membership · Book/Material · Course Fee · Fine · Other Charge (no Product/Service/Labour)', () => {
  const caps = billingCapabilities(center, 'study_center'), types = enabledTypes(caps)
  const order = schemaFor('study_center').billing.order, on = types.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  assert.deepEqual(on.slice(0, 5), ['membership', 'book', 'course', 'fine', 'other'])
  for (const x of ['product', 'service', 'labour', 'material']) assert.ok(!on.includes(x), x)
  assert.equal(addLabelFor('study_center', 'membership'), 'Add Membership'); assert.equal(addLabelFor('study_center', 'book'), 'Add Book/Material'); assert.equal(addLabelFor('study_center', 'course'), 'Add Course Fee')
  assert.equal(caps.discount, true); assert.equal(caps.partialPayment, true)
})
t('billing items: shop and service are EXACTLY as before (no study item types leak in)', () => {
  assert.deepEqual(enabledTypes(billingCapabilities({}, 'shop')), ['product']); assert.deepEqual(enabledTypes(billingCapabilities({}, 'service')), ['service', 'labour'])
  assert.equal(addLabelFor('shop', 'other'), 'Other Charge'); assert.equal(labelFor('shop', 'service'), 'Service')
})
t('every study line type has a billing capability key', () => { for (const k of LINE_TYPES) assert.ok(TYPE_CAP[k], k) })

t('study bill goes through the SAME engine: ₹2,500 membership, 10% = ₹250, fixed ₹200', () => {
  const lines = [{ type: 'membership', qty: 1, rate: 2500, charge: 'charged' }]
  assert.equal(computeBill(lines, { discount: { type: 'percent', value: 10 } }).total, 2250); assert.equal(computeBill(lines, { discount: { type: 'fixed', value: 200 } }).total, 2300)
  const c = computeBill([...lines, { type: 'course', qty: 1, rate: 4000, charge: 'charged' }, { type: 'fine', qty: 1, rate: 100, charge: 'charged' }], {})
  assert.equal(c.total, 6600); assert.equal(c.revenue.membership, 2500); assert.equal(c.revenue.course, 4000); assert.equal(c.revenue.fine, 100)
})
t('a shop bill keeps its exact shape (no study revenue keys appear)', () => assert.deepEqual(Object.keys(computeBill([{ type: 'product', qty: 2, rate: 10, charge: 'charged' }]).revenue), ['product', 'service', 'material', 'labour', 'other']))
t('transaction types for study bills', () => {
  assert.equal(deriveTransactionType([{ type: 'membership' }]), 'membership'); assert.equal(deriveTransactionType([{ type: 'course' }]), 'course'); assert.equal(deriveTransactionType([{ type: 'book' }]), 'book'); assert.equal(deriveTransactionType([{ type: 'fine' }]), 'fine')
  assert.equal(deriveTransactionType([{ type: 'membership' }, { type: 'book' }]), 'mixed'); assert.equal(deriveTransactionType([{ type: 'product' }]), 'sale')
})
t('payment states: Paid · Partial · Unpaid / Pending', () => {
  const doc = (paid, unpaid) => buildDocument({ business: {}, bill: { items: [], paidAmount: paid, unpaidAmount: unpaid, totalAmount: paid + unpaid, status: unpaid > 0 && !paid ? 'udhar' : 'paid' }, partyLabel: 'Member' }).payment?.status ?? buildDocument({ business: {}, bill: { items: [], paidAmount: paid, unpaidAmount: unpaid, totalAmount: paid + unpaid, status: unpaid > 0 && !paid ? 'udhar' : 'paid' }, partyLabel: 'Member' }).status
  assert.equal(doc(1000, 0), 'Paid'); assert.equal(doc(700, 300), 'Partial'); assert.equal(doc(0, 1000), 'Unpaid') // a shop word ("Udhar") never reaches a member's document
})
t('document says Member, not Customer, for a study centre', () => {
  const d = buildDocument({ business: { name: 'Bright' }, bill: { items: [], customerName: 'Riya', paidAmount: 0, unpaidAmount: 0, totalAmount: 0, memberCode: 'STU003' }, partyLabel: 'Member', partyIdLabel: 'Member ID' })
  assert.equal(d.party.label, 'Member'); assert.equal(d.party.id, 'STU003'); assert.equal(buildDocument({ business: {}, bill: { items: [] } }).party.label, 'Customer')
})

t('hooks: study centre has them, shop/service do not', () => { assert.ok(hooksFor('study_center').afterBill && hooksFor('study_center').validate); assert.deepEqual(hooksFor('shop'), {}); assert.deepEqual(hooksFor('service'), {}) })
t('membership line meta: plan → months; seat needs a valid slot; bad input refused', () => {
  const h = hooksFor('study_center'), id = '64b7f0f0f0f0f0f0f0f0f0f0'
  assert.deepEqual(h.cleanMeta({ meta: { planKey: '1m' } }, 'membership', center).meta, { planKey: '1m', months: 1 })
  assert.ok(h.cleanMeta({ meta: {} }, 'membership', center).error)
  assert.ok(h.cleanMeta({ meta: { planKey: '1m', seatId: id, slot: { start: '12:00', end: '08:00' } } }, 'membership', center).error)
  const ok = h.cleanMeta({ meta: { planKey: '1m', seatId: id, slot: { start: '08:00', end: '12:00' } } }, 'membership', center).meta
  assert.equal(ok.seatId, id); assert.equal(ok.slot.start, '08:00')
  assert.equal(h.cleanMeta({ meta: { planKey: '1m', seatId: id } }, 'membership', center).meta.slot.fullDay, true) // no slot → full day
  assert.ok(h.cleanMeta({ meta: { planKey: '1m', seatId: 'nope' } }, 'membership', center).error)
  assert.equal(h.cleanMeta({ meta: { courseId: id } }, 'course', center).meta.courseId, id); assert.equal(h.cleanMeta({}, 'fine', center).meta, undefined)
})
t('chargeable study lines validate like any other line', () => { assert.ok(cleanChargeLine({ name: '', rate: 10 }, 'membership').error); assert.ok(cleanChargeLine({ name: 'Late fee', rate: 0 }, 'fine').error); assert.equal(cleanChargeLine({ name: 'Late fee', rate: 50 }, 'fine').line.qty, 1) })
console.log(`\n${n} study configuration tests passed`)
