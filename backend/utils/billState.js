import { r2, EPS } from './common/ledger.js'

// Paid / Udhar / Advance for a bill, given how much of its udhar is still outstanding.
export const billStateOf = (bill, remaining) => (bill.advanceAdded > 0 ? 'Advance' : remaining > EPS ? 'Udhar' : 'Paid')

// How much of the customer's CURRENT udhar belongs to each bill.
// Payments clear the oldest udhar first, so what is still owed sits on the newest bills:
// walk bills newest → oldest and hand each its unpaid amount until the customer's balance is used up.
// Bills whose unpaid part was never put on the ledger keep their own unpaid amount.
//   bills: [{ billId, unpaidAmount, createdAt }]   ledgerBillIds: Set of billIds that have a billing 'udhar' entry
export function allocateRemaining(bills, ledgerBillIds, currentBalance) {
  const out = {}
  let pool = Math.max(currentBalance || 0, 0)
  for (const b of [...bills].sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt))) {
    if (!(b.unpaidAmount > EPS)) { out[b.billId] = 0; continue }
    if (!ledgerBillIds.has(b.billId)) { out[b.billId] = r2(b.unpaidAmount); continue }
    const take = Math.min(b.unpaidAmount, pool)
    out[b.billId] = r2(take); pool = r2(pool - take)
  }
  return out
}
