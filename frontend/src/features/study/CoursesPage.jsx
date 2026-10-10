import React, { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useSeller, call, PageHead, Btn, State, Modal } from '../analytics/kit.jsx'
import { Card } from '../analytics/ui.jsx'
import { useOwnerNavigate } from '../../hooks/useOwnerPath.jsx'
import { inr, dt, AddCourse } from './shared.jsx'

function Enrolled({ course, onClose }) {
  const q = useSeller(`/api/seller/study/courses/${course.id}/enrollments`)
  const nav = useOwnerNavigate()
  return <Modal title={`${course.name} — enrolled`} onClose={onClose}><State q={q} empty={q.data && !q.data.length && 'Nobody is enrolled yet. Enrol a member by billing a Course Fee.'}><ul className="divide-y divide-gray-100">{(q.data || []).map((e) => <li key={e.id} className="flex items-center justify-between py-2 text-[14px]"><button type="button" onClick={() => nav(`/members/${e.memberId}`)} className="font-medium hover:text-orange-600">{e.name}</button><span className="text-[12.5px] text-gray-500">{e.memberCode} · {dt(e.enrolledAt)}</span></li>)}</ul></State></Modal>
}

export default function CoursesPage() {
  const q = useSeller('/api/seller/study/courses'); const nav = useOwnerNavigate()
  const [form, setForm] = useState(null); const [roll, setRoll] = useState(null); const [msg, setMsg] = useState('')
  const rows = q.data || []
  const del = async (c) => { if (!window.confirm(`Remove “${c.name}”? Courses with enrolled members are only deactivated.`)) return; try { const r = await call('delete', `/api/seller/study/courses/${c.id}`); setMsg(r.deactivated ? 'Course deactivated (members are enrolled).' : 'Course deleted.'); q.reload() } catch (e) { setMsg(e.message) } }
  return (
    <div>
      <PageHead title="Courses" sub="Course fees are collected through Billing → Add Course Fee."><Btn onClick={() => setForm({})}><Plus size={16} />Add Course</Btn></PageHead>
      {msg && <p className="mb-3 text-[13px] text-gray-600">{msg}</p>}
      <State q={q} empty={q.data && !rows.length && 'No courses yet. Add your first course.'}>
        <Card className="overflow-x-auto"><table className="w-full min-w-[820px] text-[14px]">
          <thead className="bg-gray-50 text-left text-[12.5px] font-semibold text-gray-700"><tr><th className="px-4 py-2.5">Course</th><th>Duration</th><th>Instructor</th><th>Fee</th><th>Enrolled</th><th>Status</th><th className="pr-4">Actions</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} className="border-t border-gray-100">
              <td className="px-4 py-2.5"><b className="block font-medium">{c.name}</b><small className="text-[12px] text-gray-500">{c.description}</small></td>
              <td>{c.duration || '—'}</td><td>{c.instructor || '—'}</td><td className="font-medium">{inr(c.fee)}</td>
              <td><button type="button" onClick={() => setRoll(c)} className="flex items-center gap-1 text-[#2F6FEB]"><Users size={14} />{c.enrolled}{c.capacity ? ` / ${c.capacity}` : ''}</button></td>
              <td><span className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${c.status === 'active' ? 'bg-[#E3F7EC] text-[#12A05C]' : 'bg-gray-100 text-gray-500'}`}>{c.status === 'active' ? 'Active' : 'Inactive'}</span></td>
              <td className="pr-4"><div className="flex gap-1.5"><button type="button" onClick={() => nav('/billing')} className="rounded-lg bg-[#E6F0FE] px-3 py-1.5 text-[12.5px] font-medium text-[#2F6FEB]">Bill</button><button type="button" onClick={() => setForm(c)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12.5px]">Edit</button><button type="button" onClick={() => del(c)} className="rounded-lg border border-[#F5C2C2] px-3 py-1.5 text-[12.5px] text-[#D92D20]">Remove</button></div></td>
            </tr>))}</tbody>
        </table></Card>
      </State>
      {form && <AddCourse init={form.id ? form : null} onClose={() => setForm(null)} onDone={() => { setForm(null); q.reload() }} />}
      {roll && <Enrolled course={roll} onClose={() => setRoll(null)} />}
    </div>
  )
}
