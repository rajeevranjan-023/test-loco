import React, { useEffect, useRef, useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { Pin, Clock, MoreVertical, Plus, Search, X, ArrowDownLeft, ArrowUpRight, Gift, Minus } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useSeller, call, Modal } from '../kit.jsx'
import { useBusiness } from '../../../context/BusinessContext.jsx'

export const inr = (n) => '₹' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-IN')
export const dt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const dtm = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const TONES = ['bg-red-100 text-red-600', 'bg-blue-100 text-blue-600', 'bg-violet-100 text-violet-600', 'bg-green-100 text-green-600', 'bg-pink-100 text-pink-600', 'bg-amber-100 text-amber-700']
export const Avatar = ({ name, size = 28, i }) => <span style={{ width: size, height: size, fontSize: size * 0.42 }} className={`grid shrink-0 place-items-center rounded-full font-semibold ${TONES[(i ?? name.charCodeAt(0)) % TONES.length]}`}>{name[0]}</span>

// Status pills — 🟠 Pending (udhar remaining) · 🟢 Cleared (fully paid) · 🔵 Advance (customer has extra balance)
const STATUS = { pending: ['Pending', 'bg-[#FFF3D6] text-[#D98E04]'], cleared: ['Cleared', 'bg-[#E3F7EC] text-[#12A05C]'], advance: ['Advance', 'bg-[#E6F0FE] text-[#2F6FEB]'] }
export const StatusBadge = ({ s }) => <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS[s]?.[1] || STATUS.cleared[1]}`}>{STATUS[s]?.[0] || 'Cleared'}</span>

// Days pending → colour: 1–3 green · 4–7 yellow · 7+ red
export const dayTone = (n) => (n <= 3 ? 'bg-[#E3F7EC] text-[#12A05C]' : n <= 7 ? 'bg-[#FFF3D6] text-[#D98E04]' : 'bg-[#FDE8E8] text-[#D92D20]')
export const dayText = (n) => (n <= 0 ? 'Today' : `${n} day${n > 1 ? 's' : ''}`)
export const DaysBadge = ({ n }) => <span className={`inline-block min-w-[52px] rounded px-1.5 py-0.5 text-center text-[11px] font-medium ${dayTone(n)}`}>{dayText(n)}</span>

export function Kpi({ tone, icon: I, label, value, sub, valueClass }) {
  const t = { orange: ['bg-[#FFF3EA]', 'bg-[#FFE0CC] text-orange-500'], green: ['bg-[#EAF8F1]', 'bg-[#CFEFDD] text-[#16A870]'], blue: ['bg-[#EAF3FF]', 'bg-[#D3E6FD] text-[#2F86F6]'], red: ['bg-[#FDECEC]', 'bg-[#FAD3D3] text-red-500'] }[tone]
  return (
    <div className={`flex h-[52px] items-center gap-2.5 rounded-lg border border-black/[0.04] px-2.5 ${t[0]}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t[1]}`}><I size={16} /></span>
      <div className="min-w-0 leading-none"><div className="truncate text-[11px] text-gray-600">{label}</div><div className="mt-1 flex items-baseline gap-1.5"><span className={`text-[16px] font-bold ${valueClass}`}>{value}</span>{sub && <span className="truncate text-[10px] text-gray-500">{sub}</span>}</div></div>
    </div>
  )
}

export function Trend({ data, h = 160 }) {
  const { tx } = useBusiness()
  const none = !data.some((d) => d.given || d.recovered)
  const gap = data.length <= 14 ? 0 : Math.ceil(data.length / 12) - 1
  return (
    <div className="relative" style={{ height: h }}>
      {none && <div className="absolute inset-0 z-10 grid place-items-center text-[12px] text-gray-400">{tx('No udhar activity in this range')}</div>}
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 6, left: -14, bottom: -4 }}>
          <defs>{[['g1', '#EF4444'], ['g2', '#16A34A']].map(([id, c]) => <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity={0.16} /><stop offset="100%" stopColor={c} stopOpacity={0.01} /></linearGradient>)}</defs>
          <CartesianGrid vertical={false} stroke="#EEF2F7" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval={gap} height={16} />
          <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
          <Tooltip formatter={(v, n) => [inr(v), n === 'given' ? 'Udhar Given' : 'Recovered']} contentStyle={{ fontSize: 11, borderRadius: 6, padding: '4px 8px' }} />
          <Area dataKey="given" stroke="#EF4444" strokeWidth={1.25} fill="url(#g1)" dot={{ r: 2, fill: '#EF4444', strokeWidth: 0 }} activeDot={{ r: 3.5 }} />
          <Area dataKey="recovered" stroke="#16A34A" strokeWidth={1.25} fill="url(#g2)" dot={{ r: 2, fill: '#16A34A', strokeWidth: 0 }} activeDot={{ r: 3.5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Toolbar({ q, setQ, sort, setSort, sorts, filter, setFilter, filters }) {
  const sel = 'h-7 rounded-md border border-[#E3EAF3] bg-white px-2 text-[11.5px] text-gray-700 outline-none transition hover:border-orange-300 focus:border-orange-400'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative"><Search size={12} className="absolute left-2 top-[8px] text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…" className={`${sel} w-[170px] pl-6`} /></div>
      <select value={sort} onChange={(e) => setSort(e.target.value)} className={sel}>{sorts.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}</select>
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className={sel}>{filters.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>
  )
}

export function RowMenu({ items }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <button type="button" aria-label="More" onClick={() => setOpen((o) => !o)} className="rounded p-1 text-gray-600 transition hover:bg-gray-100"><MoreVertical size={14} /></button>
      {open && <><div className="fixed inset-0 z-30" onClick={() => setOpen(false)} /><div className="absolute right-0 top-full z-40 mt-1 w-[170px] rounded-md border border-gray-100 bg-white p-0.5 text-left shadow-lg">{items.map(([l, f]) => <button key={l} type="button" onClick={() => { setOpen(false); f() }} className="block w-full rounded px-2.5 py-1 text-left text-[12px] transition hover:bg-orange-50">{l}</button>)}</div></>}
    </span>
  )
}

export function PinnedCard({ r, i, onView, onUnpin }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#F3E3D6] bg-white px-2 py-1.5 transition hover:border-orange-300">
      <Avatar name={r.name} size={28} i={i} />
      <button type="button" onClick={() => onView(r)} className="min-w-0 flex-1 text-left leading-tight"><span className="block truncate text-[12px] font-semibold text-gray-900">{r.name}</span><span className="block text-[10px] text-gray-500">{r.phone}</span></button>
      <div className="text-right leading-tight"><div className="text-[13px] font-bold text-[#E5381D]">{inr(r.total)}</div><div className={`flex items-center justify-end gap-0.5 text-[10px] font-medium ${r.days > 7 ? 'text-red-500' : r.days > 3 ? 'text-[#D98E04]' : 'text-[#12A05C]'}`}><Clock size={10} />{dayText(r.days)}</div></div>
      <button type="button" title="Unpin" aria-label="Unpin" onClick={() => onUnpin(r)} className="text-orange-500 transition hover:scale-110"><Pin size={12} fill="currentColor" /></button>
    </div>
  )
}

/* ───────── customer history (notebook) ───────── */
export function HistoryDrawer({ customer, version, onClose, onEntry, onOpenEntry }) {
  const { tx } = useBusiness()
  const h = useSeller(`/api/seller/udhar/customers/${customer.id}/history?v=${version}`)
  const end = useRef()
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [h.data])
  const c = h.data?.customer || customer
  // + ₹200 (Udhar) · − ₹100 (Payment) · + ₹50 (Advance) · − ₹30 (Advance used)
  const KIND = {
    udhar: { sign: '+', cls: 'text-[#E8590C]', icon: ArrowUpRight, bg: 'bg-[#FFF1E6] text-[#E8590C]', text: 'Udhar' },
    payment: { sign: '−', cls: 'text-[#12A05C]', icon: ArrowDownLeft, bg: 'bg-[#E3F7EC] text-[#12A05C]', text: 'Payment' },
    advance: { sign: '+', cls: 'text-[#2F6FEB]', icon: Gift, bg: 'bg-[#E6F0FE] text-[#2F6FEB]', text: 'Advance' },
    advance_used: { sign: '−', cls: 'text-[#2F6FEB]', icon: Minus, bg: 'bg-[#E6F0FE] text-[#2F6FEB]', text: 'Advance used' },
  }
  const kind = (e) => KIND[e.kind] || KIND.udhar
  const detail = (e) => [e.kind === 'udhar' && e.summary, e.kind === 'payment' && e.paymentType?.toUpperCase()].filter(Boolean).join(' · ')
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-[440px] max-w-full flex-col bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <Avatar name={c.name} size={44} />
          <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[16px] font-semibold">{c.name}</div><div className="text-[12.5px] text-gray-500">{c.phone || 'No phone'}</div></div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 transition hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex items-center justify-between gap-3 bg-[#FFF8F2] px-5 py-3">
          <div className="leading-tight"><div className="text-[11.5px] text-gray-500">{c.total > 0 ? 'Total Udhar' : c.advance > 0 ? 'Advance Balance' : 'Balance'}</div>
            <div className={`text-[24px] font-bold ${c.total > 0 ? 'text-[#E8590C]' : 'text-[#12A05C]'}`}>{c.total > 0 ? inr(c.total) : c.advance > 0 ? `+${inr(c.advance)}` : '₹0 · Cleared'}</div><div className="mt-0.5"><StatusBadge s={c.status || (c.total > 0 ? 'pending' : c.advance > 0 ? 'advance' : 'cleared')} /></div></div>
          <div className="flex gap-2"><button type="button" onClick={() => onEntry(c, 'udhar')} className="h-9 rounded-lg border border-[#F5C2C2] bg-white px-3 text-[12.5px] font-medium text-red-500 transition hover:bg-red-50">{tx('+ Udhar')}</button><button type="button" onClick={() => onEntry(c, 'payment')} className="h-9 rounded-lg bg-[#12A05C] px-3 text-[12.5px] font-medium text-white transition hover:bg-[#0E8A4E]">Receive</button></div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {h.loading && !h.data ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}</div>
            : h.error ? <div className="text-sm text-red-600">{h.error}</div>
            : !h.data.entries.length ? <div className="py-12 text-center text-[13px] text-gray-400">No entries yet</div>
            : <ul className="space-y-1.5">{h.data.entries.map((e) => { const k = kind(e), I = k.icon; return (
              <li key={e.id}>
                <button type="button" onClick={() => onOpenEntry(e.id)} className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-orange-200 hover:bg-[#FFFAF4]">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${k.bg}`}><I size={15} /></span>
                  <span className="min-w-0 flex-1 leading-tight"><span className={`text-[14px] font-semibold ${k.cls}`}>{k.sign} {inr(e.amount)}</span> <span className="text-[13px] text-gray-700">({k.text})</span>
                    <span className="mt-0.5 block text-[11.5px] text-gray-400">{dt(e.date)} · {e.source === 'billing' ? `Billing${e.billId ? ` ${e.billId}` : ''}` : 'Manual'}{detail(e) ? ` · ${detail(e)}` : ''}</span></span>
                  <span className="text-right text-[11px] leading-tight text-gray-400">Balance<span className="block text-[12.5px] font-medium text-gray-700">{e.balanceAfter < 0 ? <span className="text-[#2F6FEB]">Adv {inr(-e.balanceAfter)}</span> : inr(e.balanceAfter)}</span></span>
                </button>
              </li>) })}<li ref={end} /></ul>}
        </div>
      </aside>
    </>
  )
}

