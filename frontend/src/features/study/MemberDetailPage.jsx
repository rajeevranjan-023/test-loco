import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCcw, Pencil } from 'lucide-react'
import { useSeller, call, PageHead, Btn, State } from '../analytics/kit.jsx'
import { Card } from '../analytics/ui.jsx'
import { Avatar } from '../analytics/udhar/parts.jsx'
import { useOwnerNavigate } from '../../hooks/useOwnerPath.jsx'
import { inr, dt, dtm, StatusPill, DueInline, AddMember } from './shared.jsx'

const Sec = ({ title, children, right }) => <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-[16px] font-semibold">{title}</h3>{right}</div>{children}</Card>
const Tbl = ({ head, children, empty }) => <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-[13.5px]"><thead className="text-left text-[12px] font-semibold text-gray-500"><tr>{head.map((h) => <th key={h} className="py-1.5 pr-3">{h}</th>)}</tr></thead><tbody>{children}</tbody></table>{empty && <p className="py-4 text-center text-[13px] text-gray-400">{empty}</p>}</div>

export default function MemberDetailPage() {
  const { id } = useParams(); const nav = useOwnerNavigate()
  const q = useSeller(`/api/seller/study/members/${id}`)
  const [edit, setEdit] = useState(false); const [msg, setMsg] = useState('')
  const d = q.data, m = d?.member
  const release = async (a) => { if (!window.confirm(`Release seat ${a.name} (${a.slotLabel})? History is kept.`)) return; try { await call('post', `/api/seller/study/assignments/${a.assignmentId}/release`, {}); q.reload() } catch (e) { setMsg(e.message) } }
  return (
    <div>
      <button type="button" onClick={() => nav('/members')} className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-[#2F6FEB]"><ArrowLeft size={15} />Back to Members</button>
      <State q={q}>{m && <div className="grid gap-4">
        <Card className="p-5"><div className="flex flex-wrap items-center gap-4">
          <Avatar name={m.name} size={56} />
          <div className="min-w-0 flex-1 leading-tight"><h2 className="text-[22px] font-semibold">{m.name}</h2><p className="mt-1 text-[13.5px] text-gray-600">{m.memberCode} · {m.phone || 'no phone'}{m.email ? ` · ${m.email}` : ''}{m.className ? ` · ${m.className}` : ''}</p><p className="mt-1 text-[12.5px] text-gray-500">Joined {dt(m.joinedAt)}</p></div>
          <div className="flex flex-col items-end gap-2"><StatusPill s={m.status} /><div className="text-[13px]">Due <DueInline due={d.due} /></div></div>
        </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn onClick={() => nav(`/billing?member=${m.customerId}&renew=1`)}><RefreshCcw size={15} />{m.plan ? 'Renew Membership' : 'Add Membership'}</Btn>
            <Btn variant="ghost" onClick={() => nav(`/billing?member=${m.customerId}`)}>Create Bill</Btn>
            <Btn variant="ghost" onClick={() => setEdit(true)}><Pencil size={15} />Edit</Btn>
            {d.due && <Btn variant="ghost" onClick={() => nav('/dues')}>Open Pending Dues</Btn>}
          </div>
          {msg && <p className="mt-2 text-[13px] text-red-600">{msg}</p>}
          {m.notes && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-[13px] text-gray-700">{m.notes}</p>}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Sec title="Membership & Seat">
            <dl className="grid grid-cols-2 gap-y-2 text-[13.5px]"><dt className="text-gray-500">Plan</dt><dd>{m.plan || '—'}</dd><dt className="text-gray-500">Start date</dt><dd>{dt(m.startDate)}</dd><dt className="text-gray-500">Expiry date</dt><dd className={m.status === 'Membership Expired' ? 'font-medium text-[#D92D20]' : ''}>{dt(m.endDate)}</dd><dt className="text-gray-500">Renewals</dt><dd>{m.renewals}</dd></dl>
            <div className="mt-3 border-t border-gray-100 pt-3"><div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-500">Seat & time slot</div>
              {m.seats.length ? m.seats.map((a) => <div key={a.assignmentId} className="mb-1.5 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-[13.5px]"><span><b>{a.name}</b> · {a.slotLabel}</span><button type="button" onClick={() => release(a)} className="text-[12.5px] font-medium text-[#D92D20]">Release Seat</button></div>) : <p className="text-[13px] text-gray-500">No seat assigned.</p>}
              {m.status === 'Membership Expired' && m.seats.length > 0 && <p className="mt-2 text-[12px] text-gray-500">The membership has expired but the seat stays with this member until you release it.</p>}</div>
          </Sec>
          <Sec title="Courses">
            <Tbl head={['Course', 'Fee', 'Enrolled']} empty={!d.courses.length && 'Not enrolled in any course.'}>{d.courses.map((c) => <tr key={c.id} className="border-t border-gray-50"><td className="py-1.5">{c.course}</td><td>{inr(c.fee)}</td><td>{dt(c.enrolledAt)}</td></tr>)}</Tbl>
          </Sec>
        </div>

        <Sec title="Membership history"><Tbl head={['Plan', 'Period', 'Amount', 'Discount', 'Paid', 'Pending', 'Type', 'Bill']} empty={!d.memberships.length && 'No memberships yet.'}>{d.memberships.map((x) => <tr key={x.id} className="border-t border-gray-50"><td className="py-1.5 font-medium">{x.plan}</td><td>{dt(x.startDate)} → {dt(x.endDate)}{x.expired && <em className="ml-1 text-[11px] not-italic text-[#D92D20]">expired</em>}</td><td>{inr(x.amount)}</td><td>{x.discount ? inr(x.discount) : '—'}</td><td>{inr(x.paid)}</td><td className={x.pending ? 'text-[#D92D20]' : ''}>{x.pending ? inr(x.pending) : '—'}</td><td>{x.kind === 'renewal' ? 'Renewal' : 'New'}</td><td className="text-gray-500">{x.bill}</td></tr>)}</Tbl></Sec>
        <Sec title="Seat history"><Tbl head={['Seat', 'Slot', 'From', 'Until', 'Ended by']} empty={!d.seatHistory.length && 'No seat history.'}>{d.seatHistory.map((a) => <tr key={a.id} className="border-t border-gray-50"><td className="py-1.5 font-medium">{a.seat}</td><td>{a.slot}</td><td>{dt(a.startedAt)}</td><td>{a.releasedAt ? dt(a.releasedAt) : <span className="text-[#12A05C]">Current</span>}</td><td>{a.releasedBy ? ({ owner: 'Owner', member: 'Member', reassigned: 'Moved' }[a.releasedBy] || a.releasedBy) : '—'}</td></tr>)}</Tbl></Sec>
        <Sec title="Billing history"><Tbl head={['Bill', 'Date', 'Items', 'Amount', 'Paid', 'Due']} empty={!d.bills.length && 'No bills yet.'}>{d.bills.map((b) => <tr key={b.billId} onClick={() => nav(`/bill/${b.billId}`)} className="cursor-pointer border-t border-gray-50 hover:bg-gray-50"><td className="py-1.5 font-medium text-[#2F6FEB]">{b.id}</td><td>{dt(b.date)}</td><td className="max-w-[260px] truncate">{b.items}</td><td>{inr(b.amount)}</td><td>{inr(b.paid)}</td><td className={b.due ? 'font-medium text-[#D92D20]' : ''}>{b.due ? inr(b.due) : '—'}</td></tr>)}</Tbl></Sec>
        <Sec title="Payment history"><Tbl head={['Date', 'Entry', 'Amount', 'Method', 'Note', 'Balance after']} empty={!d.payments.length && 'No dues or payments recorded.'}>{d.payments.map((p) => <tr key={p.id} className="border-t border-gray-50"><td className="py-1.5">{dtm(p.date)}</td><td>{p.type === 'udhar' ? 'Due added' : p.type === 'payment' ? 'Payment received' : p.type === 'credit' ? 'Advance' : 'Adjustment'}</td><td className={p.delta > 0 ? 'text-[#D92D20]' : 'text-[#12A05C]'}>{p.delta > 0 ? '+' : '−'} {inr(p.amount)}</td><td className="capitalize">{p.method}</td><td className="text-gray-500">{p.note}</td><td>{inr(p.balanceAfter)}</td></tr>)}</Tbl></Sec>
      </div>}</State>
      {edit && m && <AddMember init={{ id: m.id, name: m.name, phone: m.phone, email: m.email, className: m.className, notes: m.notes }} onClose={() => setEdit(false)} onDone={() => { setEdit(false); q.reload() }} />}
    </div>
  )
}
