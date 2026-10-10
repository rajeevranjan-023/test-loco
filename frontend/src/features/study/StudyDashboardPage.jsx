import React from 'react'
import { useSeller, PageHead, State } from '../analytics/kit.jsx'
import { Card } from '../analytics/ui.jsx'
import { useOwnerNavigate } from '../../hooks/useOwnerPath.jsx'
import { inr, dt, StatusPill, DueInline } from './shared.jsx'

const TONE = { blue: 'text-[#2F6FEB]', green: 'text-[#12A05C]', red: 'text-[#D92D20]', orange: 'text-[#E58A00]', gray: 'text-gray-900', purple: 'text-[#7C3AED]' }
export const fmtVal = (v, f) => (f === 'money' ? inr(v) : f === 'percent' ? `${v}%` : Number(v || 0).toLocaleString('en-IN'))

// Cards are DEFINED by the server (config.cards) and filled from real database numbers — nothing is hard-coded here.
export default function StudyDashboardPage() {
  const q = useSeller('/api/seller/study/dashboard'); const nav = useOwnerNavigate(); const d = q.data
  const List = ({ title, to, rows, empty, render }) => <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-[16px] font-semibold">{title}</h3>{to && <button type="button" onClick={() => nav(to)} className="text-[13px] font-medium text-[#2F6FEB]">View all</button>}</div>{rows.length ? <ul className="divide-y divide-gray-100">{rows.map(render)}</ul> : <p className="py-4 text-center text-[13px] text-gray-400">{empty}</p>}</Card>
  return (
    <div>
      <PageHead title="Dashboard" sub="A live picture of members, seats and money." />
      <State q={q}>{d && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{d.config.cards.map((c) => (
          <Card key={c.key} className="px-5 py-4"><div className="text-[13px] text-gray-500">{c.label}</div><div className={`mt-1 text-[26px] font-semibold leading-tight ${TONE[c.tone] || ''}`}>{fmtVal(d.cards[c.key], c.format)}</div>{c.sub && <div className="text-[12px] text-gray-500">{d.cards[c.sub]} member{d.cards[c.sub] === 1 ? '' : 's'}</div>}</Card>))}</div>
        <Card className="mt-4 p-5"><h3 className="mb-3 text-[16px] font-semibold">Seat occupancy overview</h3>
          <div className="flex h-5 overflow-hidden rounded-full bg-gray-100" role="img" aria-label="Seat occupancy">{[['occupied', '#22C55E'], ['partial', '#F59E0B'], ['empty', '#EF4444'], ['unavailable', '#9CA3AF']].map(([k, c]) => d.occupancy.total ? <div key={k} style={{ width: `${(d.occupancy[k] / d.occupancy.total) * 100}%`, background: c }} /> : null)}</div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-gray-700"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#22C55E]" />Occupied {d.occupancy.occupied} ({d.occupancy.occupiedPct}%)</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />Partial {d.occupancy.partial} ({d.occupancy.partialPct}%)</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />Empty {d.occupancy.empty} ({d.occupancy.emptyPct}%)</span></div></Card>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <List title="Upcoming membership expiries" to="/members" rows={d.upcomingExpiries} empty="Nothing expires in the next 14 days." render={(m) => <li key={m.id} onClick={() => nav(`/members/${m.id}`)} className="flex cursor-pointer items-center justify-between py-2 text-[13.5px] hover:bg-gray-50"><span><b className="font-medium">{m.name}</b><small className="block text-[12px] text-gray-500">{m.memberCode}{m.seats ? ` · Seat ${m.seats}` : ''}</small></span><span className="text-right text-[12.5px]">{dt(m.endDate)}<DueInline due={m.due} /></span></li>} />
          <List title="Recently joined members" to="/members" rows={d.recentMembers} empty="No members yet." render={(m) => <li key={m.id} onClick={() => nav(`/members/${m.id}`)} className="flex cursor-pointer items-center justify-between py-2 text-[13.5px] hover:bg-gray-50"><span><b className="font-medium">{m.name}</b><small className="block text-[12px] text-gray-500">{dt(m.joinedAt)}</small></span><StatusPill s={m.status} /></li>} />
          <List title="Recently released seats" to="/seats" rows={d.recentReleases} empty="No seats released recently." render={(r) => <li key={r.id} className="flex items-center justify-between py-2 text-[13.5px]"><span><b className="font-medium">Seat {r.seat}</b><small className="block text-[12px] text-gray-500">{r.member}</small></span><span className="text-[12.5px] text-gray-500">{dt(r.releasedAt)}</span></li>} />
        </div></>}</State>
    </div>
  )
}