export function EntryDetail({ id, onClose }) {
  const nav = useOwnerNavigate()
  const d = useSeller(`/api/seller/udhar/entries/${id}`)
  const e = d.data
  const title = !e ? 'Entry' : { udhar: 'Udhar Given', payment: 'Payment Received', advance: 'Advance Balance Added', advance_used: 'Advance Balance Used', adjustment: 'Balance Adjustment' }[e.kind] || 'Entry'
  const Row = ({ l, v }) => <div className="flex justify-between gap-4 border-b border-gray-50 py-1.5 text-[13px]"><span className="text-gray-500">{l}</span><span className="text-right font-medium text-gray-900">{v}</span></div>
  return (
    <Modal title={title} onClose={onClose}>
      {d.loading && !e ? <div className="h-40 animate-pulse rounded-xl bg-gray-100" /> : d.error ? <p className="text-sm text-red-600">{d.error}</p> : (
        <div>
          <div className={`mb-3 text-[26px] font-bold ${e.kind === 'udhar' || (e.kind === 'adjustment' && e.delta > 0) ? 'text-[#E8590C]' : e.kind === 'payment' || e.kind === 'adjustment' ? 'text-[#12A05C]' : 'text-[#2F6FEB]'}`}>{e.kind === 'payment' || e.kind === 'advance_used' || (e.kind === 'adjustment' && e.delta < 0) ? '−' : '+'} {inr(e.amount)}</div>
          <Row l="Date & time" v={dtm(e.date)} />
          <Row l="Bill ID" v={e.billRef ? <button type="button" onClick={() => { onClose(); nav(`/bill/${e.billRef}`) }} className="text-[#2F6FEB] underline">{e.billId}</button> : '—'} />
          <Row l="Payment type" v={e.kind === 'udhar' ? 'Udhar (on credit)' : e.kind === 'advance_used' ? 'Advance Balance' : e.kind === 'adjustment' ? 'Manual adjustment' : e.paymentType.toUpperCase()} />
          <Row l="Added by" v={e.addedBy} />
          {e.billTotal != null && <Row l="Bill total" v={inr(e.billTotal)} />}
          <Row l="Balance after" v={e.balanceAfter < 0 ? `Advance ${inr(-e.balanceAfter)}` : inr(e.balanceAfter)} />
          {e.note && <Row l="Note" v={e.note} />}
          {e.items.length > 0 && (
            <div className="mt-3"><div className="mb-1 text-[12.5px] font-semibold">Products</div>
              <table className="w-full text-[12.5px]"><thead className="bg-[#F5F7FA] text-left text-[11.5px]"><tr><th className="px-2 py-1.5">Item</th><th>Qty</th><th className="text-right">Price</th><th className="px-2 text-right">Total</th></tr></thead>
                <tbody>{e.items.map((i, k) => <tr key={k} className="border-b border-gray-50"><td className="px-2 py-1.5">{i.name}</td><td>{i.qty}</td><td className="text-right">{inr(i.price)}</td><td className="px-2 text-right">{inr(i.total)}</td></tr>)}</tbody></table></div>)}
        </div>)}
    </Modal>
  )
}

