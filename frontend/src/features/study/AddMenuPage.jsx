import React, { useState } from 'react'
import { PageHead } from '../analytics/kit.jsx'
import { Card } from '../analytics/ui.jsx'
import { useBusiness } from '../../context/BusinessContext.jsx'
import { iconOf } from '../../components/ownerIcons.js'
import { useOwnerNavigate } from '../../hooks/useOwnerPath.jsx'
import { AddMember, AddCourse, AddSeats, AddToList, useStudyConfig } from './shared.jsx'

// The Add tab of a business that has an add-menu in its schema. Only the options that business needs are listed.
const LIST_OF = { plan: 'plans', zone: 'zones', slot: 'timeSlots', material: 'materials', charge: 'chargeTypes' }
export default function AddMenuPage() {
  const { business } = useBusiness(); const nav = useOwnerNavigate()
  const [open, setOpen] = useState(null); const [done, setDone] = useState(''); const [config, reload] = useStudyConfig()
  const finish = (msg, then) => { setOpen(null); setDone(msg); reload(); if (then) then() }
  return (
    <div>
      <PageHead title="Add" sub="Create something new for your center." />
      {done && <p role="status" className="mb-3 rounded-lg bg-[#E3F7EC] px-3 py-2 text-[13px] font-medium text-[#0E7F4A]">{done}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(business.addMenu || []).map((o) => { const I = iconOf(o.icon); return (
        <button key={o.key} type="button" onClick={() => setOpen(o.action)} className="text-left"><Card className="h-full p-5 transition hover:border-orange-300 hover:shadow-md"><span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-500"><I size={20} /></span><b className="block text-[15px]">{o.label}</b><span className="text-[12.5px] text-gray-500">{o.hint}</span></Card></button>) })}</div>
      {open === 'member' && <AddMember onClose={() => setOpen(null)} onDone={(r) => finish(`Member ${r.memberCode} added.`, () => nav(`/members/${r.id}`))} />}
      {open === 'course' && <AddCourse onClose={() => setOpen(null)} onDone={() => finish('Course added.')} />}
      {open === 'seat' && config && <AddSeats config={config} onClose={() => setOpen(null)} onDone={(r) => finish(`${r.created} seat${r.created > 1 ? 's' : ''} created.`)} />}
      {LIST_OF[open] && <AddToList list={LIST_OF[open]} onClose={() => setOpen(null)} onDone={() => finish('Saved.')} />}
    </div>
  )
}
