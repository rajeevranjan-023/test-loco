// Every customer-facing rendering of a bill — 80mm thermal, A4 invoice, WhatsApp / Telegram text, SMS — in ONE place.
// All of them take the document built by billCore.buildDocument (whitelisted: no cost, batches, supplier or internal notes),
// so none of them can leak internal data. Pure functions (no DOM) so they are unit-tested in node.
export const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const P = (d) => d.party?.label || 'Customer' // what this business calls the person (Customer / Member)
const dateOnly = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTime = (d) => `${dateOnly(d)}, ${new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()}`
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const qtyText = (i) => `${i.qty}${i.unit ? ' ' + i.unit : ''}`
const ICON = { product: '📦', service: '🔧', material: '🧰', labour: '👷', other: '➕' }
const sectionTotal = (s) => s.items.reduce((a, i) => a + i.total, 0)
const titleCase = (t) => t.charAt(0) + t.slice(1).toLowerCase()
// Part of a bill paid out of the customer's Advance Balance is labelled "From Adv. Bal." on every output (billCore names it 'Advance').
// A bill paid ONLY from the advance must not read "Payment: Cash".
const ADV = 'From Adv. Bal.'
const payLabel = (m) => (m === 'Advance' ? ADV : m)
const payText = (d) => { const p = d.payment.payments || []; return p.length && p.every((x) => x.method === 'Advance') ? ADV : d.payment.method }
// Udhar account block (previous dues · this bill · paid now · remaining) — present only when the document carries one. Same rows in every format.
const acct = (d) => {
  const a = d.account; if (!a) return null
  const t = a.term || 'Udhar'
  return { title: `${t.toUpperCase()} ACCOUNT`, rows: [
    ...(a.previousDue > 0 ? [[`Previous ${t}`, rs(a.previousDue)]] : a.previousAdvance > 0 ? [['Previous Advance', rs(a.previousAdvance)]] : []),
    ['This bill', rs(a.billAmount)],
    ...(a.advanceUsed > 0 ? [[`Advance used (${ADV})`, `-${rs(a.advanceUsed)}`]] : []),
    // money collected against the PREVIOUS udhar is shown on its own line — it is never presented as a payment of this bill
    ...(a.collectedOld > 0 ? [['Paid for this bill', rs(a.billPaid)], [`Old ${t} collected`, rs(a.collectedOld)]] : [['Paid now', rs(a.received)]]),
    ...(a.advanceKept > 0 ? [['Kept as Advance', rs(a.advanceKept)]] : []),
    ...(a.returned > 0 ? [['Returned', rs(a.returned)]] : []),
    ...(a.remainingDue > 0 || !(a.remainingAdvance > 0) ? [[`Remaining ${t}`, rs(a.remainingDue), true]] : []),
    ...(a.remainingAdvance > 0 ? [['Advance balance', rs(a.remainingAdvance), a.remainingDue <= 0]] : []),
  ] }
}
export const accountBlock = acct // the same rows the on-screen preview shows
const tail = (d) => ({ rows: [['Subtotal', rs(d.totals.subtotal)], ...(d.totals.discount > 0 ? [['Discount', `-${rs(d.totals.discount)}`]] : []), ...(d.totals.tax ? [[`${d.totals.tax.name}${d.totals.tax.rate ? ` (${d.totals.tax.rate}%)` : ''}`, rs(d.totals.tax.amount)]] : [])] })

/* ───────────── 80mm thermal receipt ───────────── */
// Compact two-line item rows in a 72mm printable column; no tables, no wasted whitespace; @page height auto so the roll is cut right after the last line.
export function thermalHtml(d) {
  const row = (l, r, cls = '') => `<div class="r ${cls}"><span>${l}</span><span>${r}</span></div>`
  const hr = '<div class="hr"></div>'
  const body = d.sections.map((s) => `<div class="h">${esc(s.title)}</div>` + s.items.map((i) => `<div class="n">${esc(i.name)}</div>${i.description ? `<div class="d">${esc(i.description)}</div>` : ''}` +
    (i.included ? row('included in service', '') : row(`${esc(qtyText(i))} × ${rs(i.rate)}`, rs(i.total + i.discount))) + (i.discount > 0 ? row('  discount', `-${rs(i.discount)}`) : '')).join('')).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.billNo)}</title><style>
