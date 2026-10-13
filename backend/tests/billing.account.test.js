// Udhar account block · View-only markup · default discount config — pure logic + the real billDocument controller with stubbed models (no database).
//   node tests/billing.account.test.js
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'
import { computeBill, buildDocument, accountSummary, cleanDiscount } from '../utils/billing.js'
import { billingCapabilities, sanitizeCapabilities } from '../utils/billingConfig.js'
import { thermalHtml, a4Html, whatsappText, telegramText, smsText, shareLinks, viewOnlyHtml, accountBlock } from '../../frontend/src/features/analytics/billOutput.js'
const ok = (m) => console.log('✅', m)
const bill = (x = {}) => ({
  displayId: '#261013A0101', createdAt: new Date('2026-10-13T10:00:00+05:30'), customerName: 'Asha', customerPhone: '9876543210', status: 'udhar', paymentMethod: 'cash', transactionType: 'sale',
  items: [{ type: 'product', name: 'Sugar', qty: 1, rate: 500, total: 500, discount: 0, cost: 777, costBreakdown: [{ costPrice: 777 }] }], subtotal: 500, discount: 0, totalAmount: 500, paidAmount: 0, unpaidAmount: 500,
  notes: 'INTERNAL-NOTE', supplier: 'SUPPLIER-SECRET', ...x,
})
const docOf = (b, o = {}) => buildDocument({ business: { name: 'Raj Store' }, bill: b, payments: [], ...o })

