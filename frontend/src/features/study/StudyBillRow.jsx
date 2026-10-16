import React, { useEffect, useRef, useState } from 'react'
import { call } from '../analytics/kit.jsx'
import { slotText } from './shared.jsx'

// The "add item" row of the (shared) Billing screen for study-centre item types.
// It only collects line details; pricing, discount, payment, dues and printing stay in the universal billing engine.
export const STUDY_TYPES = ['membership', 'course', 'book', 'fine', 'registration', 'seat']
const inp = 'h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
const lab = 'mb-0.5 block text-[11.5px] font-medium text-gray-600'

// Same wording as the server (backend/utils/studyService.js) — the server is the authority, this only saves a round trip.
export const MSG_SEAT_TAKEN = 'This seat is already assigned to another member during the selected time slot. Please select another seat or time slot.'
export const MSG_MEMBER_HAS_SEAT = 'This member already has an active seat assigned. Please remove or change the existing assignment before assigning another seat.'
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0) }
const overlap = (a, b) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end) // end is exclusive: 06:00–12:00 and 12:00–18:00 do not clash

// Would giving `member` this seat/slot break a seat rule? Returns the red message to show under the seat field, or ''.
//   rule 1: a member holds ONE seat — keeping it is a renewal, anything else is a deliberate "change" (`change`)
//   rule 2: a seat may be shared only in slots that do not overlap (the member's own booking never blocks them)
export function seatProblem({ seat, slot, member, change = false, window: win = null }) {
  if (!seat || !slot) return ''
  const want = slot.fullDay ? { start: win?.open || '00:00', end: win?.close || '24:00' } : slot
  const mine = member?.seat
  if (mine && String(mine.seatId) === String(seat.id) && mine.slot?.start === want.start && mine.slot?.end === want.end) return '' // renewing the seat they already hold
  if (mine && !change) return MSG_MEMBER_HAS_SEAT
  const clash = (seat.busy || []).some((b) => !(member && String(b.memberId) === String(member.memberId)) && overlap(b, want))
  return clash ? MSG_SEAT_TAKEN : ''
}

export function useBillingCatalog(enabled) {
  const [cat, setCat] = useState(null)
  const load = () => call('get', '/api/seller/study/billing/catalog').then(setCat).catch(() => {})
  useEffect(() => { if (enabled) load() }, [enabled])
  return [cat, load]
}

