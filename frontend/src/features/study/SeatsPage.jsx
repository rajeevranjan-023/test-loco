import React, { useMemo, useState } from 'react'
import { Plus, Search, X, Settings, Download, Trash2, ChevronDown } from 'lucide-react'
import { useSeller, call, PageHead, Btn, State, Modal } from '../analytics/kit.jsx'
import { Card } from '../analytics/ui.jsx'
import { Avatar } from '../analytics/udhar/parts.jsx'
import { useOwnerNavigate } from '../../hooks/useOwnerPath.jsx'
import { inr, dt, slotText, DueStack, DueInline, SeatDot, Select, AddSeats, AddToList, useStudyConfig } from './shared.jsx'

// Seat colours come from the SERVER (seat.state, computed from active seat assignments only):
//   green = fully occupied · orange = partially occupied · red = empty · gray = unavailable.
// An expired membership or an unpaid due never changes a seat's colour — the due is simply shown in red on the tile.
const TILE = { occupied: 'border-[#9AE6B4] bg-[#C6F6D5]/70 text-gray-900', partial: 'border-[#F6D58B] bg-[#FDE9B6]/80 text-gray-900', empty: 'border-[#F5B5B5] bg-[#FCD5D5]/80 text-gray-900', unavailable: 'border-gray-200 bg-gray-200/80 text-gray-500' }
const STATE_LABEL = { occupied: 'Occupied', partial: 'Partially Occupied', empty: 'Empty', unavailable: 'Unavailable' }
const PILL = { occupied: 'bg-[#E3F7EC] text-[#12A05C]', partial: 'bg-[#FFF1DC] text-[#E58A00]', empty: 'bg-[#FDE8E8] text-[#D92D20]', unavailable: 'bg-gray-100 text-gray-500' }
const rowOf = (name) => (name.match(/^([A-Za-z]+)\d+$/) || [])[1] || null

function Stat({ label, value, sub, tone = 'text-gray-900', badge }) {
  return <Card className="px-5 py-4"><div className="text-[13px] text-gray-500">{label}</div><div className="mt-1 flex items-end gap-3"><span className={`text-[30px] font-semibold leading-none ${tone}`}>{value}</span>{badge && <span className={`mb-0.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${badge[1]}`}>{badge[0]}</span>}{sub && <span className="mb-0.5 text-[12.5px] text-gray-500">{sub}</span>}</div></Card>
}

function Tile({ seat, onClick, picked }) {
  // fully occupied / empty tiles show ONLY the seat id (+ due); time slots appear only in the popup of a partial seat
  return (
    <button type="button" onClick={onClick} aria-label={`Seat ${seat.name}, ${STATE_LABEL[seat.state]}${seat.due ? `, due ${seat.due.amount}` : ''}`}
      className={`relative flex h-[42px] items-center justify-between rounded-lg border px-2.5 text-[13px] font-medium transition hover:scale-[1.03] hover:shadow ${TILE[seat.state]} ${picked ? 'ring-2 ring-[#1F6FEB]' : ''}`}>
      <span>{seat.name}</span><DueStack due={seat.due} />
    </button>
  )
}