// ── accountSummary: what the customer sees ──
{
  const a = accountSummary(bill({ balanceBefore: 200, balanceAfter: 700, receivedAmount: 0, returnedAmount: 0, creditUsed: 0 }))
  assert.deepEqual(a, { previousDue: 200, previousAdvance: 0, billAmount: 500, advanceUsed: 0, received: 0, billPaid: 0, collectedOld: 0, advanceKept: 0, returned: 0, remainingDue: 700, remainingAdvance: 0 })
  assert.equal(a.previousDue + a.billAmount - a.advanceUsed - a.received, a.remainingDue)
  ok('previous ₹200 + bill ₹500 − paid ₹0 = remaining ₹700 (current bill and old dues kept apart, nothing double-counted)')
}
{
  const a = accountSummary(bill({ balanceBefore: 200, balanceAfter: 100, paidAmount: 500, unpaidAmount: 0, receivedAmount: 600, returnedAmount: 0, creditUsed: 0 }))
  assert.equal(a.received, 600); assert.equal(a.remainingDue, 100); assert.equal(a.previousDue + a.billAmount - a.received, a.remainingDue)
  ok('paid ₹600 on a ₹500 bill: the extra ₹100 clears older udhar → remaining ₹100')
}
{
  const a = accountSummary(bill({ balanceBefore: -100, balanceAfter: 0, paidAmount: 500, unpaidAmount: 0, creditUsed: 100, receivedAmount: 400, returnedAmount: 0 }))
  assert.equal(a.previousAdvance, 100); assert.equal(a.previousDue, 0); assert.equal(a.advanceUsed, 100); assert.equal(a.received, 400); assert.equal(a.remainingDue, 0)
  ok('advance balance ₹100 used: shown as advance (not as dues); remaining ₹0')
}
{
  const a = accountSummary(bill({ balanceBefore: 0, balanceAfter: -50, paidAmount: 500, unpaidAmount: 0, receivedAmount: 550, returnedAmount: 0 }))
  assert.equal(a.remainingAdvance, 50); assert.equal(a.remainingDue, 0)
  ok('overpaid → remaining shown as an advance balance, not as dues')
  const r = accountSummary(bill({ balanceBefore: 0, balanceAfter: 500, receivedAmount: 700, returnedAmount: 200 }))
  assert.equal(r.received, 500, 'change handed back is not "received"')
  assert.equal(accountSummary(bill({ balanceBefore: 0, balanceAfter: 500, paidAmount: 80, creditUsed: 0 })).received, 80, 'older bills without receivedAmount fall back to paidAmount − advance')
}
// ── money collected against the PREVIOUS udhar is kept apart from this bill's payment (spec: never show one payment twice) ──
{
  // previous ₹183, bill ₹62, received ₹283 → ₹38 returned: bill ₹62 paid, ₹183 collected against old udhar, nothing left
  const b = bill({ totalAmount: 62, paidAmount: 62, unpaidAmount: 0, balanceBefore: 183, balanceAfter: 0, receivedAmount: 283, returnedAmount: 38, creditUsed: 0 })
  const a = accountSummary(b)
  assert.equal(a.billPaid, 62); assert.equal(a.collectedOld, 183); assert.equal(a.returned, 38); assert.equal(a.advanceKept, 0); assert.equal(a.remainingDue, 0)
  const doc = docOf(b); assert.equal(doc.totals.due, 0); assert.equal(doc.payment.status, 'Paid') // the bill itself IS paid — by its own ₹62
  const rows = accountBlock(doc).rows.map((r) => r[0])
  assert.deepEqual(rows, ['Previous Udhar', 'This bill', 'Paid for this bill', 'Old Udhar collected', 'Returned', 'Remaining Udhar'])
  for (const out of [thermalHtml(doc), a4Html(doc), whatsappText(doc), telegramText(doc), smsText(doc)]) assert.ok(out.includes('₹183') && !/Paid now/.test(out))
  ok('old udhar collected is its own line (₹183), the bill shows its own ₹62, change returned ₹38, remaining ₹0 — in every format')
}
{
  // Compensate: previous ₹183, bill ₹62, received ₹100, nothing returned → ₹38 of the change pays old udhar, ₹145 stays owed
  const a = accountSummary(bill({ totalAmount: 62, paidAmount: 62, unpaidAmount: 0, balanceBefore: 183, balanceAfter: 145, receivedAmount: 100, returnedAmount: 0, creditUsed: 0 }))
  assert.equal(a.billPaid, 62); assert.equal(a.collectedOld, 38); assert.equal(a.returned, 0); assert.equal(a.remainingDue, 145)
  assert.equal(a.previousDue + a.billAmount - a.received, a.remainingDue)
  ok('compensate: 183 + 62 − 100 = ₹145 still owed; the bill is not shown as having cleared the old udhar')
}
{
  // excess kept as Advance: previous ₹50, bill ₹62, received ₹150 kept → ₹50 old udhar, ₹38 new advance
  const a = accountSummary(bill({ totalAmount: 62, paidAmount: 62, unpaidAmount: 0, balanceBefore: 50, balanceAfter: -38, receivedAmount: 150, returnedAmount: 0, advanceAdded: 38, creditUsed: 0 }))
  assert.equal(a.collectedOld, 50); assert.equal(a.advanceKept, 38); assert.equal(a.remainingAdvance, 38); assert.equal(a.remainingDue, 0)
  ok('excess kept as Advance is not mistaken for old-udhar money (₹50 old · ₹38 advance)')
}
assert.equal(accountSummary(bill({ balanceBefore: null, balanceAfter: null })), null); assert.equal(accountSummary(bill()), null); assert.equal(accountSummary(bill({ balanceBefore: 0, balanceAfter: 0 })), null)
assert.equal(docOf(bill({ balanceBefore: 0, balanceAfter: 0 })).account, null); assert.equal(docOf(bill()).account, null)
ok('walk-in / no snapshot / nothing owed or held → no account block (a plain paid bill prints exactly as before)')
assert.equal(docOf(bill({ balanceBefore: 200, balanceAfter: 700 })).account.term, 'Udhar'); assert.equal(docOf(bill({ balanceBefore: 200, balanceAfter: 700 }), { partyLabel: 'Member' }).account.term, 'Dues')
ok('shop documents say “Udhar”, study-centre documents say “Dues”')

