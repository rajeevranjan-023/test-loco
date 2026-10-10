// Payment badge for a Bill: Paid / Udhar (balance pushed to ledger) / Pending (unpaid, not on ledger)
export const payLabel = (b) => (b.paymentStatus === 'paid' ? 'Paid' : b.creditId ? 'Udhar' : 'Pending')
