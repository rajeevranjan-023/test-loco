import React, { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { OwnerLink as Link } from '../../../hooks/useOwnerPath.jsx'
import { ArrowLeft, Pencil, Plus, Wallet } from 'lucide-react'
import { useSeller, call, Modal, Field } from '../kit.jsx'
import { Card } from '../ui.jsx'
import { Avatar, EntryModal, inr, dt } from '../udhar/parts.jsx'
import Timeline from '../customer/Timeline.jsx'

// Customer header badge: Pending (red) · Advance (green) · Clear (gray)
const BADGE = { pending: ['Pending', 'bg-[#FDE8E8] text-[#D92D20]'], advance: ['Advance', 'bg-[#E3F7EC] text-[#12A05C]'], cleared: ['Clear', 'bg-[#F1F3F7] text-gray-600'] }
const modalBtn = 'h-10 rounded-xl px-4 text-[14px] font-medium transition disabled:opacity-50'

const Pill = ({ cls, children }) => <span className={`inline-block rounded-md px-2.5 py-0.5 text-center text-[11.5px] font-medium ${cls}`}>{children}</span>

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { hash } = useLocation()
  const q = useSeller(`/api/customers/${id}`)
  const [entry, setEntry] = useState(null); const [editing, setEditing] = useState(false); const [toast, setToast] = useState('')
  const [adjust, setAdjust] = useState(false); const [ver, setVer] = useState(0)
  const c = q.data

  // Deep links from the table (#transactions · #udhar · #balance) scroll to that section once the data is in
  useEffect(() => { if (c && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [c, hash])
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2400) }
  const act = (type) => setEntry({ customer: { id: c.id, name: c.name, phone: c.phone, total: c.balance }, type })

  if (q.error) return <div className="space-y-3"><Back /><div className="rounded-xl bg-red-50 p-4 text-[13.5px] text-red-600">{q.error} <button type="button" onClick={q.reload} className="ml-2 font-medium underline">Retry</button></div></div>
  if (!c) return <div className="space-y-3"><Back />{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200/70" />)}</div>

  const [badgeText, badgeCls] = BADGE[c.status] || BADGE.cleared
  return (
    <div className="space-y-4">
      <Back />

      {/* Header */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={c.name} size={48} i={1} />
            <div className="min-w-0 leading-tight">
              <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-[18px] font-semibold text-gray-900">{c.name}</h2><Pill cls={badgeCls}>{badgeText}</Pill></div>
              <div className="mt-0.5 text-[13px] text-gray-500">{c.phone || 'No phone number'}{c.createdAt ? ` · Customer since ${dt(c.createdAt)}` : ''}</div>
            </div>
            <button type="button" onClick={() => setEditing(true)} title="Edit customer" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#BFD4F7] text-[#2F6FEB] hover:bg-[#F2F7FF]"><Pencil size={14} /></button>
          </div>
          {/* Quick actions */}
          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
            <button type="button" onClick={() => act('udhar')} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 text-[12.5px] font-medium text-white transition hover:bg-orange-600"><Plus size={14} />Add Udhar</button>
            <button type="button" onClick={() => act('payment')} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#E3F7EC] px-3 text-[12.5px] font-medium text-[#12A05C] transition hover:bg-[#d3f0e0]"><Plus size={14} />Receive Payment</button>
            <button type="button" onClick={() => act('credit')} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#E6F0FE] px-3 text-[12.5px] font-medium text-[#2F6FEB] transition hover:bg-[#d8e7fd]"><Wallet size={14} />Adjust Balance</button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat l="Total Orders" v={c.totalOrders} />
        <Stat l="Total Spent" v={inr(c.totalSpent)} />
        <Stat l="Pending Udhar" v={inr(c.udharBalance)} tone="bg-[#FDECEC]" lc="text-[#D92D20]" vc="text-[#D92D20]" />
        <Stat l="Advance Balance" v={inr(c.creditBalance)} tone="bg-[#EAF8F0]" lc="text-[#12A05C]" vc="text-[#12A05C]" />
      </div>

      {/* Transaction timeline: Bill · Payment · Udhar · Adjustment, running balance, graphs */}
      <Timeline customerId={c.id} initial={hash === '#udhar' ? 'udhar' : hash === '#balance' ? 'advance' : 'all'} version={ver} onAdjust={() => setAdjust(true)} />

      {entry && <EntryModal init={entry} onClose={() => setEntry(null)} onSaved={() => { setEntry(null); q.reload(); setVer((v) => v + 1); say('Saved') }} />}
      {adjust && <AdjustModal c={c} onClose={() => setAdjust(false)} onSaved={() => { setAdjust(false); q.reload(); setVer((v) => v + 1); say('Adjustment recorded') }} />}
      {editing && <EditCustomerModal c={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); q.reload(); say('Customer updated') }} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] text-white shadow-lg">{toast}</div>}
    </div>
  )
}