function SeatDetail({ seat, onClose, onChanged, config }) {
  const nav = useOwnerNavigate()
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [assign, setAssign] = useState(false)
  const act = async (fn) => { setBusy(true); setMsg(''); try { await fn(); onChanged() } catch (e) { setMsg(e.message) } finally { setBusy(false) } }
  const release = (p) => window.confirm(`Release seat ${seat.name} for ${p.name} (${p.slotLabel})? The member's history is kept.`) && act(() => call('post', `/api/seller/study/assignments/${p.assignmentId}/release`, {}))
  return (
    <Modal title={`Seat ${seat.name}`} onClose={onClose}>
      <div className="-mt-2 mb-3 flex items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${PILL[seat.state]}`}>{STATE_LABEL[seat.state]}</span><span className="text-[12.5px] text-gray-500">{seat.zoneName} · {seat.typeName}</span>{seat.due && <span className="ml-auto text-[12.5px]">Due <DueInline due={seat.due} /></span>}</div>
      {seat.people.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-[13.5px] text-gray-600">{seat.state === 'unavailable' ? (seat.note || 'This seat is unavailable.') : 'Nobody is assigned to this seat.'}</p>}
      {seat.people.length > 0 && <>
        <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-500">{seat.state === 'partial' ? 'Current members' : 'Current member'}</div>
        <div className="space-y-2">{seat.people.map((p) => (
          <div key={p.assignmentId} className="rounded-xl border border-gray-100 p-3">
            <div className="flex items-center gap-2.5"><Avatar name={p.name} size={34} /><div className="min-w-0 flex-1 leading-tight"><button type="button" onClick={() => nav(`/members/${p.memberId}`)} className="block truncate text-left text-[14px] font-semibold hover:text-orange-600">{p.name}</button><span className="text-[12px] text-gray-500">{p.memberCode} · {p.phone || 'no phone'}</span></div><button type="button" disabled={busy} onClick={() => release(p)} className="rounded-lg border border-[#F5C2C2] px-2.5 py-1 text-[12px] font-medium text-[#D92D20] hover:bg-[#FDE8E8]">Release Seat</button></div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-gray-600"><span>Slot: <b className="text-gray-800">{p.slotLabel}</b></span><span>Valid till: <b className={p.expired ? 'text-[#D92D20]' : 'text-gray-800'}>{dt(p.validTill)}{p.expired ? ' (expired)' : ''}</b></span>{p.due > 0 && <span>Pending: <b className="text-[#D92D20]">{inr(p.due)}</b></span>}{p.releaseRequestedAt && <span className="rounded bg-[#FFF1DC] px-1.5 text-[11.5px] text-[#E58A00]">Member asked to leave</span>}</div>
          </div>))}</div></>}
      {seat.state === 'partial' && <div className="mt-3"><div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-500">Time slots</div><ul className="space-y-1.5">{seat.people.map((p) => <li key={p.assignmentId} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-1.5 text-[13px]"><span>{p.slotLabel}</span><span className="rounded-md bg-[#E3F7EC] px-2.5 py-0.5 text-[12px] font-medium text-[#12A05C]">Occupied</span></li>)}<li className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-1.5 text-[13px]"><span>Remaining time of the day</span><span className="rounded-md bg-[#FDE8E8] px-2.5 py-0.5 text-[12px] font-medium text-[#D92D20]">Empty</span></li></ul></div>}
      {msg && <p className="mt-3 text-[13px] text-red-600">{msg}</p>}
      {seat.state !== 'unavailable' && <div className="mt-4 flex flex-wrap justify-end gap-2">{seat.state !== 'occupied' && <Btn onClick={() => setAssign(true)}>Assign member</Btn>}</div>}
      {assign && <AssignSeat seat={seat} config={config} onClose={() => setAssign(false)} onDone={() => { setAssign(false); onChanged() }} />}
    </Modal>
  )
}

function AssignSeat({ seat, config, onClose, onDone }) {
  const members = useSeller('/api/seller/study/members')
  const [memberId, setMemberId] = useState(''); const [fullDay, setFullDay] = useState(true); const [start, setStart] = useState(config?.window?.open || '06:00'); const [end, setEnd] = useState(config?.window?.close || '22:00'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const save = async () => { setBusy(true); setErr(''); try { await call('post', `/api/seller/study/seats/${seat.id}/assign`, { memberId, fullDay, slot: { start, end } }); onDone() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <Modal title={`Assign a member to ${seat.name}`} onClose={onClose}>
      <Select label="Member" value={memberId} onChange={(e) => setMemberId(e.target.value)}><option value="">Select member…</option>{(members.data || []).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.memberCode}</option>)}</Select>
      <label className="mt-3 flex items-center gap-2 text-[14px]"><input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} />Full day</label>
      {!fullDay && <div className="mt-2 grid grid-cols-2 gap-3"><label className="text-[13px] text-gray-600">From<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[14px]" /></label><label className="text-[13px] text-gray-600">To<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[14px]" /></label></div>}
      <p className="mt-2 text-[12px] text-gray-500">Overlapping times on the same seat are refused. Take payment for the membership from Billing.</p>
      {err && <p className="mt-3 text-[13px] text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn disabled={!memberId || busy} onClick={save}>{busy ? 'Assigning…' : 'Assign'}</Btn></div>
    </Modal>
  )
}

function EditSeat({ seat, config, onClose, onDone }) {
  const [f, setF] = useState({ name: seat.name, zone: seat.zone, type: seat.type, disabled: seat.disabled, note: seat.note }); const [err, setErr] = useState('')
  const save = async () => { try { await call('patch', `/api/seller/study/seats/${seat.id}`, f); onDone() } catch (e) { setErr(e.message) } }
  const del = async () => { if (!window.confirm(`Delete seat ${seat.name}?`)) return; try { await call('delete', `/api/seller/study/seats/${seat.id}`); onDone() } catch (e) { setErr(e.message) } }
  return (
    <Modal title={`Edit seat ${seat.name}`} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] text-gray-600 sm:col-span-2">Seat name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[14px]" /></label>
        <Select label="Zone" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}>{config.zones.map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}</Select>
        <Select label="Seat type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{config.seatTypes.map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}</Select>
        <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" checked={f.disabled} onChange={(e) => setF({ ...f, disabled: e.target.checked })} />Unavailable (gray) — under maintenance / reserved</label>
        <label className="block text-[13px] text-gray-600 sm:col-span-2">Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[14px]" /></label>
      </div>
      {err && <p className="mt-3 text-[13px] text-red-600">{err}</p>}
      <div className="mt-4 flex justify-between"><Btn variant="danger" onClick={del}>Delete</Btn><div className="flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}>Save</Btn></div></div>
    </Modal>
  )
}

