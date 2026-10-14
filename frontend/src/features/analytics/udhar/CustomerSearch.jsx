import React, { useEffect, useId, useRef, useState } from 'react'
import { Search, Loader2, UserPlus, AlertCircle, Link2 } from 'lucide-react'
import { call } from '../kit.jsx'
import { Avatar, inr } from './parts.jsx'
import { useBusiness } from '../../../context/BusinessContext.jsx'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'

// Universal customer search for the Udhar page. It reuses the billing screen's endpoints — nothing new on the server for the lookup:
//   GET  /api/customers/search?q=          every customer of THIS shop (with or without udhar) + a global suggestion for an exact 10-digit number
//   POST /api/seller/billing/customers/select   links a global person to this shop (never creates a second global user)
// A result opens that customer's existing account page. "No customer found" appears only after a search that really finished and found nothing —
// a failed search shows an error with Retry and never offers "Add customer".
export const searchable = (q) => { const t = q.trim(); return /^[\d\s+-]+$/.test(t) ? t.replace(/\D/g, '').length >= 3 : t.length >= 2 } // 2 letters · 3 digits
const digitsOf = (q) => { let d = q.replace(/\D/g, ''); if (d.length === 12 && d.startsWith('91')) d = d.slice(2); return d }
const isPhone = (q) => /^[\d\s+-]+$/.test(q.trim())
const fullPhone = (q) => isPhone(q) && digitsOf(q).length === 10

export default function CustomerSearch({ onAdd }) {
  const { tx } = useBusiness(); const nav = useOwnerNavigate(); const uid = useId()
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [idx, setIdx] = useState(-1); const [retry, setRetry] = useState(0)
  const [st, setSt] = useState({ status: 'idle', list: [], error: '' }) // idle · loading · done · error
  const [pickErr, setPickErr] = useState(''); const [picking, setPicking] = useState(false)
  const cache = useRef(new Map()); const seq = useRef(0); const box = useRef(); const picked = useRef(false)

  // Every keystroke starts a new numbered request; only the newest number may update the screen, so a slow older answer can never overwrite the latest results.
  useEffect(() => {
    const t = q.trim(); setPickErr('')
    if (!searchable(t)) { seq.current++; setSt({ status: 'idle', list: [], error: '' }); return undefined }
    const hit = cache.current.get(t)
    if (hit) { seq.current++; setSt({ status: 'done', list: hit, error: '' }); return undefined }
    const id = ++seq.current
    setSt({ status: 'loading', list: [], error: '' })
    const timer = setTimeout(() => call('get', `/api/customers/search?q=${encodeURIComponent(t)}`)
      .then((r) => { const list = Array.isArray(r) ? r : []; cache.current.set(t, list); if (id === seq.current) setSt({ status: 'done', list, error: '' }) })
      .catch((e) => { if (id === seq.current) setSt({ status: 'error', list: [], error: e?.message || 'The search failed.' }) }), // an error is NOT "no customer found"
    fullPhone(t) ? 0 : 120)
    return () => clearTimeout(timer)
  }, [q, retry])
  useEffect(() => { setIdx(-1) }, [st])
  useEffect(() => { const h = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])

  const show = open && searchable(q)
  const { status, list } = st
  const empty = status === 'done' && !list.length

  const finish = (id) => { cache.current.clear(); setQ(''); setOpen(false); nav(`/customer/${id}`) }
  const pick = async (c) => {
    if (!c || picking) return
    if (c.source !== 'global') return finish(c.id) // the existing customer account page
    setPicking(true); setPickErr('')
    try { const saved = await call('post', '/api/seller/billing/customers/select', { globalUserId: c.globalUserId, name: c.name, phone: c.phone }); finish(saved.id) }
    catch (e) { setPickErr(e.message || 'Could not add this customer.') } finally { setPicking(false) }
  }
  const add = () => { const t = q.trim(); const d = digitsOf(t); setOpen(false); onAdd(isPhone(t) ? { name: '', phone: d.slice(0, 10) } : { name: t, phone: '' }) }
  const onKey = (e) => {
    if (e.key === 'Escape') return setOpen(false)
    if (!show) { if (e.key === 'ArrowDown' && searchable(q)) setOpen(true); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.length) setIdx((i) => (e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (status === 'done' && list.length) pick(list[idx >= 0 ? idx : 0]); else if (empty) add() }
  }
  const badge = (c) => (c.udharDue > 0 ? <span className="text-[12px] font-semibold text-[#E5381D]">{tx('Owes')} {inr(c.udharDue)}</span> : c.credit > 0 ? <span className="text-[12px] font-semibold text-[#2F6FEB]">Advance {inr(c.credit)}</span> : <span className="text-[11.5px] text-gray-400">No {tx('udhar')} due</span>)

  return (
    <div ref={box} className="relative">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-[#E3EAF3] bg-white px-3 transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
        <Search size={16} className="shrink-0 text-gray-400" />
        <input role="combobox" aria-expanded={show} aria-controls={`${uid}-list`} aria-autocomplete="list" aria-label={tx('Search customer')} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder={tx('Search customer by name or mobile number…')} className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-gray-400" />
        {status === 'loading' && searchable(q) && <Loader2 size={15} className="shrink-0 animate-spin text-orange-500" aria-hidden />}
        {q && <button type="button" aria-label="Clear search" onClick={() => { setQ(''); setOpen(false) }} className="shrink-0 rounded px-1 text-[16px] leading-none text-gray-400 hover:text-gray-600">×</button>}
      </div>

      {show && (
        <div id={`${uid}-list`} role="listbox" aria-label="Customers" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[340px] overflow-auto rounded-lg border border-gray-100 bg-white p-1 shadow-xl">
          {status === 'loading' && <div role="status" className="flex items-center gap-2 px-3 py-3 text-[12.5px] text-gray-500"><Loader2 size={15} className="animate-spin text-orange-500" />Searching…</div>}
          {status === 'error' && (
            <div role="alert" className="flex items-center gap-2 px-3 py-3 text-[12.5px] text-red-600"><AlertCircle size={15} className="shrink-0" /><span className="flex-1">Couldn’t complete the search{st.error ? ` — ${st.error}` : ''}.</span>
              <button type="button" onClick={() => setRetry((n) => n + 1)} className="font-medium underline">Retry</button></div>)}
          {status === 'done' && list.map((c, i) => (
            <button key={`${c.source}-${c.id || c.globalUserId}`} type="button" role="option" aria-selected={i === idx} disabled={picking} onMouseEnter={() => setIdx(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition ${i === idx ? 'bg-orange-50' : 'hover:bg-gray-50'} disabled:opacity-60`}>
              <Avatar name={c.name} size={30} i={i} />
              <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13.5px] font-medium text-gray-900">{c.name}</span><span className="block text-[12px] text-gray-500">{c.phone || 'No mobile number'}</span></span>
              {c.source === 'global' ? <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-[#2F6FEB]"><Link2 size={13} />{picking ? 'Adding…' : tx('Add to my customers')}</span> : badge(c)}
            </button>))}
          {pickErr && <div role="alert" className="px-3 py-2 text-[12px] text-red-600">{pickErr}</div>}
          {empty && (
            <div className="px-3 py-3 text-center">
              <div className="text-[13px] text-gray-500">{tx('No customer found')}</div>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={add} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-4 text-[13px] font-medium text-white transition hover:bg-orange-600"><UserPlus size={15} />{tx('Add Customer & Udhar')}</button>
            </div>)}
        </div>)}
    </div>
  )
}