@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}
body{width:72mm;margin:0 auto;padding:3mm 0 4mm;font:11.5px/1.3 'Courier New',ui-monospace,monospace;color:#000}
.c{text-align:center}.b{font-weight:700}.big{font-size:14px}.hr{border-top:1px dashed #000;margin:2mm 0}
.r{display:flex;justify-content:space-between;gap:6px}.r span:first-child{flex:1;min-width:0}.r span:last-child{white-space:nowrap}
.h{font-weight:700;margin-top:2mm}.n{word-break:break-word}.d{font-size:10px;opacity:.8;word-break:break-word}.t{font-size:14px;font-weight:700}
</style></head><body>
<div class="c b big">${esc(d.business.name.toUpperCase())}</div>${d.business.phone ? `<div class="c">${esc(d.business.phone)}</div>` : ''}${d.business.address ? `<div class="c">${esc(d.business.address)}</div>` : ''}${hr}
${row('Bill:', `#${esc(String(d.billNo).replace(/^#/, ''))}`)}${row('Date:', esc(dateTime(d.date)))}${row(`${P(d)}:`, esc(d.customer.name))}${d.party?.id ? row(`${d.party.idLabel || 'ID'}:`, esc(d.party.id)) : ''}${d.customer.phone ? row('Mobile:', esc(d.customer.phone)) : ''}${d.context.map((c) => row(`${esc(c.label)}:`, esc(c.value))).join('')}${hr}
${body}${hr}
${tail(d).rows.map(([l, v]) => row(l, v)).join('')}${hr}${row('TOTAL', rs(d.totals.total), 't')}${hr}
${row('Paid', rs(d.totals.paid))}${d.totals.due > 0 ? row('Due', rs(d.totals.due), 'b') : ''}${hr}
<div>Payment: ${esc(payText(d))}</div><div>Status: ${esc(d.payment.status)}</div>${d.payment.payments.length > 1 ? d.payment.payments.map((p) => row(`  ${esc(payLabel(p.method))}`, rs(p.amount))).join('') : ''}
${(() => { const a = acct(d); return a ? `${hr}<div class="h">${esc(a.title)}</div>${a.rows.map(([l, v, b]) => row(esc(l), v, b ? 'b' : '')).join('')}` : '' })()}
${d.terms ? `${hr}<div class="d">${esc(d.terms)}</div>` : ''}<div class="c" style="margin-top:3mm">Thank you!</div></body></html>`
}

/* ───────────── A4 invoice ───────────── */
export function a4Html(d) {
  const sec = (s) => `<h3>${esc(s.title)}</h3><table><thead><tr><th class="l">Item</th><th>Qty</th><th>Rate</th><th>Disc.</th><th>Total</th></tr></thead><tbody>${s.items.map((i) =>
    `<tr><td class="l"><b>${esc(i.name)}</b>${i.description ? `<div class="d">${esc(i.description)}</div>` : ''}</td><td>${esc(qtyText(i))}</td><td>${i.included ? '—' : rs(i.rate)}</td><td>${i.discount > 0 ? `-${rs(i.discount)}` : '—'}</td><td>${i.included ? 'Included' : rs(i.total)}</td></tr>`).join('')}</tbody></table>`
  const sum = (l, v, cls = '') => `<tr class="${cls}"><td>${l}</td><td>${v}</td></tr>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.billNo)}</title><style>
