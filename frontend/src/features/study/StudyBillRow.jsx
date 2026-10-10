import React, { useEffect, useRef, useState } from 'react'
import { call } from '../analytics/kit.jsx'
import { slotText } from './shared.jsx'

// The "add item" row of the (shared) Billing screen for study-centre item types.
// It only collects line details; pricing, discount, payment, dues and printing stay in the universal billing engine.
export const STUDY_TYPES = ['membership', 'course', 'book', 'fine', 'registration', 'seat']
const inp = 'h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
const lab = 'mb-0.5 block text-[11.5px] font-medium text-gray-600'

export function useBillingCatalog(enabled) {
  const [cat, setCat] = useState(null)
  const load = () => call('get', '/api/seller/study/billing/catalog').then(setCat).catch(() => {})
  useEffect(() => { if (enabled) load() }, [enabled])
  return [cat, load]
}

export default function StudyBillRow({ type, catalog, focusRef, onAdd, onErr }) {
  const first = useRef()
  useEffect(() => { focusRef.current = () => first.current?.focus(); setTimeout(() => first.current?.focus(), 0); return () => { focusRef.current = null } }, [focusRef])
  const [pick, setPick] = useState(''); const [name, setName] = useState(''); const [rate, setRate] = useState('')
  const [seatId, setSeatId] = useState(''); const [slotKey, setSlotKey] = useState('full'); const [from, setFrom] = useState('08:00'); const [to, setTo] = useState('12:00'); const [start, setStart] = useState('')
  const plans = catalog?.plans || [], seats = catalog?.seats || [], slots = catalog?.timeSlots || []

  const options = type === 'course' ? (catalog?.courses || []).map((c) => ({ id: c.id, name: `${c.name} – Course Fee`, price: c.fee, courseId: c.id }))
    : type === 'book' ? (catalog?.materials || []).map((m) => ({ id: m.key, name: m.name, price: m.price }))
    : (catalog?.chargeTypes || []).filter((c) => (type === 'fine' ? c.kind === 'fine' : type === 'registration' ? c.kind === 'registration' : c.kind === 'other' || c.kind === type)).map((c) => ({ id: c.key, name: c.label, price: c.amount }))

  const reset = () => { setPick(''); setName(''); setRate(''); setSeatId(''); setSlotKey('full'); setStart(''); setTimeout(() => first.current?.focus(), 0) }
  const slotValue = () => {
    if (slotKey === 'full') return { fullDay: true }
    if (slotKey === 'custom') return { start: from, end: to }
    const s = slots.find((x) => x.key === slotKey); return { start: s.start, end: s.end }
  }
  const add = () => {
    const r = Number(rate)
    if (type === 'membership') {
      const p = plans.find((x) => x.key === pick); if (!p) return onErr('Choose a membership plan')
      if (!(r >= 0) || rate === '') return onErr('Enter the membership amount')
      const meta = { planKey: p.key, months: p.months, ...(start ? { startDate: start } : {}), ...(seatId ? { seatId, slot: slotValue() } : {}) }
      return onAdd({ type, name: `Membership – ${p.name}`, rate: r, meta }), reset()
    }
    const o = options.find((x) => x.id === pick); const n = (o ? o.name : name).trim()
    if (!n) return onErr(type === 'course' ? 'Choose a course or type a name' : 'Enter a name')
    if (!(r > 0)) return onErr('Enter an amount')
    onAdd({ type, name: n, rate: r, ...(o?.courseId ? { meta: { courseId: o.courseId } } : {}) }); reset()
  }
  const key = (e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }
  const choose = (v) => { setPick(v); if (type === 'membership') { const p = plans.find((x) => x.key === v); setRate(p ? String(p.price) : '') } else { const o = options.find((x) => x.id === v); if (o) { setName(o.name); setRate(String(o.price || '')) } else { setName(''); } } }

  return (
    <div className="flex flex-wrap items-end gap-2" onKeyDown={key}>
      {type === 'membership' ? (
        <>
          <div className="min-w-[150px] flex-1"><label className={lab}>Plan</label><select ref={first} aria-label="Membership plan" value={pick} onChange={(e) => choose(e.target.value)} className={inp}><option value="">Select plan…</option>{plans.map((p) => <option key={p.key} value={p.key}>{p.name} — ₹{p.price}</option>)}</select></div>
          <div className="w-[96px]"><label className={lab}>Amount ₹</label><input aria-label="Membership amount" value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} className={inp} /></div>
          <div className="min-w-[120px] flex-1"><label className={lab}>Seat (optional)</label><select aria-label="Seat" value={seatId} onChange={(e) => setSeatId(e.target.value)} className={inp}><option value="">No seat</option>{seats.map((s) => <option key={s.id} value={s.id}>{s.name}{s.zone ? ` · ${s.zone}` : ''}{s.state === 'occupied' ? ' (full)' : s.state === 'partial' ? ' (partial)' : ''}</option>)}</select></div>
          {seatId && <div className="min-w-[130px]"><label className={lab}>Time slot</label><select aria-label="Time slot" value={slotKey} onChange={(e) => setSlotKey(e.target.value)} className={inp}><option value="full">Full Day</option>{slots.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.start}–{s.end})</option>)}<option value="custom">Custom time…</option></select></div>}
          {seatId && slotKey === 'custom' && <><div className="w-[96px]"><label className={lab}>From</label><input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div><div className="w-[96px]"><label className={lab}>To</label><input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div></>}
          {seatId && (() => { const s = seats.find((x) => x.id === seatId); return s?.busy?.length ? <p className="basis-full text-[11.5px] text-gray-500">Seat {s.name} is already taken: {s.busy.map((b) => b.label).join(', ')}. Pick a time that does not overlap.</p> : null })()}
          <div className="w-[130px]"><label className={lab}>Starts (optional)</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inp} /></div>
        </>
      ) : (
        <>
          <div className="min-w-[200px] flex-1"><label className={lab}>{type === 'course' ? 'Course' : type === 'book' ? 'Book / Material' : type === 'fine' ? 'Fine' : type === 'registration' ? 'Registration' : 'Charge'}</label>
            {options.length > 0 && <select ref={first} aria-label="Catalogue item" value={pick} onChange={(e) => choose(e.target.value)} className={`${inp} mb-1`}><option value="">Choose from list… or type below</option>{options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.price ? ` — ₹${o.price}` : ''}</option>)}</select>}
            <input ref={options.length ? undefined : first} aria-label="Item name" value={name} placeholder="Type item name" onChange={(e) => { setName(e.target.value); setPick('') }} className={inp} /></div>
          <div className="w-[96px]"><label className={lab}>Amount ₹</label><input aria-label="Amount" value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} className={inp} /></div>
        </>
      )}
      <button type="button" onClick={add} className="h-9 rounded-lg bg-orange-500 px-4 text-[12.5px] font-medium text-white hover:bg-orange-600">Add (Enter)</button>
    </div>
  )
}
export { slotText }