function Layout({ config, reload, onClose }) {
  const [add, setAdd] = useState(null)
  const del = async (list, key) => { try { await call('delete', `/api/seller/study/config/${list}/${key}`); reload() } catch (e) { window.alert(e.message) } }
  const Block = ({ title, list, items, label }) => (
    <div className="mb-4"><div className="mb-1.5 flex items-center justify-between"><h4 className="text-[14px] font-semibold">{title}</h4><button type="button" onClick={() => setAdd(list)} className="text-[12.5px] font-medium text-[#2F6FEB]">+ Add</button></div>
      <div className="flex flex-wrap gap-2">{items.map((x) => <span key={x.key} className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[12.5px]">{label(x)}<button type="button" aria-label="Remove" onClick={() => del(list, x.key)}><X size={12} /></button></span>)}{!items.length && <span className="text-[12.5px] text-gray-400">None yet</span>}</div></div>
  )
  return (
    <Modal title="Configure Layout" onClose={onClose}>
      <Block title="Zones" list="zones" items={config.zones} label={(z) => z.name} />
      <Block title="Seat types" list="seatTypes" items={config.seatTypes} label={(z) => z.name} />
      <Block title="Time slots" list="timeSlots" items={config.timeSlots} label={(t) => `${t.label} (${t.start}–${t.end})`} />
      <p className="text-[12px] text-gray-500">Centre hours {config.window?.open}–{config.window?.close}. A seat is “fully occupied” when its members cover all of these hours.</p>
      {add && <AddToList list={add} onClose={() => setAdd(null)} onDone={() => { setAdd(null); reload() }} />}
    </Modal>
  )
}

export default function SeatsPage() {
  const q = useSeller('/api/seller/study/seats')
  const [config, reloadConfig] = useStudyConfig()
  const [status, setStatus] = useState('all'); const [zone, setZone] = useState('all'); const [type, setType] = useState('all'); const [search, setSearch] = useState(''); const [view, setView] = useState('grid'); const [zoneTab, setZoneTab] = useState('all')
  const [open, setOpen] = useState(null); const [edit, setEdit] = useState(null); const [adding, setAdding] = useState(false); const [layout, setLayout] = useState(false); const [picked, setPicked] = useState(new Set()); const [toast, setToast] = useState('')
  const seats = q.data?.seats || [], sum = q.data?.summary
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3000) }
  const refresh = () => { q.reload(); reloadConfig() }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return seats.filter((x) => (status === 'all' || x.state === status) && (zone === 'all' || x.zone === zone) && (type === 'all' || x.type === type) && (!s || x.name.toLowerCase().includes(s) || x.people.some((p) => p.name.toLowerCase().includes(s))))
  }, [seats, status, zone, type, search])
  const gridSeats = zoneTab === 'all' ? filtered : filtered.filter((x) => x.zone === zoneTab)
  const rows = useMemo(() => { // rows by name prefix (A1, A2 → row "A"); other naming (1, 2, Cabin-1) is chunked into rows of 10
    const m = new Map(); let i = 0
    for (const s of gridSeats) { const key = rowOf(s.name) ?? `#${Math.floor(i / 10)}`; (m.get(key) || m.set(key, []).get(key)).push(s); i++ }
    return [...m.entries()]
  }, [gridSeats])
  const zoneCount = (z) => seats.filter((s) => s.zone === z).length
  const togglePick = (s) => setPicked((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n })
  const releasePicked = async () => {
    const ids = seats.filter((s) => picked.has(s.id)).flatMap((s) => s.people.map((p) => p.assignmentId))
    if (!ids.length) return say('The selected seats have no members to release.')
    if (!window.confirm(`Release ${ids.length} seat assignment${ids.length > 1 ? 's' : ''}? Member history is kept.`)) return
    try { const r = await call('post', '/api/seller/study/assignments/release', { ids }); say(`${r.released} released`); setPicked(new Set()); refresh() } catch (e) { say(e.message) }
  }
  const exportCsv = () => {
    const head = ['Seat', 'Zone', 'Type', 'Status', 'Member', 'Slot', 'Valid till', 'Due', 'Due age']
    const lines = filtered.map((s) => [s.name, s.zoneName, s.typeName, STATE_LABEL[s.state], s.people.map((p) => p.name).join(' / '), s.people.map((p) => p.slotLabel).join(' / '), s.validTill ? dt(s.validTill) : '', s.due?.amount || 0, s.due?.age || ''])
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'seats.csv'; a.click()
  }
  const chips = [['all', `All (${seats.length})`], ['occupied', `Occupied (${sum?.occupied ?? 0})`], ['partial', `Partial (${sum?.partial ?? 0})`], ['empty', `Empty (${sum?.empty ?? 0})`]]
  const chip = (on) => `rounded-full border px-5 py-2 text-[14px] font-medium transition ${on ? 'border-[#1F6FEB] bg-[#1F6FEB] text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-[#1F6FEB]/40'}`

  return (
    <div>
      {toast && <div role="status" className="fixed right-4 top-16 z-50 rounded-lg bg-[#E3F7EC] px-3 py-2 text-[13px] font-medium text-[#0E7F4A] shadow-lg">{toast}</div>}
      <PageHead title="Seat Management" sub="Manage study seats, view occupancy, and track membership status (expired seats keep the same status with the due amount)."><Btn onClick={() => setAdding(true)}><Plus size={16} />Add Seat</Btn></PageHead>
      <State q={q} empty={q.data && !seats.length && null}>
        {sum && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Total Seats" value={sum.total} />
          <Stat label="Occupied" value={sum.occupied} badge={[`${sum.occupiedPct}%`, 'bg-[#E3F7EC] text-[#12A05C]']} />
          <Stat label="Partially Occupied" value={sum.partial} badge={[`${sum.partialPct}%`, 'bg-[#FFF1DC] text-[#E58A00]']} />
          <Stat label="Empty" value={sum.empty} badge={[`${sum.emptyPct}%`, 'bg-[#FDE8E8] text-[#D92D20]']} />
          <Stat label="Pending Amount" value={inr(sum.pendingAmount)} tone="text-[#D92D20]" sub={`${sum.pendingMembers} member${sum.pendingMembers === 1 ? '' : 's'}`} />
        </div>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map(([k, l]) => <button key={k} type="button" onClick={() => setStatus(k)} className={chip(status === k)}>{l}</button>)}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select aria-label="Zone" value={zone} onChange={(e) => setZone(e.target.value)} className="w-[150px]"><option value="all">All Zones</option>{(config?.zones || []).map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}</Select>
            <Select aria-label="Seat type" value={type} onChange={(e) => setType(e.target.value)} className="w-[160px]"><option value="all">All Seat Types</option>{(config?.seatTypes || []).map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}</Select>
            <label className="flex h-10 w-[260px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3"><Search size={15} className="text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search seat (e.g. A1, 12, Cabin 3)" className="w-full text-[13.5px] outline-none" /></label>
          </div>
        </div>

        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-[19px] font-semibold">Seat Layout</h3><p className="text-[13px] text-gray-500">Click on a seat to view details or edit</p></div>
            <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-gray-700">{[['green', 'Occupied'], ['orange', 'Partially Occupied'], ['red', 'Empty'], ['gray', 'Unavailable']].map(([c, l]) => <span key={c} className="flex items-center gap-1.5"><SeatDot c={c} />{l}</span>)}
              <button type="button" onClick={() => setLayout(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#BFD7FB] bg-[#F5F9FF] px-3 text-[13px] font-medium text-[#2F6FEB]"><Settings size={14} />Configure Layout</button></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">{[['all', `All (${seats.length})`], ...(config?.zones || []).map((z) => [z.key, `${z.name} (${zoneCount(z.key)})`])].map(([k, l]) => <button key={k} type="button" onClick={() => setZoneTab(k)} className={`rounded-full border px-4 py-1.5 text-[13px] font-medium ${zoneTab === k ? 'border-[#1F6FEB] bg-[#1F6FEB] text-white' : 'border-gray-200 text-gray-700 hover:border-[#1F6FEB]/40'}`}>{l}</button>)}</div>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 text-[13px]">{[['grid', 'Grid View'], ['list', 'List View']].map(([k, l]) => <button key={k} type="button" onClick={() => setView(k)} className={`px-4 py-1.5 font-medium ${view === k ? 'bg-[#1F6FEB] text-white' : 'bg-white text-gray-600'}`}>{l}</button>)}</div>
          </div>
          {view === 'grid' && (!rows.length ? <p className="py-10 text-center text-[14px] text-gray-500">{seats.length ? 'No seats match these filters.' : 'No seats yet — press “Add Seat” and choose how you name them.'}</p>
            : <div className="mt-4 space-y-2 overflow-x-auto">{rows.map(([key, list]) => (
              <div key={key} className="flex min-w-[720px] items-center gap-3"><span className="w-5 shrink-0 text-center text-[13px] font-medium text-gray-700">{key.startsWith('#') ? '' : key}</span>
                <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}>{list.map((s) => <Tile key={s.id} seat={s} picked={picked.has(s.id)} onClick={() => setOpen(s.id)} />)}</div></div>))}</div>)}
        </Card>

        <Card className="mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4"><h3 className="text-[19px] font-semibold">Seats ({filtered.length})</h3>
            <div className="flex gap-2"><Btn variant="ghost" onClick={exportCsv}><Download size={15} />Export</Btn><button type="button" onClick={releasePicked} disabled={!picked.size} className="flex h-10 items-center gap-2 rounded-xl border border-[#F5C2C2] bg-[#FDE8E8] px-4 text-[14px] font-medium text-[#D92D20] disabled:opacity-50"><Trash2 size={15} />Mark as Released{picked.size ? ` (${picked.size})` : ''}</button></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-[14px]">
            <thead className="bg-gray-50 text-left text-[12.5px] font-semibold text-gray-700"><tr><th className="w-10 px-4 py-2.5"><input type="checkbox" aria-label="Select all" checked={filtered.length > 0 && filtered.every((s) => picked.has(s.id))} onChange={(e) => setPicked(e.target.checked ? new Set(filtered.map((s) => s.id)) : new Set())} /></th><th>Seat ID</th><th>Zone</th><th>Type</th><th>Status</th><th>Member</th><th>Time Slot</th><th>Valid Till</th><th>Amount (Due)</th><th className="pr-4">Actions</th></tr></thead>
            <tbody>{filtered.slice(0, 200).map((s) => { const p = s.people[0]; return (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                <td className="px-4 py-2.5"><input type="checkbox" aria-label={`Select ${s.name}`} checked={picked.has(s.id)} onChange={() => togglePick(s)} /></td>
                <td className="font-medium">{s.name}</td><td>{s.zoneName}</td><td>{s.typeName}</td>
                <td><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${PILL[s.state]}`}><SeatDot c={s.color} />{s.state === 'occupied' ? 'Occupied' : s.state === 'partial' ? 'Partially' : s.state === 'empty' ? 'Empty' : 'Unavailable'}</span></td>
                <td>{p ? <>{p.name}{s.people.length > 1 && <span className="text-gray-400"> +{s.people.length - 1}</span>}</> : <span className="text-gray-400">—</span>}</td>
                <td className="text-[13px] text-gray-600">{s.state === 'partial' ? s.people.map((x) => x.slotLabel).join(', ') : p ? slotText(p.slot) : '—'}</td>
                <td className={p?.expired ? 'text-[#D92D20]' : 'text-gray-700'}>{s.validTill ? dt(s.validTill) : '—'}</td>
                <td><DueInline due={s.due} /></td>
                <td className="pr-4"><div className="flex gap-1.5"><button type="button" onClick={() => setOpen(s.id)} className="rounded-lg bg-[#E6F0FE] px-3.5 py-1.5 text-[13px] font-medium text-[#2F6FEB]">View</button><button type="button" onClick={() => setEdit(s)} className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-[13px]">Edit</button><button type="button" onClick={() => setOpen(s.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200" aria-label="Assign or release"><ChevronDown size={14} /></button></div></td>
              </tr>) })}
              {!filtered.length && <tr><td colSpan={10} className="py-10 text-center text-gray-500">No seats to show.</td></tr>}</tbody>
          </table></div>
        </Card>
      </State>
      {open && seats.find((s) => s.id === open) && <SeatDetail seat={seats.find((s) => s.id === open)} config={config} onClose={() => setOpen(null)} onChanged={refresh} />}
      {edit && config && <EditSeat seat={edit} config={config} onClose={() => setEdit(null)} onDone={() => { setEdit(null); refresh() }} />}
      {adding && config && <AddSeats config={config} onClose={() => setAdding(false)} onDone={(r) => { setAdding(false); say(`${r.created} seats created`); refresh() }} />}
      {layout && config && <Layout config={config} reload={reloadConfig} onClose={() => { setLayout(false); refresh() }} />}
    </div>
  )
}