export default function StudyBillRow({ type, catalog, focusRef, onAdd, onErr, member = null, seatError = '', onSeatError = () => {} }) {
  const first = useRef()
  useEffect(() => { focusRef.current = () => first.current?.focus(); setTimeout(() => first.current?.focus(), 0); return () => { focusRef.current = null } }, [focusRef])
  const [pick, setPick] = useState(''); const [name, setName] = useState(''); const [rate, setRate] = useState('')
  const [seatId, setSeatId] = useState(''); const [slotKey, setSlotKey] = useState('full'); const [from, setFrom] = useState('08:00'); const [to, setTo] = useState('12:00'); const [start, setStart] = useState('')
  const [change, setChange] = useState(false)
  const plans = catalog?.plans || [], seats = catalog?.seats || [], slots = catalog?.timeSlots || []
  const hasSeatUi = type === 'membership' || type === 'seat'
  const mySeat = member?.seat || null

  const options = type === 'course' ? (catalog?.courses || []).map((c) => ({ id: c.id, name: `${c.name} – Course Fee`, price: c.fee, courseId: c.id }))
    : type === 'book' ? (catalog?.materials || []).map((m) => ({ id: m.key, name: m.name, price: m.price }))
    : (catalog?.chargeTypes || []).filter((c) => (type === 'fine' ? c.kind === 'fine' : type === 'registration' ? c.kind === 'registration' : c.kind === 'other' || c.kind === type)).map((c) => ({ id: c.key, name: c.label, price: c.amount }))

  // A member who already has a seat starts on THAT seat + slot (renewing it); a member who has a running/expired membership starts on their renewal plan.
  useEffect(() => {
    setChange(false)
    if (!hasSeatUi) return
    if (mySeat) {
      setSeatId(String(mySeat.seatId))
      const s = mySeat.slot || {}
      const preset = slots.find((x) => x.start === s.start && x.end === s.end)
      if (s.fullDay) setSlotKey('full'); else if (preset) setSlotKey(preset.key); else { setSlotKey('custom'); setFrom(s.start || '08:00'); setTo(s.end || '12:00') }
    } else { setSeatId(''); setSlotKey('full') }
    if (type === 'membership' && member?.renewal) { const p = plans.find((x) => x.key === member.renewal.planKey); if (p) { setPick(p.key); setRate(String(member.renewal.price ?? p.price)) } }
  }, [member?.memberId, member?.seat?.assignmentId, catalog]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setPick(''); setName(''); setRate(''); setStart(''); setChange(false); if (!mySeat) { setSeatId(''); setSlotKey('full') }; setTimeout(() => first.current?.focus(), 0) }
  const slotValue = () => {
    if (slotKey === 'full') return { fullDay: true }
    if (slotKey === 'custom') return { start: from, end: to }
    const s = slots.find((x) => x.key === slotKey); return { start: s.start, end: s.end }
  }
  const seatObj = seats.find((x) => x.id === seatId)
  const slotNow = seatId ? slotValue() : null
  const problem = seatId ? seatProblem({ seat: seatObj, slot: slotNow, member, change, window: catalog?.window }) : ''
  const slotChanged = !!(mySeat && seatId && (String(mySeat.seatId) !== String(seatId) || problem === MSG_MEMBER_HAS_SEAT))
  const shown = problem || seatError // client check first; otherwise whatever the server just said about THIS bill's seat
  const seatMeta = () => (seatId ? { seatId, slot: slotNow, ...(change && mySeat ? { replaceAssignmentId: String(mySeat.assignmentId) } : {}) } : {})
  const seatLabel = () => (seatObj ? `Seat ${seatObj.name} · ${slotText(slotNow.fullDay ? { fullDay: true } : slotNow)}` : '')

  const add = () => {
    const r = Number(rate)
    if (hasSeatUi && problem) return onSeatError(problem)
    onSeatError('')
    if (type === 'membership') {
      const p = plans.find((x) => x.key === pick); if (!p) return onErr('Choose a membership plan')
      if (!(r >= 0) || rate === '') return onErr('Enter the membership amount')
      const meta = { planKey: p.key, months: p.months, ...(start ? { startDate: start } : {}), ...(member?.renewal ? { renewsId: String(member.renewal.renewsId) } : {}), ...seatMeta() }
      return onAdd({ type, name: `Membership – ${p.name}${member?.renewal ? ' (renewal)' : ''}`, rate: r, meta, seatLabel: seatLabel() }), reset()
    }
    if (type === 'seat') {
      const n = (name.trim() || (seatObj ? `Seat Fee – ${seatObj.name}` : 'Seat Fee'))
      if (!(r > 0)) return onErr('Enter an amount')
      return onAdd({ type, name: n, rate: r, ...(seatId ? { meta: seatMeta() } : {}), seatLabel: seatLabel() }), reset()
    }
    const o = options.find((x) => x.id === pick); const n = (o ? o.name : name).trim()
    if (!n) return onErr(type === 'course' ? 'Choose a course or type a name' : 'Enter a name')
    if (!(r > 0)) return onErr('Enter an amount')
    onAdd({ type, name: n, rate: r, ...(o?.courseId ? { meta: { courseId: o.courseId } } : {}) }); reset()
  }
  const key = (e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }
  const choose = (v) => { setPick(v); if (type === 'membership') { const p = plans.find((x) => x.key === v); setRate(p ? String(p.price) : '') } else { const o = options.find((x) => x.id === v); if (o) { setName(o.name); setRate(String(o.price || '')) } else { setName(''); } } }
  const pickSeat = (v) => { setSeatId(v); setChange(false); onSeatError('') }

  const seatSection = (
    <>
      <div className="min-w-[120px] flex-1"><label className={lab}>{type === 'seat' ? 'Seat' : 'Seat (optional)'}</label><select ref={type === 'seat' ? first : undefined} aria-label="Seat" aria-invalid={!!shown} aria-describedby={shown ? 'seat-error' : undefined} value={seatId} onChange={(e) => pickSeat(e.target.value)} className={`${inp} ${shown ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}><option value="">No seat</option>{seats.map((s) => <option key={s.id} value={s.id}>{s.name}{s.zone ? ` · ${s.zone}` : ''}{String(mySeat?.seatId) === String(s.id) ? ' (current)' : s.state === 'occupied' ? ' (full)' : s.state === 'partial' ? ' (partial)' : ''}</option>)}</select></div>
      {seatId && <div className="min-w-[130px]"><label className={lab}>Time slot</label><select aria-label="Time slot" value={slotKey} onChange={(e) => { setSlotKey(e.target.value); onSeatError('') }} className={inp}><option value="full">Full Day</option>{slots.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.start}–{s.end})</option>)}<option value="custom">Custom time…</option></select></div>}
      {seatId && slotKey === 'custom' && <><div className="w-[96px]"><label className={lab}>From</label><input type="time" aria-label="Slot from" value={from} onChange={(e) => { setFrom(e.target.value); onSeatError('') }} className={inp} /></div><div className="w-[96px]"><label className={lab}>To</label><input type="time" aria-label="Slot to" value={to} onChange={(e) => { setTo(e.target.value); onSeatError('') }} className={inp} /></div></>}
      {seatId && seatObj?.busy?.length > 0 && !shown && <p className="basis-full text-[11.5px] text-gray-500">Seat {seatObj.name} is also booked: {seatObj.busy.map((b) => b.label).join(', ')}. Pick a time that does not overlap.</p>}
      {mySeat && !slotChanged && seatId && <p className="basis-full text-[11.5px] text-emerald-700">Keeping this member’s current seat ({mySeat.name} · {mySeat.slotLabel}) — it is renewed, not duplicated.</p>}
      {slotChanged && <label className="basis-full flex items-center gap-2 text-[12.5px] text-gray-700"><input type="checkbox" aria-label="Change seat" checked={change} onChange={(e) => { setChange(e.target.checked); onSeatError('') }} />Change seat — move this member from {mySeat.name} ({mySeat.slotLabel}) to the one selected</label>}
      {shown && <p id="seat-error" role="alert" data-testid="seat-error" className="basis-full text-[12.5px] font-medium text-red-600">{shown}</p>}
    </>
  )

  return (
    <div className="flex flex-wrap items-end gap-2" onKeyDown={key}>
      {type === 'membership' ? (
        <>
          <div className="min-w-[150px] flex-1"><label className={lab}>Plan</label><select ref={first} aria-label="Membership plan" value={pick} onChange={(e) => choose(e.target.value)} className={inp}><option value="">Select plan…</option>{plans.map((p) => <option key={p.key} value={p.key}>{p.name} · ₹{p.price}</option>)}</select></div>
          <div className="w-[96px]"><label className={lab}>Amount ₹</label><input aria-label="Membership amount" value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} className={inp} /></div>
          {seatSection}
          <div className="w-[130px]"><label className={lab}>Starts (optional)</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inp} /></div>
        </>
      ) : type === 'seat' ? (
        <>
          {seatSection}
          <div className="min-w-[140px] flex-1"><label className={lab}>Description</label><input aria-label="Item name" value={name} placeholder={seatObj ? `Seat Fee – ${seatObj.name}` : 'Seat Fee'} onChange={(e) => setName(e.target.value)} className={inp} /></div>
          <div className="w-[96px]"><label className={lab}>Amount ₹</label><input aria-label="Amount" value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} className={inp} /></div>
        </>
      ) : (
        <>
          <div className="min-w-[200px] flex-1"><label className={lab}>{type === 'course' ? 'Course' : type === 'book' ? 'Book / Material' : type === 'fine' ? 'Fine' : type === 'registration' ? 'Registration' : 'Charge'}</label>
            {options.length > 0 && <select ref={first} aria-label="Catalogue item" value={pick} onChange={(e) => choose(e.target.value)} className={`${inp} mb-1`}><option value="">Choose from list… or type below</option>{options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.price ? ` · ₹${o.price}` : ''}</option>)}</select>}
            <input ref={options.length ? undefined : first} aria-label="Item name" value={name} placeholder="Type item name" onChange={(e) => { setName(e.target.value); setPick('') }} className={inp} /></div>
          <div className="w-[96px]"><label className={lab}>Amount ₹</label><input aria-label="Amount" value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} className={inp} /></div>
        </>
      )}
      <button type="button" onClick={add} className="h-9 rounded-lg bg-orange-500 px-4 text-[12.5px] font-medium text-white hover:bg-orange-600">Add (Enter)</button>
    </div>
  )
}
export { slotText }