@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font:13px/1.45 'Inter','Segoe UI',Arial,sans-serif;color:#1f2937}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #f97316;padding-bottom:10px}
.biz{display:flex;gap:12px;align-items:center}.biz img{height:56px;max-width:120px;object-fit:contain}.biz h1{margin:0;font-size:22px;color:#111}.muted{color:#6b7280;font-size:12px}
.inv{text-align:right}.inv h2{margin:0;font-size:20px;letter-spacing:.06em;color:#f97316}
.meta{display:flex;justify-content:space-between;gap:16px;margin:14px 0}.meta .box{flex:1;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px}.meta b{display:block;font-size:11px;letter-spacing:.06em;color:#6b7280;margin-bottom:2px}
h3{margin:16px 0 4px;font-size:12px;letter-spacing:.08em;color:#2f6feb}table{width:100%;border-collapse:collapse}th{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;text-align:right;border-bottom:1px solid #d1d5db;padding:6px 8px}
td{text-align:right;padding:7px 8px;border-bottom:1px solid #eef0f3;vertical-align:top}th.l,td.l{text-align:left}.d{font-size:11.5px;color:#6b7280;font-weight:400}
.sum{width:48%;margin:16px 0 0 auto}.sum td{border:0;padding:4px 8px}.sum td:first-child{text-align:left;color:#4b5563}.sum .tot td{border-top:2px solid #111;font-size:16px;font-weight:700;color:#111;padding-top:8px}.sum .due td{color:#d92d20;font-weight:700}
.pay{display:flex;justify-content:space-between;gap:16px;margin-top:14px;font-size:12.5px}.pill{display:inline-block;border-radius:999px;padding:2px 10px;font-weight:600;background:#e3f7ec;color:#12a05c}.pill.warn{background:#fff1dc;color:#e58a00}.pill.bad{background:#fde8e8;color:#d92d20}
.foot{margin-top:28px;border-top:1px solid #e5e7eb;padding-top:10px;text-align:center;color:#4b5563;font-size:12px}tr{page-break-inside:avoid}
</style></head><body>
<div class="top"><div class="biz">${d.business.logoUrl ? `<img src="${esc(d.business.logoUrl)}" alt="">` : ''}<div><h1>${esc(d.business.name)}</h1>${d.business.address ? `<div class="muted">${esc(d.business.address)}</div>` : ''}${d.business.phone ? `<div class="muted">${esc(d.business.phone)}</div>` : ''}</div></div>
<div class="inv"><h2>INVOICE</h2><div><b>#${esc(String(d.billNo).replace(/^#/, ''))}</b></div><div class="muted">${esc(dateTime(d.date))}</div></div></div>
<div class="meta"><div class="box"><b>BILLED TO</b>${esc(d.customer.name)}${d.party?.id ? `<div class="muted">${esc(d.party.idLabel || 'ID')}: ${esc(d.party.id)}</div>` : ''}${d.customer.phone ? `<div class="muted">${esc(d.customer.phone)}</div>` : ''}</div>${d.context.length ? `<div class="box"><b>DETAILS</b>${d.context.map((c) => `<div>${esc(c.label)}: <b style="display:inline;font-size:13px;color:#111;letter-spacing:0">${esc(c.value)}</b></div>`).join('')}</div>` : ''}</div>
${d.sections.map(sec).join('')}
<table class="sum">${tail(d).rows.map(([l, v]) => sum(esc(l), esc(v))).join('')}${sum('Grand Total', rs(d.totals.total), 'tot')}${sum('Amount Paid', rs(d.totals.paid))}${d.totals.due > 0 ? sum('Outstanding', rs(d.totals.due), 'due') : ''}</table>
<div class="pay"><div>Payment: <b>${esc(payText(d))}</b>${d.payment.payments.length > 1 ? ` <span class="muted">(${d.payment.payments.map((p) => `${esc(payLabel(p.method))} ${rs(p.amount)}`).join(', ')})</span>` : ''}</div><div>Status: <span class="pill ${d.payment.status === 'Paid' ? '' : d.payment.status === 'Partial' ? 'warn' : 'bad'}">${esc(d.payment.status)}</span></div></div>
${(() => { const a = acct(d); return a ? `<table class="sum acct"><tr><td colspan="2" style="font-size:11px;letter-spacing:.08em;color:#2f6feb;font-weight:700">${esc(a.title)}</td></tr>${a.rows.map(([l, v, b]) => sum(esc(l), esc(v), b ? 'tot' : '')).join('')}</table>` : '' })()}
<div class="foot">${d.terms ? `<div style="margin-bottom:6px">${esc(d.terms)}</div>` : ''}Thank you for choosing ${esc(d.business.name)}.</div></body></html>`
}

/* ───────────── WhatsApp / Telegram (structured text) ───────────── */
const BAR = '━━━━━━━━━━━━━━━━━━'
export function whatsappText(d) {
  const L = [`🧾 ${d.business.name.toUpperCase()}`, BAR, `Bill: #${String(d.billNo).replace(/^#/, '')}`, `Date: ${dateOnly(d.date)}`, `${P(d)}: ${d.customer.name}`, ...(d.party?.id ? [`${d.party.idLabel || 'ID'}: ${d.party.id}`] : []), ...d.context.map((c) => `${c.label}: ${c.value}`), '']
  for (const s of d.sections) {
    L.push(`${ICON[s.key]} ${s.title}`)
    for (const i of s.items) {
      L.push(`• ${i.name}`)
      if (i.description) L.push(`  ${i.description}`)
      L.push(i.included ? '  included in service' : `  ${qtyText(i)} × ${rs(i.rate)}${i.discount > 0 ? ` − ${rs(i.discount)}` : ''} = ${rs(i.total)}`)
    }
    L.push('')
  }
  L.push(BAR, ...tail(d).rows.map(([l, v]) => `${l}: ${v}`), `Total: ${rs(d.totals.total)}`, '', `Paid: ${rs(d.totals.paid)}`)
  if (d.totals.due > 0) L.push(`Due: ${rs(d.totals.due)}`)
  L.push('', `Payment: ${payText(d)}`, `Status: ${d.payment.status}`)
  { const a = acct(d); if (a) L.push('', a.title, ...a.rows.map(([l, v]) => `${l}: ${v}`)) }
  L.push('', `Thank you for choosing ${d.business.name}.`)
  if (d.terms) L.push('', d.terms)
  return L.join('\n')
}
export const telegramText = whatsappText // same structured text — Telegram renders it as-is

/* ───────────── SMS (compact) ───────────── */
export function smsText(d) {
  const L = [`${d.business.name} - Bill #${String(d.billNo).replace(/^#/, '')}`, '', `${P(d)}: ${d.customer.name}`, '']
  for (const s of d.sections) L.push(`${titleCase(s.title)}: ${rs(sectionTotal(s))}`)
  L.push('', ...tail(d).rows.map(([l, v]) => `${l}: ${v.replace('-', '')}`), `Total: ${rs(d.totals.total)}`, `Paid: ${rs(d.totals.paid)}`)
  if (d.totals.due > 0) L.push(`Due: ${rs(d.totals.due)}`)
  L.push('', `Payment: ${payText(d)}`, `Status: ${d.payment.status}`)
  { const a = acct(d); if (a) L.push('', ...a.rows.map(([l, v]) => `${l}: ${v.replace('-', '')}`)) }
  return L.join('\n')
}

/* ───────────── share links ───────────── */
const phone10 = (p) => String(p || '').replace(/\D/g, '').slice(-10)
export function shareLinks(d, ios = false) {
  const ph = phone10(d.customer.phone), enc = encodeURIComponent
  return {
    WhatsApp: `https://wa.me/${ph ? '91' + ph : ''}?text=${enc(whatsappText(d))}`,
    SMS: `sms:${ph}${ios ? '&' : '?'}body=${enc(smsText(d))}`,
    Telegram: `https://t.me/share/url?url=%20&text=${enc(telegramText(d))}`,
  }
}

/* ───────────── on-screen preview ───────────── */
// "View Only": the very same 80mm / A4 markup, with printing switched off inside it (the viewer also sandboxes the frame and hides the page when the browser prints).
export const viewOnlyHtml = (html) => html.replace('</head>', '<style>@media print{html,body{display:none!important}}</style></head>')

/* ───────────── printing (browser only) ───────────── */
// hidden iframe — no pop-up window for the browser to block
export function printHtml(html) {
  const f = Object.assign(document.createElement('iframe'), { style: 'position:fixed;right:0;bottom:0;width:0;height:0;border:0' })
  document.body.appendChild(f)
  const w = f.contentWindow, doc = w.document
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => { w.focus(); w.print(); setTimeout(() => f.remove(), 2000) }, 250)
}
