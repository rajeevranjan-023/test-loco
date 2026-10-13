import React, { useState } from 'react'
import { CheckCircle2, Clock, FileText, Wallet, Package, Box, Truck, XCircle, MoreVertical, ChevronDown } from 'lucide-react'
import { inr, dt } from '../udhar/parts.jsx'

export { inr, dt }
export const STATUS = ['New', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled']
export const ST = {
  Draft: ['bg-[#F1EDFD] text-[#6D5BD0]', FileText],
  New: ['bg-[#E8F1FE] text-[#2F6FEB]', Package], Preparing: ['bg-[#FFF1DC] text-[#E58A00]', Box], 'Out for Delivery': ['bg-[#FFF6D9] text-[#C98A00]', Truck],
  Delivered: ['bg-[#E3F7EC] text-[#12A05C]', Truck], Cancelled: ['bg-[#FDE8E8] text-[#D92D20]', XCircle],
}
const TONES = ['bg-violet-100 text-violet-600', 'bg-green-100 text-green-600', 'bg-orange-100 text-orange-600', 'bg-blue-100 text-blue-600', 'bg-pink-100 text-pink-600', 'bg-amber-100 text-amber-700']
export const Av = ({ name, size = 28 }) => <span style={{ width: size, height: size, fontSize: size * 0.42 }} className={`grid shrink-0 place-items-center rounded-full font-semibold ${TONES[name.charCodeAt(0) % TONES.length]}`}>{name[0].toUpperCase()}</span>
export const time = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
export const dateOnly = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// Paid (green) · Pending ₹x (orange) · Udhar ₹x (purple) · Advance Used (blue)
export function PayBadge({ p }) {
  const t = {
    paid: ['bg-[#E8F7EF] text-[#12A05C]', CheckCircle2, 'Paid'], pending: ['bg-[#FFF3E6] text-[#E58A00]', Clock, `Pending · ${inr(p.amount)}`],
    udhar: ['bg-[#F1EDFD] text-[#6D5BD0]', FileText, `Udhar · ${inr(p.amount)}`], advance: ['bg-[#E6F0FE] text-[#2F6FEB]', Wallet, 'Advance Used'],
    void: ['bg-[#F1F3F7] text-gray-500', XCircle, 'Voided'],
    draft: ['bg-[#F1EDFD] text-[#6D5BD0]', FileText, 'Draft'],
  }[p.kind]
  const I = t[1]
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 leading-tight ${t[0]}`}><I size={14} /><span><span className="block text-[12px] font-semibold">{t[2]}</span>{(p.kind === 'paid' || p.kind === 'pending' || p.kind === 'advance' || p.kind === 'void') && <span className="block text-[10px] opacity-70">{p.method}{p.kind === 'paid' && p.advance > 0 ? ` · +${inr(p.advance)} advance` : ''}</span>}</span></span>
}

// native <select> dressed as a status pill (keyboard friendly)
export function StatusSelect({ value, onChange, disabled }) {
  const [tone, Icon] = ST[value] || ST.New
  if (disabled) return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${tone}`}><Icon size={14} />{value}</span> // locked (e.g. Cancelled) but still fully readable
  return (
    <label className={`relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${tone} ${disabled ? 'opacity-70' : 'cursor-pointer'}`}>
      <Icon size={14} />
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label="Order status" className="appearance-none bg-transparent pr-3.5 font-medium outline-none disabled:cursor-not-allowed">
        {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {!disabled && <ChevronDown size={11} className="pointer-events-none absolute right-1.5 opacity-60" />}
    </label>
  )
}

export function Menu({ items }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <button type="button" aria-label="More actions" onClick={() => setOpen((o) => !o)} className="grid h-7 w-7 place-items-center rounded-md border border-[#E3EAF3] text-gray-600 transition hover:border-orange-300"><MoreVertical size={14} /></button>
      {open && <><div className="fixed inset-0 z-30" onClick={() => setOpen(false)} /><div className="absolute right-0 top-full z-40 mt-1 w-[130px] rounded-md border border-gray-100 bg-white p-0.5 text-left shadow-lg">{items.map(([l, f, danger]) => <button key={l} type="button" onClick={() => { setOpen(false); f() }} className={`block w-full rounded px-2.5 py-1.5 text-left text-[12px] transition hover:bg-orange-50 ${danger ? 'text-red-600' : ''}`}>{l}</button>)}</div></>}
    </span>
  )
}

// ---- helpers used by list + bill page ----
export const waLink = (phone, text) => `https://wa.me/${phone ? `91${String(phone).replace(/\D/g, '').slice(-10)}` : ''}?text=${encodeURIComponent(text)}`
export const orderText = (o) => `Bill ${o.id} · ${o.customerName || o.customer?.name} · Total ${inr(o.amount ?? o.summary?.total)} — thank you for shopping with us!`
export function printHtml(title, body) {
  const w = window.open('', '_blank', 'width=900,height=700'); if (!w) return
  w.document.write(`<html><head><title>${title}</title><style>body{font:12px system-ui,sans-serif;padding:16px}table{width:100%;border-collapse:collapse}th,td{padding:5px 6px;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f7fa}h3{margin:0 0 8px}</style></head><body>${body}</body></html>`)
  w.document.close(); w.focus(); setTimeout(() => w.print(), 250)
}
export const payText = (p) => (p.kind === 'draft' ? 'Draft' : p.kind === 'paid' ? `Paid (${p.method})` : p.kind === 'advance' ? 'Advance Used' : `${p.kind === 'udhar' ? 'Udhar' : 'Pending'} ${inr(p.amount)}`)

// Pagination: [1, 2, '…', 9]. Page numbers are unique, but an ellipsis used its INDEX as key — at index 2 that is the same key as page "2"
// (React: "Encountered two children with the same key, '2'"). Numbers keep `page-N`, each ellipsis gets `gap-<position>`: always distinct.
export const pageKey = (p, i) => (p === '…' ? `gap-${i}` : `page-${p}`)
export const pageList = (n, c) => { const a = []; for (let i = 1; i <= n; i++) if (i === 1 || i === n || Math.abs(i - c) <= 1) a.push(i); return a.reduce((o, i, k) => (k && i - a[k - 1] > 1 ? [...o, '…', i] : [...o, i]), []) }