// ── every customer-facing output renders it from the SAME document ──
const d = docOf(bill({ balanceBefore: 200, balanceAfter: 700, receivedAmount: 0, returnedAmount: 0, creditUsed: 0 }), { terms: 'Thanks' })
const th = thermalHtml(d), a4 = a4Html(d), wa = whatsappText(d), tg = telegramText(d), sms = smsText(d), links = shareLinks(d)
for (const [n, out] of [['80mm', th], ['A4/PDF', a4], ['WhatsApp', wa], ['Telegram', tg], ['SMS', sms]]) {
  for (const t of ['Previous Udhar', '₹200', 'This bill', 'Paid now', 'Remaining Udhar', '₹700']) assert.ok(out.includes(t), `${n} shows "${t}"`)
  assert.ok(!/777|INTERNAL-NOTE|SUPPLIER-SECRET|cost|profit/i.test(out), `${n}: no cost / profit / internal data`)
}
assert.ok(th.includes('UDHAR ACCOUNT') && a4.includes('UDHAR ACCOUNT') && wa.includes('UDHAR ACCOUNT') && !sms.includes('UDHAR ACCOUNT'))
assert.ok(decodeURIComponent(links.WhatsApp).includes('Remaining Udhar: ₹700') && decodeURIComponent(links.SMS).includes('Remaining Udhar: ₹700') && decodeURIComponent(links.Telegram).includes('Remaining Udhar: ₹700'))
ok('80mm · A4/PDF · WhatsApp · Telegram · SMS all show previous / this bill / paid now / remaining; no cost, profit or internal notes anywhere')
assert.deepEqual(accountBlock(d).rows.map((r) => r[0]), ['Previous Udhar', 'This bill', 'Paid now', 'Remaining Udhar'])
const plain = docOf(bill({ totalAmount: 500, paidAmount: 500, unpaidAmount: 0, status: 'paid', balanceBefore: 0, balanceAfter: 0 }))
for (const out of [thermalHtml(plain), a4Html(plain), whatsappText(plain), smsText(plain)]) assert.ok(!/ACCOUNT|Previous Udhar|Remaining Udhar/.test(out))
ok('a bill with no udhar involved is unchanged in every format')
const adv = docOf(bill({ balanceBefore: -100, balanceAfter: 0, paidAmount: 500, unpaidAmount: 0, creditUsed: 100, receivedAmount: 400, returnedAmount: 0 }))
assert.ok(thermalHtml(adv).includes('Previous Advance') && thermalHtml(adv).includes('Advance used'))
ok('advance usage is labelled as advance in the output')

// ── View Only markup ──
const vo = viewOnlyHtml(th)
assert.ok(vo.includes('@media print{html,body{display:none!important}}') && vo.includes('Asha') === th.includes('Asha') && vo.length > th.length && !th.includes('display:none!important'))
assert.equal(viewOnlyHtml(a4).split('</head>').length, 2)
ok('View Only = the same 80mm / A4 markup + a print-blocking rule (the print markup itself is untouched)')

// ── default discount: per-shop config, applied once by the existing engine ──
assert.equal(billingCapabilities({}, 'shop').defaultDiscountEnabled, false); assert.equal(billingCapabilities({}, 'shop').discount, false)
const shopA = { billing: { capabilities: { discount: true, defaultDiscountEnabled: true, defaultDiscountType: 'percent', defaultDiscountValue: 10 } } }
const shopB = { billing: { capabilities: { discount: true, defaultDiscountEnabled: true, defaultDiscountType: 'fixed', defaultDiscountValue: 50 } } }
const A = billingCapabilities(shopA, 'shop'), B = billingCapabilities(shopB, 'shop'), C = billingCapabilities({}, 'shop')
assert.deepEqual([A.defaultDiscountType, A.defaultDiscountValue, B.defaultDiscountType, B.defaultDiscountValue, C.defaultDiscountEnabled], ['percent', 10, 'fixed', 50, false])
ok('each shop keeps its own default discount (10% · ₹50 · none) — read from that account only')
assert.deepEqual(sanitizeCapabilities({ defaultDiscountEnabled: 'yes', defaultDiscountType: 'weird', defaultDiscountValue: 'abc' }), { defaultDiscountType: 'fixed', defaultDiscountValue: 0 })
assert.equal(sanitizeCapabilities({ defaultDiscountType: 'percent', defaultDiscountValue: 250 }).defaultDiscountValue, 100)
assert.equal(sanitizeCapabilities({ defaultDiscountType: 'fixed', defaultDiscountValue: -9 }).defaultDiscountValue, 0)
assert.equal(sanitizeCapabilities({ defaultDiscountType: 'fixed', defaultDiscountValue: 12.345 }).defaultDiscountValue, 12.35)
assert.equal(sanitizeCapabilities({ defaultDiscountEnabled: true }).defaultDiscountEnabled, true); assert.ok(!('defaultDiscountEnabled' in sanitizeCapabilities({ defaultDiscountEnabled: 'x' })))
ok('config is validated: % capped at 100, negatives → 0, non-booleans ignored')
{ // pre-filled into the bill's ONE discount field: identical to the seller typing it, so it is applied once
  const line = [{ type: 'product', rate: 500, qty: 2 }]
  const typed = computeBill(line, { discount: { type: 'percent', value: 10 } }), prefilled = computeBill(line, { discount: cleanDiscount({ type: A.defaultDiscountType, value: A.defaultDiscountValue }) })
  assert.deepEqual(prefilled, typed); assert.equal(prefilled.total, 900); assert.equal(prefilled.discount, 100)
  assert.equal(computeBill(line, { discount: { type: 'fixed', value: B.defaultDiscountValue } }).total, 950)
  const withTax = computeBill(line, { discount: { type: 'percent', value: 10 }, taxRate: 18 }); assert.equal(withTax.total, 1062) // 1000 − 100 = 900, +18% = 1062 — order unchanged
  assert.equal(computeBill([{ type: 'product', rate: 30, qty: 1 }], { discount: { type: 'fixed', value: 50 } }).total, 0, 'a fixed default can never push a total below ₹0')
}
ok('default discount through the existing engine: 10% of ₹1,000 = ₹900 once · fixed ₹50 → ₹950 · tax order unchanged · never below ₹0')

