import { r2 } from './billing.js'
import { applyLedger } from './ledger.js'

// The ONE place that decides how money handed over at the till is split. Pure (no database) so the screen's preview, the saved bill and the tests
// all follow the same arithmetic. `balance` is the customer's single signed account balance BEFORE this bill (+ owes udhar · − holds Advance),
// i.e. already NET: udhar and advance can never both be outstanding for one customer.
//
//   advanceAsked  null → legacy automatic deduction of the Advance Balance (unless useCredit === false) · number → exactly that, capped by what is held and by the bill
//   received / returned  cash handed over / change handed back  (net = received − returned)
//   oldAsked      part of the net payment the seller collected against the PREVIOUS udhar (4th quick button / Compensate) — never a payment of this bill
//
// Returns the numbers recordSale persists: advance used, what this bill received, what goes on udhar, and what lands in the customer's ledger.
export function computeSettlement({ totalAmount, hasCustomer, balance = 0, advanceAsked = null, useCredit = true, received = null, returned = 0, paymentMode = 'full', amountPaid = 0, oldAsked = 0 }) {
  const advanceHeld = balance < 0 ? -balance : 0
  const creditUsed = !hasCustomer ? 0 : advanceAsked != null ? r2(Math.min(Math.max(advanceAsked, 0), advanceHeld, totalAmount)) : useCredit !== false ? r2(Math.min(advanceHeld, totalAmount)) : 0
  const dueNow = r2(totalAmount - creditUsed)
  let netPaid
  if (received != null) netPaid = r2(Number(received) - Number(returned || 0))
  else if (paymentMode === 'custom') netPaid = Number(amountPaid)
  else netPaid = dueNow
  if (Number.isNaN(netPaid) || netPaid < 0) return { error: 'Enter a valid amount paid (0 or more).' }
  const oldPaid = hasCustomer ? r2(Math.min(Math.max(Number(oldAsked) || 0, 0), Math.max(balance, 0), netPaid)) : 0 // can never exceed what is really owed or what was received
  const billNet = r2(netPaid - oldPaid)                          // what THIS bill receives
  const paidNow = Math.min(billNet, dueNow)
  const unpaidAmount = r2(dueNow - paidNow)                      // paid < due  → Udhar
  const extraPaid = hasCustomer ? r2(Math.max(billNet - dueNow, 0)) : 0 // paid > due → older udhar first, the rest becomes Advance Balance
  return { creditUsed, dueNow, netPaid, oldPaid, billNet, paidNow, unpaidAmount, extraPaid, paidAmount: r2(creditUsed + paidNow) }
}

// Writes ONE bill's effect on the customer's account — through the existing ledger (applyLedger), in this fixed order:
//   1) Advance Balance used  2) unpaid remainder put on udhar  3) ONE payment entry = old udhar collected + any extra paid (older udhar first, only the rest becomes Advance).
// Each step is its own immutable UdharHistory line, so nothing is rewritten and nothing is counted twice.
export async function postBillLedger({ shopId, customer, billId, items = [], paymentType = 'cash', ref, creditUsed = 0, unpaidAmount = 0, addToUdhar = false, oldPaid = 0, extraPaid = 0 }) {
  const base = { shopId, customer, source: 'billing', billId, items, paymentType }
  let last = null, udharAdded = 0, advanceAdded = 0, paidTowardsUdhar = 0
  if (customer && creditUsed > 0) last = await applyLedger({ ...base, type: 'use_credit', amount: creditUsed, note: `Advance used · Bill ${ref}` })
  if (customer && unpaidAmount > 0 && addToUdhar) {
    last = await applyLedger({ ...base, type: 'udhar', amount: unpaidAmount, note: `Bill ${ref}` })
    udharAdded = unpaidAmount
  }
  if (customer && extraPaid + oldPaid > 0) {
    last = await applyLedger({ ...base, type: 'payment', amount: r2(extraPaid + oldPaid), note: oldPaid > 0 ? `Previous udhar collected · Bill ${ref}` : `Extra paid · Bill ${ref}` })
    for (const e of last.entries) { if (e.type === 'credit') advanceAdded = r2(advanceAdded + e.amount); else paidTowardsUdhar = r2(paidTowardsUdhar + e.amount) }
  }
  return { last, udharAdded, advanceAdded, paidTowardsUdhar }
}
