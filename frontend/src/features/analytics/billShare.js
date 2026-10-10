const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Opens the browser print dialog with a compact receipt (works for thermal printers too)
export function printBill(b) {
  const w = window.open('', '_blank', 'width=380,height=700')
  if (!w) return false
  const s = b.summary
  const rows = b.items.map((i) => `<tr><td>${esc(i.name)}</td><td align="right">${i.qty}</td><td align="right">${i.price}</td><td align="right">${i.total}</td></tr>`).join('')
  const line = (l, v, bold) => `<tr><td colspan="3" align="right">${bold ? `<b>${l}</b>` : l}</td><td align="right">${bold ? `<b>${v}</b>` : v}</td></tr>`
  w.document.write(`<html><head><title>${esc(b.id)}</title><style>body{font:12px monospace;padding:12px}table{width:100%;border-collapse:collapse}td,th{padding:3px 0;border-bottom:1px dashed #bbb}h3,p{margin:2px 0;text-align:center}</style></head><body>
    <h3>${esc(b.shopName)}</h3><p>${esc(b.id)} · ${when(b.date)}</p><p>${b.customer ? esc(b.customer.name) + (b.customer.phone ? ' · ' + esc(b.customer.phone) : '') : 'Walk-in'}</p><br/>
    <table><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Price</th><th align="right">Total</th></tr>${rows}
    ${line('Subtotal', rs(s.subtotal))}${s.discount ? line('Discount', '-' + rs(s.discount)) : ''}${line('Total', rs(s.total), true)}
    ${s.advanceUsed ? line('Advance used', '-' + rs(s.advanceUsed)) : ''}${line('Received (' + esc(b.paymentMethod) + ')', rs(s.amountReceived))}${s.returnAmount ? line('Returned', rs(s.returnAmount)) : ''}
    ${s.remainingUdhar ? line('Udhar pending', rs(s.remainingUdhar), true) : ''}${s.advanceAdded ? line('Added to advance', rs(s.advanceAdded)) : ''}</table>
    <p style="margin-top:10px">Thank you! Visit again.</p></body></html>`)
  w.document.close(); w.focus(); setTimeout(() => w.print(), 250)
  return true
}

// wa.me link with a ready-to-send bill summary (opens the customer's chat when a phone number is known)
export function whatsappLink(b) {
  const s = b.summary
  const lines = [
    `*${b.shopName}*`, `Bill ${b.id} · ${when(b.date)}`, '',
    ...b.items.map((i) => `• ${i.name} × ${i.qty} = ${rs(i.total)}`), '',
    `*Total: ${rs(s.total)}*`,
    s.remainingUdhar ? `Udhar pending: ${rs(s.remainingUdhar)}` : s.advanceAdded ? `Advance balance added: ${rs(s.advanceAdded)}` : 'Paid in full ✅',
    '', 'Thank you! 🙏',
  ]
  const digits = (b.customer?.phone || '').replace(/\D/g, '')
  const num = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`
}
export { when as billWhen }