// ── billDocument (the real controller; models stubbed in memory) ──
const { default: Bill } = await import('../models/Bill.js'), { default: Sale } = await import('../models/Sale.js'), { default: UdharHistory } = await import('../models/UdharHistory.js')
const { billDocument } = await import('../controllers/billingController.js')
const chain = (rows) => { const c = { select: () => c, sort: () => c, populate: () => c, lean: async () => rows, then: (f) => f(rows) }; return c }
const run = async (stored, history) => {
  Bill.findOne = () => chain(stored); Sale.find = () => chain([]); UdharHistory.find = () => chain(history)
  let out; await billDocument({ params: { billId: 'X' }, sellerType: 'shop', sellerAccount: { _id: 's1', shopName: 'Raj Store', phone: '9' } }, { json: (v) => { out = v }, status: () => ({ json: (v) => { out = v } }) }, (e) => { throw e })
  return out
}
const stored = (x) => ({ billId: '261013A0101', shopId: 's1', customerId: 'c1', customerName: 'Asha', status: 'udhar', paymentMethod: 'cash', totalAmount: 500, paidAmount: 0, unpaidAmount: 500, creditUsed: 0, items: [{ type: 'product', name: 'Sugar', qty: 1, rate: 500, total: 500, cost: 777 }], subtotal: 500, createdAt: new Date(), ...x })
{
  const withSnap = await run(stored({ balanceBefore: 200, balanceAfter: 700, receivedAmount: 0, returnedAmount: 0 }), [])
  assert.equal(withSnap.account.previousDue, 200); assert.equal(withSnap.account.remainingDue, 700)
  ok('saved bill → document uses its frozen snapshot (previous ₹200 → remaining ₹700)')
  const legacy = await run(stored({ balanceAfter: 700, receivedAmount: 0, returnedAmount: 0 }), [{ delta: 500 }]) // older bill: the ledger shows this bill itself posted +₹500
  assert.equal(legacy.account.previousDue, 200); assert.equal(legacy.account.remainingDue, 700)
  const legacy2 = await run(stored({ balanceAfter: 0, paidAmount: 500, unpaidAmount: 0, creditUsed: 100, status: 'paid' }), [{ delta: 100 }, { delta: -0 }])
  assert.equal(legacy2.account.previousAdvance, 100)
  ok('older bills (no snapshot): previous balance = balanceAfter − what that bill itself posted to the ledger; read-only')
  const none = await run(stored({ customerId: null, balanceAfter: null }), []); assert.equal(none.account, null)
  const json = JSON.stringify(withSnap); assert.ok(!/777|"cost"|costBreakdown/.test(json)); ok('the served document carries no cost or profit data')
}
console.log('\nAll account / view-only / default-discount tests passed')
