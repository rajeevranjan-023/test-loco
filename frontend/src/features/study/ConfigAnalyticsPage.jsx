import React, { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useSeller, PageHead, State } from '../analytics/kit.jsx'
import { Card } from '../analytics/ui.jsx'
import { fmtVal } from './StudyDashboardPage.jsx'

const TONE = { blue: 'text-[#2F6FEB]', green: 'text-[#12A05C]', red: 'text-[#D92D20]', orange: 'text-[#E58A00]', gray: 'text-gray-900', purple: 'text-[#7C3AED]' }
const PAL = ['#F97316', '#2563EB', '#16A34A', '#7C3AED', '#EF4444', '#0EA5E9']
const money = (v) => `₹${Math.round(v).toLocaleString('en-IN')}`

// A generic, CONFIG-driven analytics screen: the server sends which KPI cards and charts exist (config) plus the real data.
function Chart({ c, data }) {
  if (!data?.length || data.every((r) => c.series.every((s) => !r[s.key]))) return <p className="grid h-[220px] place-items-center text-[13px] text-gray-400">No data in this period.</p>
  const axis = { tick: { fontSize: 11, fill: '#6B7280' }, axisLine: false, tickLine: false }
  return (
    <ResponsiveContainer width="100%" height={240}>
      {c.type === 'donut' ? <PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>{data.map((r, i) => <Cell key={r.label} fill={r.color || PAL[i % PAL.length]} />)}</Pie><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart>
        : c.type === 'line' ? <LineChart data={data}><CartesianGrid vertical={false} stroke="#EEF0F5" /><XAxis dataKey={c.x} {...axis} /><YAxis {...axis} width={46} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} /><Tooltip formatter={(v, n) => [c.key === 'duesOverTime' ? money(v) : v, n]} /><Legend wrapperStyle={{ fontSize: 12 }} />{c.series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.2} dot={false} />)}</LineChart>
        : <BarChart data={data}><CartesianGrid vertical={false} stroke="#EEF0F5" /><XAxis dataKey={c.x} {...axis} /><YAxis {...axis} width={46} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} /><Tooltip formatter={(v, n) => [c.key === 'renewalsOverTime' ? v : money(v), n]} />{c.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}{c.series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={c.type === 'stacked-bar' ? 'a' : undefined} radius={c.type === 'stacked-bar' ? 0 : [4, 4, 0, 0]} />)}</BarChart>}
    </ResponsiveContainer>
  )
}

export default function ConfigAnalyticsPage() {
  const [days, setDays] = useState(30)
  const q = useSeller(`/api/seller/study/analytics?days=${days}`); const d = q.data
  return (
    <div>
      <PageHead title="Analytics" sub="Computed from your real bills, dues, members and seats.">
        <select aria-label="Period" value={days} onChange={(e) => setDays(+e.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-[14px]">{[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </PageHead>
      <State q={q}>{d && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{d.config.kpis.map((k) => <Card key={k.key} className="px-4 py-3.5"><div className="text-[12.5px] text-gray-500">{k.label}</div><div className={`mt-1 text-[22px] font-semibold ${TONE[k.tone] || ''}`}>{fmtVal(d.kpis[k.key], k.format)}</div></Card>)}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{d.config.charts.map((c) => <Card key={c.key} className="p-5"><h3 className="mb-2 text-[15px] font-semibold">{c.title}</h3><Chart c={c} data={d.charts[c.key]} /></Card>)}</div>
        <p className="mt-3 text-[12px] text-gray-400">{d.meta.utilizationNote} Collection = money received at billing plus payments recorded against dues.</p></>}</State>
    </div>
  )
}