const Back = () => <Link to="/analytics/customers" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2F6FEB] hover:underline"><ArrowLeft size={15} />Back to Customers</Link>
const Stat = ({ l, v, tone = 'bg-white', lc = 'text-gray-500', vc = 'text-gray-900' }) => <div className={`rounded-xl border border-[#EEF0F5] px-3.5 py-2.5 ${tone}`}><div className={`text-[12px] ${lc}`}>{l}</div><div className={`text-[19px] font-semibold leading-tight ${vc}`}>{v}</div></div>

function EditCustomerModal({ c, onClose, onSaved }) {
  const [f, setF] = useState({ name: c.name, phone: c.phone || '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const save = async () => { setBusy(true); setErr(''); try { await call('patch', `/api/customers/${c.id}`, f); onSaved() } catch (e) { setErr(e.message); setBusy(false) } }
  return (
    <Modal title="Edit Customer" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="Mobile (10 digits)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
        {err && <p className="text-[13px] text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className={`${modalBtn} border border-gray-200 text-gray-700 hover:bg-gray-50`}>Cancel</button><button type="button" onClick={save} disabled={busy || !f.name.trim()} className={`${modalBtn} bg-orange-500 text-white hover:bg-orange-600`}>Save</button></div>
      </div>
    </Modal>
  )
}

// Manual correction: + the customer owes more · − the customer owes less. Always logged as an "Adjustment" with a reason.
function AdjustModal({ c, onClose, onSaved }) {
  const [dir, setDir] = useState('down'); const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const a = Number(amount) || 0, after = c.balance + (dir === 'up' ? a : -a)
  const save = async () => { setBusy(true); setErr(''); try { await call('post', `/api/customers/${c.id}/adjustment`, { amount: dir === 'up' ? a : -a, note }); onSaved() } catch (e) { setErr(e.message); setBusy(false) } }
  const seg = (on) => `h-9 flex-1 rounded-lg border text-[12.5px] font-medium transition ${on ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`
  return (
    <Modal title="Balance Adjustment" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); a > 0 && note.trim().length > 1 && save() }} className="space-y-3 text-[13px]">
        <div className="flex gap-2"><button type="button" onClick={() => setDir('down')} className={seg(dir === 'down')}>− Reduce udhar</button><button type="button" onClick={() => setDir('up')} className={seg(dir === 'up')}>+ Increase udhar</button></div>
        <label className="block text-[12px] text-gray-600">Amount (₹)<input autoFocus value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[18px] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
        <label className="block text-[12px] text-gray-600">Reason<input value={note} maxLength={300} placeholder="e.g. discount on settlement, wrong entry fixed" onChange={(e) => setNote(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 outline-none focus:border-orange-400" /></label>
        {a > 0 && <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[12px] text-gray-600">New balance: <b className={after > 0 ? 'text-[#D92D20]' : after < 0 ? 'text-[#12A05C]' : 'text-gray-700'}>{after > 0 ? `${inr(after)} Udhar` : after < 0 ? `${inr(-after)} Advance` : '₹0 · Clear'}</b></div>}
        {err && <p className="text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4">Cancel</button><button type="submit" disabled={busy || !(a > 0) || note.trim().length < 2} className="h-9 rounded-lg bg-orange-500 px-5 font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save Adjustment'}</button></div>
      </form>
    </Modal>
  )
}
