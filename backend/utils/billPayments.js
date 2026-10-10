import UdharHistory from '../models/UdharHistory.js'
import { r2 as round2 } from './billing.js'

// What was paid, per method, in order: what the customer paid at billing (split or single), advance used, then every later instalment from the ledger.
export async function paymentsOf(bill) {
  const out = []
  if (bill.payments?.length) out.push(...bill.payments.map((p) => ({ method: p.method, amount: p.amount, at: bill.createdAt })))
  else if (bill.receivedAmount != null) { const net = round2(bill.receivedAmount - (bill.returnedAmount || 0)); const paid = Math.min(net, round2(bill.totalAmount - (bill.creditUsed || 0))); if (paid > 0) out.push({ method: bill.paymentMethod, amount: paid, at: bill.createdAt }) }
  else if (bill.paidAmount - (bill.creditUsed || 0) > 0) out.push({ method: bill.paymentMethod, amount: round2(bill.paidAmount - (bill.creditUsed || 0)), at: bill.createdAt })
  if (bill.creditUsed > 0) out.push({ method: 'advance', amount: bill.creditUsed, at: bill.createdAt })
  const later = await UdharHistory.find({ shopId: bill.shopId, billId: bill.billId, type: 'payment', source: 'manual' }).sort({ date: 1 }).lean()
  for (const e of later) out.push({ method: e.paymentType || 'cash', amount: e.amount, at: e.date })
  return out
}
