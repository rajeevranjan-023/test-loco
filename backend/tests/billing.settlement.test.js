import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'
const { default: Udhar } = await import('../models/Udhar.js')
const { default: UdharHistory } = await import('../models/UdharHistory.js')
const { default: Customer } = await import('../models/Customer.js')
const { computeSettlement, postBillLedger } = await import('../utils/settlement.js')
const { accountSummary } = await import('../utils/billing.js')
const ok = (m) => console.log('✅', m)

// ── in-memory stand-ins: one customer account per shop, append-only history ──
let acct, hist, custDoc
const reset = (balance = 0) => { acct = balance === null ? null : { totalAmount: balance }; hist = []; custDoc = { creditBalance: balance < 0 ? -balance : 0 } }
Udhar.findOne = async () => (acct ? Object.assign(Object.create(Udhar.prototype), {}) && makeDoc() : null)
const makeDoc = () => { const d = acct ? { ...acct } : null; return d && Object.assign(d, { save: async function () { acct = { totalAmount: this.totalAmount } } }) }
Udhar.prototype.save = async function () { acct = { totalAmount: this.totalAmount } }
UdharHistory.insertMany = async (rows) => { hist.push(...rows); return rows }
Customer.updateOne = async (_f, u) => { custDoc = { ...custDoc, ...u.$set } }
const CUST = { _id: 'c1', name: 'Asha', phone: '' }

// run ONE bill exactly like recordSale: settle, then post to the ledger. Returns what was persisted.
async function bill({ total, balance, ...pay }) {
  reset(balance)
  const st = computeSettlement({ totalAmount: total, hasCustomer: true, balance, ...pay })
  assert.ok(!st.error, st.error)
  const posted = await postBillLedger({ shopId: 's1', customer: CUST, billId: 'B1', ref: 'B1', creditUsed: st.creditUsed, unpaidAmount: st.unpaidAmount, addToUdhar: st.unpaidAmount > 0, oldPaid: st.oldPaid, extraPaid: st.extraPaid })
  const after = acct ? acct.totalAmount : balance
  return { st, posted, after, hist, advanceHeld: after < 0 ? -after : 0, owes: after > 0 ? after : 0 }
}

