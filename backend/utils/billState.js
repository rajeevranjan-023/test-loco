import { r2, EPS } from './ledger.js'

export const billStateOf = (bill, remaining) => (bill.advanceAdded > 0 ? 'Advance' : remaining > EPS ? 'Udhar' : 'Paid')

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
