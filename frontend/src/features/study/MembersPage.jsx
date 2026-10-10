import React, { useMemo, useState } from 'react'
import { Search, Plus, Users } from 'lucide-react'
import { useSeller, PageHead, Btn, State } from '../analytics/kit.jsx'
import { Card } from '../analytics/ui.jsx'
import { Avatar } from '../analytics/udhar/parts.jsx'
import { useOwnerNavigate } from '../../hooks/useOwnerPath.jsx'
import { inr, dt, StatusPill, DueInline, AddMember } from './shared.jsx'

const STATUSES = ['All', 'Active', 'Partially Active', 'Pending Payment', 'Membership Expired', 'Released', 'Inactive']

export default function MembersPage() {
  const q = useSeller('/api/seller/study/members')
  const nav = useOwnerNavigate()
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('All'); const [adding, setAdding] = useState(false)
  const all = q.data || []
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, s === 'All' ? all.length : all.filter((m) => m.status === s).length])), [all])
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return all.filter((m) => (status === 'All' || m.status === status) && (!s || m.name.toLowerCase().includes(s) || m.phone.includes(s) || m.memberCode.toLowerCase().includes(s) || (m.className || '').toLowerCase().includes(s)))
  }, [all, search, status])
  const dueTotal = all.reduce((t, m) => t + (m.due?.amount || 0), 0)
  return (
    <div>
      <PageHead title="Members" sub="Everyone who studies at your center — membership, seat and dues in one place."><Btn onClick={() => setAdding(true)}><Plus size={16} />Add Member</Btn></PageHead>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[['Total Members', all.length, 'text-gray-900'], ['Active', counts.Active + counts['Partially Active'], 'text-[#12A05C]'], ['Expired', counts['Membership Expired'], 'text-[#D92D20]'], ['Pending Dues', inr(dueTotal), 'text-[#D92D20]']].map(([l, v, c]) => <Card key={l} className="px-5 py-4"><div className="text-[13px] text-gray-500">{l}</div><div className={`mt-1 text-[26px] font-semibold ${c}`}>{v}</div></Card>)}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-full border px-4 py-1.5 text-[13px] font-medium ${status === s ? 'border-[#1F6FEB] bg-[#1F6FEB] text-white' : 'border-gray-200 bg-white text-gray-700'}`}>{s} ({counts[s]})</button>)}
        <label className="ml-auto flex h-10 w-[280px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3"><Search size={15} className="text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, member ID, class" className="w-full text-[13.5px] outline-none" /></label>
      </div>
      <State q={q} empty={q.data && !all.length && 'No members yet. Add your first member.'}>
        <Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-[14px]">
          <thead className="bg-gray-50 text-left text-[12.5px] font-semibold text-gray-700"><tr><th className="px-4 py-2.5">Member</th><th>Member ID</th><th>Plan</th><th>Seat</th><th>Valid Till</th><th>Status</th><th>Due</th></tr></thead>
          <tbody>{rows.map((m) => (
            <tr key={m.id} onClick={() => nav(`/members/${m.id}`)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50/60">
              <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar name={m.name} size={32} /><span className="leading-tight"><b className="block font-medium">{m.name}</b><small className="text-[12px] text-gray-500">{m.phone || '—'}{m.className ? ` · ${m.className}` : ''}</small></span></div></td>
              <td className="text-gray-600">{m.memberCode}</td><td>{m.plan || <span className="text-gray-400">—</span>}</td>
              <td>{m.seats.length ? m.seats.map((s) => `${s.name}${m.seats.length > 1 || s.slotLabel !== 'Full Day' ? ` (${s.slotLabel})` : ''}`).join(', ') : <span className="text-gray-400">—</span>}</td>
              <td className={m.status === 'Membership Expired' ? 'text-[#D92D20]' : ''}>{m.endDate ? dt(m.endDate) : '—'}</td>
              <td><StatusPill s={m.status} /></td><td><DueInline due={m.due} /></td>
            </tr>))}
            {!rows.length && <tr><td colSpan={7} className="py-10 text-center text-gray-500"><Users className="mx-auto mb-2" />No members match.</td></tr>}</tbody>
        </table></Card>
      </State>
      {adding && <AddMember onClose={() => setAdding(false)} onDone={(r) => { setAdding(false); q.reload(); nav(`/members/${r.id}`) }} />}
    </div>
  )
}