/* ───────── + Add Udhar / Payment ───────── */
export function EntryModal({ init, onClose, onSaved }) {
  const { tx } = useBusiness()
  const [cust, setCust] = useState(init.customer || null)
  const [type, setType] = useState(init.type || 'udhar')
  const [amount, setAmount] = useState('')
  const [pt, setPt] = useState('cash')
  const [note, setNote] = useState('')
  const [q, setQ] = useState(''); const [list, setList] = useState([]); const [fresh, setFresh] = useState(init.fresh || null) // init.fresh = a new customer typed in the Udhar search (name / mobile prefilled)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const amtRef = useRef()
  useEffect(() => { if (cust) return; let live = true; const t = setTimeout(() => call('get', `/api/seller/billing/customers?q=${encodeURIComponent(q.trim())}`).then((r) => live && setList(r)).catch(() => {}), 110); return () => { live = false; clearTimeout(t) } }, [q, cust])
  useEffect(() => { if (cust) setTimeout(() => amtRef.current?.focus(), 0) }, [cust])

  const bal = cust ? (cust.total ?? 0) : 0 // + owes shop · − customer's Advance Balance
  const owed = Math.max(bal, 0), credit = Math.max(-bal, 0)
  const a = Number(amount) || 0
  const after = type === 'udhar' ? bal + a : bal - a
  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const body = { type, amount: a, paymentType: pt, note, ...(cust?.id ? { customerId: cust.id } : { name: fresh.name, phone: fresh.phone }) }
      onSaved(await call('post', '/api/seller/udhar/entries', body))
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const ready = (cust || (fresh && fresh.name.trim())) && a > 0
  const seg = (on) => `h-9 flex-1 rounded-lg border text-[13px] font-medium transition ${on ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`
  return (
    <Modal title={tx('Add Udhar / Payment')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); ready && submit() }} className="space-y-3">
        {cust ? (
          <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] p-2.5"><Avatar name={cust.name} size={36} /><div className="flex-1 leading-tight"><div className="text-[14px] font-semibold">{cust.name}</div><div className="text-[12px] text-gray-500">{cust.phone}{owed > 0 ? ` · owes ${inr(owed)}` : credit > 0 ? ` · advance ${inr(credit)}` : ''}</div></div>
            {!init.customer && <button type="button" onClick={() => { setCust(null); setQ('') }} className="text-[12px] text-[#2F6FEB] underline">Change</button>}</div>
        ) : fresh ? (
          <div className="grid grid-cols-2 gap-2"><label className="text-[12px] text-gray-600">{tx('New customer name')}<input autoFocus value={fresh.name} onChange={(e) => setFresh({ ...fresh, name: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-orange-400" /></label>
            <label className="text-[12px] text-gray-600">Mobile (10 digits)<input value={fresh.phone} inputMode="numeric" maxLength={10} onChange={(e) => setFresh({ ...fresh, phone: e.target.value.replace(/\D/g, '') })} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-orange-400" /></label></div>
        ) : (
          <div className="relative"><label className="text-[12px] text-gray-600">{tx('Customer')}</label>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or mobile…" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13.5px] outline-none focus:border-orange-400" />
            <ul className="mt-1 max-h-[200px] overflow-auto rounded-lg border border-gray-100">
              {list.map((c) => <li key={c.id}><button type="button" onClick={() => setCust({ ...c, total: (c.udharDue || 0) - (c.credit || 0) })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition hover:bg-orange-50"><span className="flex-1 font-medium">{c.name}</span><span className="text-gray-500">{c.phone}</span>{c.udharDue > 0 && <span className="rounded bg-[#FFF1DC] px-1.5 text-[11px] text-[#E58A00]">{inr(c.udharDue)}</span>}{c.credit > 0 && <span className="rounded bg-[#E6F0FE] px-1.5 text-[11px] text-[#2F6FEB]">Adv {inr(c.credit)}</span>}</button></li>)}
              {q.trim() && <li><button type="button" onClick={() => setFresh(/^\d+$/.test(q.trim()) ? { name: '', phone: q.trim().slice(0, 10) } : { name: q.trim(), phone: '' })} className="w-full px-3 py-1.5 text-left text-[13px] font-medium text-[#2F6FEB] hover:bg-blue-50">+ Add “{q.trim()}” as new customer</button></li>}
            </ul></div>)}
        <div className="flex gap-2"><button type="button" onClick={() => setType('udhar')} className={seg(type === 'udhar')}>{tx('Add Udhar')}</button><button type="button" onClick={() => setType('payment')} className={seg(type === 'payment')}>Receive Payment</button><button type="button" onClick={() => setType('credit')} className={seg(type === 'credit')}>Add Advance</button></div>
        <label className="block text-[12px] text-gray-600">Amount (₹)<input ref={amtRef} value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-[20px] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
        {type !== 'udhar' && <div className="flex gap-2">{['cash', 'upi', 'card'].map((m) => <button key={m} type="button" onClick={() => setPt(m)} className={seg(pt === m)}>{m.toUpperCase()}</button>)}</div>}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (optional)" className="h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-orange-400" />
        {cust && a > 0 && <div className={`rounded-lg px-3 py-2 text-[12.5px] ${after < 0 ? 'bg-[#E6F0FE] text-[#2F6FEB]' : 'bg-[#F8FAFC] text-gray-600'}`}>{after < 0 ? `Customer will have an Advance Balance of ${inr(-after)}` : after === 0 ? 'This clears the udhar completely ✓' : `New balance: ${inr(after)}`}</div>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-gray-200 px-4 text-[13px]">Cancel</button><button type="submit" disabled={!ready || busy} className={`h-10 rounded-lg px-5 text-[13px] font-medium text-white transition disabled:opacity-50 ${type === 'add' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#12A05C] hover:bg-[#0E8A4E]'}`}>{busy ? 'Saving…' : type === 'add' ? 'Add Udhar' : 'Receive Payment'}</button></div>
      </form>
    </Modal>
  )
}
export { Plus }
