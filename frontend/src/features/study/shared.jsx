import React, { useEffect, useState } from 'react'
import { call, Modal, Field, Btn } from '../analytics/kit.jsx'

export const inr = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN')
export const dt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const dtm = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '—')
export const fmt12 = (t) => { const [h, m] = String(t).split(':').map(Number); return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h % 24 < 12 ? 'AM' : 'PM'}` }
export const slotText = (s) => (s?.fullDay ? 'Full Day' : `${fmt12(s.start)} – ${fmt12(s.end)}`)

// A due, the way the whole app writes it:  ₹500 on one line, "5d" / "2m" under it — red.
export const DueStack = ({ due, className = '' }) => due ? <span className={`inline-flex flex-col items-center leading-[1.05] text-[#D92D20] ${className}`}><b className="text-[12px] font-semibold">{inr(due.amount)}</b><small className="text-[10.5px] font-medium">{due.age}</small></span> : null
export const DueInline = ({ due }) => due ? <b className="font-semibold text-[#D92D20]">{inr(due.amount)} ({due.age})</b> : <span className="text-gray-400">—</span>

export const STATUS_PILL = { Active: 'bg-[#E3F7EC] text-[#12A05C]', 'Partially Active': 'bg-[#FFF1DC] text-[#E58A00]', 'Membership Expired': 'bg-[#FDE8E8] text-[#D92D20]', 'Pending Payment': 'bg-[#FFF3DA] text-[#C27C0E]', Released: 'bg-gray-100 text-gray-600', Inactive: 'bg-gray-100 text-gray-500' }
export const StatusPill = ({ s }) => <span className={`inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium ${STATUS_PILL[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>

export const SeatDot = ({ c }) => <i className={`inline-block h-2.5 w-2.5 rounded-full ${{ green: 'bg-[#22C55E]', orange: 'bg-[#F59E0B]', red: 'bg-[#EF4444]', gray: 'bg-gray-400' }[c]}`} />

export const Select = ({ label, className = '', children, ...p }) => (
  <label className={`block text-[13px] text-gray-600 ${className}`}>{label}
    <select {...p} className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none focus:border-[#1F6FEB]">{children}</select>
  </label>
)
const useErr = () => { const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const run = async (fn) => { setBusy(true); setErr(''); try { await fn() } catch (e) { setErr(e.message) } finally { setBusy(false) } }; return { err, busy, run } }
const Footer = ({ err, busy, onClose, onSave, label = 'Save', disabled }) => (
  <>{err && <p className="mt-3 text-[13px] text-red-600">{err}</p>}<div className="mt-5 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn disabled={busy || disabled} onClick={onSave}>{busy ? 'Saving…' : label}</Btn></div></>
)

/* ───────── the "Add …" forms (used by the Add menu AND the pages that own the data) ───────── */
export function AddMember({ onClose, onDone, init = {} }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', className: '', notes: '', ...init }); const { err, busy, run } = useErr()
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Modal title={init.id ? 'Edit Member' : 'Add Member'} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Full name *" value={f.name} onChange={set('name')} autoFocus />
        <Field label="Mobile (10 digits)" value={f.phone} onChange={set('phone')} inputMode="numeric" maxLength={10} />
        <Field label="Email" value={f.email} onChange={set('email')} />
        <Field label="Class / exam (optional)" value={f.className} onChange={set('className')} />
        <Field label="Notes" value={f.notes} onChange={set('notes')} />
      </div>
      <Footer err={err} busy={busy} onClose={onClose} disabled={!f.name.trim()} onSave={() => run(async () => { const r = init.id ? await call('patch', `/api/seller/study/members/${init.id}`, f) : await call('post', '/api/seller/study/members', f); onDone(r) })} />
    </Modal>
  )
}

export function AddCourse({ onClose, onDone, init = null }) {
  const [f, setF] = useState({ name: '', description: '', duration: '', fee: '', instructor: '', capacity: '', status: 'active', ...(init || {}) }); const { err, busy, run } = useErr()
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Modal title={init ? 'Edit Course' : 'Add Course'} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Course name *" value={f.name} onChange={set('name')} autoFocus />
        <Field label="Fee (₹) *" type="number" min="0" value={f.fee} onChange={set('fee')} />
        <Field label="Duration" placeholder="3 Months" value={f.duration} onChange={set('duration')} />
        <Field label="Instructor" value={f.instructor} onChange={set('instructor')} />
        <Field label="Capacity (0 = no limit)" type="number" min="0" value={f.capacity} onChange={set('capacity')} />
        <Field className="sm:col-span-2" label="Description" value={f.description} onChange={set('description')} />
        {init && <Select label="Status" value={f.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive</option></Select>}
      </div>
      <Footer err={err} busy={busy} onClose={onClose} disabled={!f.name.trim() || f.fee === ''} onSave={() => run(async () => { init ? await call('patch', `/api/seller/study/courses/${init.id}`, f) : await call('post', '/api/seller/study/courses', f); onDone() })} />
    </Modal>
  )
}

// one generic form for every configuration list: zone · seat type · time slot · plan · charge type · study material
const LIST_FORMS = {
  zones: { title: 'Add Seat Zone', fields: [['name', 'Zone name *', 'text', 'Reading Room']] },
  seatTypes: { title: 'Add Seat Type', fields: [['name', 'Seat type *', 'text', 'Window seat']] },
  timeSlots: { title: 'Add Time Slot', fields: [['label', 'Label (optional)', 'text', 'Evening batch'], ['start', 'Starts *', 'time'], ['end', 'Ends *', 'time']] },
  plans: { title: 'Add Membership Plan', fields: [['name', 'Plan name *', 'text', '1 Month'], ['months', 'Duration (months) *', 'number'], ['price', 'Price (₹) *', 'number']] },
  chargeTypes: { title: 'Add Fine / Charge Type', fields: [['label', 'Name *', 'text', 'Late fee'], ['amount', 'Default amount (₹)', 'number'], ['kind', 'Kind', 'select', [['fine', 'Fine'], ['registration', 'Registration fee'], ['other', 'Other charge']]]] },
  materials: { title: 'Add Study Material', fields: [['name', 'Name *', 'text', 'GK Notes'], ['price', 'Price (₹)', 'number'], ['kind', 'Kind', 'select', [['book', 'Book'], ['notes', 'Notes'], ['stationery', 'Stationery'], ['other', 'Other']]]] },
}
export function AddToList({ list, onClose, onDone }) {
  const form = LIST_FORMS[list]; const [f, setF] = useState({}); const { err, busy, run } = useErr()
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Modal title={form.title} onClose={onClose}>
      <div className="grid gap-3">{form.fields.map(([k, label, type, extra], i) => type === 'select'
        ? <Select key={k} label={label} value={f[k] ?? extra[0][0]} onChange={set(k)}>{extra.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        : <Field key={k} label={label} type={type} placeholder={typeof extra === 'string' ? extra : ''} value={f[k] ?? ''} onChange={set(k)} autoFocus={i === 0} />)}</div>
      <Footer err={err} busy={busy} onClose={onClose} onSave={() => run(async () => { await call('post', `/api/seller/study/config/${list}`, f); onDone() })} />
    </Modal>
  )
}

// Add Seat: the owner chooses the NAMING — grid (A1, A2 … B1 …) · numbered / prefixed (1, 2, 3 · 101 · Cabin-1) · custom list
export function AddSeats({ onClose, onDone, config }) {
  const last = config?.lastNaming || {}
  const [mode, setMode] = useState(last.mode || 'grid')
  const [f, setF] = useState({ rows: last.rows || 2, perRow: last.perRow || 10, startRow: last.startRow || 'A', prefix: last.prefix || '', start: last.start ?? 1, count: last.count || 10, pad: last.pad || 0, names: '', zone: config?.zones?.[0]?.key || '', type: config?.seatTypes?.[0]?.key || 'regular' })
  const { err, busy, run } = useErr(); const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const preview = (() => {
    const out = []
    if (mode === 'grid') { for (let r = 0; r < Math.min(+f.rows || 0, 2); r++) for (let c = 1; c <= Math.min(+f.perRow || 0, 4); c++) out.push(`${String.fromCharCode((f.startRow || 'A').toUpperCase().charCodeAt(0) + r)}${c}`) }
    else if (mode === 'sequence') for (let i = 0; i < Math.min(+f.count || 0, 6); i++) out.push(`${f.prefix}${String((+f.start || 0) + i).padStart(+f.pad || 0, '0')}`)
    else out.push(...f.names.split(/[\n,]/).map((x) => x.trim()).filter(Boolean).slice(0, 6))
    return out
  })()
  const naming = mode === 'grid' ? { mode, rows: +f.rows, perRow: +f.perRow, startRow: f.startRow } : mode === 'sequence' ? { mode, prefix: f.prefix, start: +f.start, count: +f.count, pad: +f.pad } : { mode, names: f.names }
  return (
    <Modal title="Add Seats" onClose={onClose}>
      <p className="mb-3 text-[13px] text-gray-500">Choose how this block of seats is named — every centre numbers its seats differently.</p>
      <div className="mb-3 flex flex-wrap gap-2">{[['grid', 'Rows (A1, B1…)'], ['sequence', 'Numbers / prefix (1, 101, Cabin-1)'], ['custom', 'Custom names']].map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${mode === k ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'}`}>{l}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {mode === 'grid' && <><Field label="Rows" type="number" min="1" value={f.rows} onChange={set('rows')} /><Field label="Seats per row" type="number" min="1" value={f.perRow} onChange={set('perRow')} /><Field label="First row letter" maxLength={2} value={f.startRow} onChange={set('startRow')} /></>}
        {mode === 'sequence' && <><Field label="Prefix (optional)" placeholder="Cabin-" value={f.prefix} onChange={set('prefix')} /><Field label="Start number" type="number" value={f.start} onChange={set('start')} /><Field label="How many seats" type="number" min="1" value={f.count} onChange={set('count')} /><Field label="Zero padding" type="number" min="0" value={f.pad} onChange={set('pad')} /></>}
        {mode === 'custom' && <label className="block text-[13px] text-gray-600 sm:col-span-3">Seat names (comma or one per line)<textarea rows={3} value={f.names} onChange={set('names')} className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-[14px] outline-none focus:border-[#1F6FEB]" placeholder="Window-1, Window-2, Corner" /></label>}
        <Select label="Zone" value={f.zone} onChange={set('zone')}>{(config?.zones || []).map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}</Select>
        <Select label="Seat type" value={f.type} onChange={set('type')}>{(config?.seatTypes || []).map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}</Select>
      </div>
      {preview.length > 0 && <p className="mt-3 text-[12.5px] text-gray-500">Preview: <b className="text-gray-800">{preview.join(', ')}{mode !== 'custom' ? ' …' : ''}</b></p>}
      <Footer err={err} busy={busy} onClose={onClose} label="Create seats" onSave={() => run(async () => { const r = await call('post', '/api/seller/study/seats', { naming, zone: f.zone, type: f.type }); onDone(r) })} />
    </Modal>
  )
}

export function useStudyConfig() {
  const [cfg, setCfg] = useState(null)
  const load = () => call('get', '/api/seller/study/config').then((r) => setCfg({ ...r.config, window: r.window })).catch(() => {})
  useEffect(() => { load() }, [])
  return [cfg, load]
}