// ── 1. 4th button, net UDHAR: previous ₹183, bill ₹62, received ₹100 + ₹183 added = ₹283 (₹38 change returned) ──
{
  const r = await bill({ total: 62, balance: 183, received: 283, returned: 38, oldAsked: 183, advanceAsked: 0 })
  assert.equal(r.st.paidAmount, 62); assert.equal(r.st.unpaidAmount, 0); assert.equal(r.st.oldPaid, 183); assert.equal(r.st.extraPaid, 0)
  assert.equal(r.owes, 0); assert.equal(r.advanceHeld, 0); assert.equal(r.posted.paidTowardsUdhar, 183); assert.equal(r.posted.advanceAdded, 0)
  assert.equal(hist.length, 1); assert.equal(hist[0].type, 'payment'); assert.equal(hist[0].amount, 183)
  ok('4th button: ₹283 received = ₹62 bill + ₹183 old udhar (+₹38 returned) → bill paid once, old udhar cleared, ONE ledger line of ₹183, no advance')
}
// ── 2. the bill has an unpaid balance — the ₹183 must not also be counted as payment of the bill ──
{
  const r = await bill({ total: 62, balance: 183, received: 203, returned: 0, oldAsked: 183, advanceAsked: 0 }) // typed ₹20 + button ₹183
  assert.equal(r.st.paidAmount, 20, 'only the typed ₹20 pays the bill'); assert.equal(r.st.unpaidAmount, 42); assert.equal(r.st.oldPaid, 183)
  assert.equal(r.after, 42, 'old udhar gone, only the bill\'s unpaid ₹42 is owed'); assert.deepEqual(hist.map((h) => [h.type, h.amount]), [['udhar', 42], ['payment', 183]])
  ok('bill part-paid (₹20) + ₹183 old udhar: old udhar settled, bill ₹42 still owed — nothing counted twice')
}
// ── 3. default Return Amount untouched: received ₹100, change ₹38 returned, old udhar stays ₹183 ──
{
  const r = await bill({ total: 62, balance: 183, received: 100, returned: 38, oldAsked: 0, advanceAsked: 0 })
  assert.equal(r.st.oldPaid, 0); assert.equal(r.st.extraPaid, 0); assert.equal(r.after, 183); assert.equal(hist.length, 0)
  ok('default (no Compensate): ₹38 returned as change, old udhar untouched at ₹183, no ledger entry')
}
// ── 4. Compensate: nothing returned → the ₹38 pays old udhar → ₹145 left ──
{
  const r = await bill({ total: 62, balance: 183, received: 100, returned: 0, oldAsked: 38, advanceAsked: 0 })
  assert.equal(r.st.paidAmount, 62); assert.equal(r.after, 145); assert.equal(r.advanceHeld, 0); assert.equal(hist.length, 1); assert.equal(hist[0].amount, 38)
  // same result even if a client sent no oldUdharPaid at all: the server pays older udhar first with any extra
  const r2 = await bill({ total: 62, balance: 183, received: 100, returned: 0, advanceAsked: 0 })
  assert.equal(r2.after, 145); assert.equal(r2.posted.advanceAdded, 0)
  ok('Compensate: 183 + 62 − 100 = ₹145 still owed; the ₹38 is not turned into Advance Balance')
}
// ── 5. payment clears everything, excess ₹38: return it / keep it / custom ──
{
  const kept = await bill({ total: 62, balance: 50, received: 150, returned: 0, oldAsked: 50, advanceAsked: 0 })
  assert.equal(kept.after, -38); assert.equal(kept.posted.advanceAdded, 38); assert.equal(kept.posted.paidTowardsUdhar, 50); assert.equal(custDoc.creditBalance, 38)
  const back = await bill({ total: 62, balance: 50, received: 150, returned: 38, oldAsked: 50, advanceAsked: 0 })
  assert.equal(back.after, 0); assert.equal(back.posted.advanceAdded, 0); assert.equal(custDoc.creditBalance, 0)
  const part = await bill({ total: 62, balance: 50, received: 150, returned: 20, oldAsked: 50, advanceAsked: 0 })
  assert.equal(part.after, -18); assert.equal(part.posted.advanceAdded, 18)
  ok('excess ₹38 after clearing everything: kept → Advance ₹38 · returned → ₹0 · custom ₹20 back → Advance ₹18 (never both returned and kept)')
}
// ── 6. 4th button, net ADVANCE: advance ₹100 − udhar ₹50 = net advance ₹50; bill ₹62 ──
{
  const r = await bill({ total: 62, balance: -50, received: 12, returned: 0, advanceAsked: 50 })
  assert.equal(r.st.creditUsed, 50); assert.equal(r.st.paidAmount, 62); assert.equal(r.st.unpaidAmount, 0); assert.equal(r.after, 0)
  assert.deepEqual(hist.map((h) => [h.type, h.amount, h.paymentType]), [['credit', 50, 'advance']])
  ok('net Advance ₹50 applied once to a ₹62 bill: ₹12 paid in cash, advance consumed, one "advance" ledger line')
  const big = await bill({ total: 62, balance: -500, received: 0, returned: 0, advanceAsked: 999 })
  assert.equal(big.st.creditUsed, 62, 'never more than the bill'); assert.equal(big.advanceHeld, 438); assert.equal(custDoc.creditBalance, 438)
  ok('advance larger than the bill: only ₹62 used, ₹438 preserved on the account')
  const less = await bill({ total: 62, balance: -30, received: 0, returned: 0, advanceAsked: 30, addRemainingToUdhar: true })
  assert.equal(less.st.creditUsed, 30); assert.equal(less.st.unpaidAmount, 32); assert.equal(less.after, 32)
  ok('advance smaller than the bill: ₹30 applied, the ₹32 remainder stays payable')
}
// ── 7. advance is never deducted twice, and is only used when the seller asked for it ──
{
  const none = await bill({ total: 62, balance: -50, received: 62, returned: 0, advanceAsked: 0 })
  assert.equal(none.st.creditUsed, 0); assert.equal(none.after, -50 - 0, 'untouched advance stays ₹50'); assert.equal(hist.length, 0)
  const auto = await bill({ total: 62, balance: -50, received: 12, returned: 0 }) // legacy client (no advanceToUse): automatic deduction, exactly once
  assert.equal(auto.st.creditUsed, 50); assert.equal(auto.after, 0)
  ok('advanceToUse = 0 uses no advance (no silent auto-deduction); legacy clients that send nothing still get it exactly once')
}
// ── 8. guards: old-udhar collection can never exceed what is owed / received; no customer → no ledger ──
{
  assert.equal(computeSettlement({ totalAmount: 62, hasCustomer: true, balance: 20, received: 500, returned: 0, oldAsked: 500, advanceAsked: 0 }).oldPaid, 20)
  assert.equal(computeSettlement({ totalAmount: 62, hasCustomer: true, balance: 0, received: 62, returned: 0, oldAsked: 99, advanceAsked: 0 }).oldPaid, 0)
  assert.equal(computeSettlement({ totalAmount: 62, hasCustomer: true, balance: -40, received: 62, returned: 0, oldAsked: 40, advanceAsked: 0 }).oldPaid, 0, 'a customer in advance owes nothing to collect')
  assert.equal(computeSettlement({ totalAmount: 62, hasCustomer: true, balance: 100, received: 30, returned: 0, oldAsked: 100, advanceAsked: 0 }).oldPaid, 30, 'cannot collect more than was received')
  assert.ok(computeSettlement({ totalAmount: 62, hasCustomer: true, balance: 0, received: 10, returned: 20 }).error)
  const w = computeSettlement({ totalAmount: 62, hasCustomer: false, balance: 0, received: 100, returned: 0, oldAsked: 50, advanceAsked: 30 })
  assert.equal(w.oldPaid, 0); assert.equal(w.creditUsed, 0); assert.equal(w.extraPaid, 0)
  ok('server caps old-udhar collection by balance and by money received; walk-in bills never touch a ledger; returning more than received is rejected')
}
// ── 9. reopen: the account and the saved bill agree ──
{
  const r = await bill({ total: 62, balance: 183, received: 100, returned: 0, oldAsked: 38, advanceAsked: 0 })
  const saved = { totalAmount: 62, paidAmount: r.st.paidAmount, unpaidAmount: r.st.unpaidAmount, creditUsed: r.st.creditUsed, advanceAdded: r.posted.advanceAdded, receivedAmount: 100, returnedAmount: 0, balanceBefore: 183, balanceAfter: r.after }
  const a = accountSummary(saved)
  assert.equal(a.billPaid, 62); assert.equal(a.collectedOld, 38); assert.equal(a.remainingDue, 145); assert.equal(acct.totalAmount, 145)
  ok('saved bill snapshot (previous ₹183 → remaining ₹145) matches the account after reload; history lines are append-only (none deleted)')
}
console.log('\nAll settlement / ledger persistence tests passed')
process.exit(0)
