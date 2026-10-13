import React, { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useSeller, PageHead, State } from './kit.jsx'
import { Card } from './ui.jsx'
import { useBusiness } from '../../context/BusinessContext.jsx'

const money = (v) => `₹${Math.round(v || 0).toLocaleString('en-IN')}`
const COLORS = { product: '#2563EB', material: '#0EA5E9', service: '#F97316', labour: '#16A34A', other: '#7C3AED' }
const TONE = { blue: 'text-[#2F6FEB]', green: 'text-[#12A05C]', red: 'text-[#D92D20]', orange: 'text-[#E58A00]', gray: 'text-gray-900' }
const axis = { tick: { fontSize: 11, fill: '#6B7280' }, axisLine: false, tickLine: false }
const shortDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function BillingAnalyticsPage() {
  const [days, setDays] = useState(30)
  const { business, t, cap } = useBusiness()
  const q = useSeller(`/api/seller/billing/summary?days=${days}`); const d = q.data
  const label = (k) => business.billing?.labels?.[k] || { product: 'Products / Parts', material: 'Materials', service: 'Services', labour: 'Labour', other: 'Other' }[k] || k
  const kinds = Object.keys(COLORS).filter((k) => (d?.revenue?.[k] || 0) > 0)
  const kpis = d && [
    { key: 'rev', label: 'Revenue (excl. tax)', v: money(d.totalRevenue), tone: 'blue' },
    { key: 'bills', label: 'Bills', v: d.bills.toLocaleString('en-IN'), tone: 'gray' },
    { key: 'paid', label: 'Collected', v: money(d.paid), tone: 'green' },
    { key: 'out', label: `Pending ${t.Dues || 'dues'}`, v: money(d.outstanding), tone: 'red' },
    { key: 'gp', label: 'Gross profit', v: money(d.grossProfit), tone: 'orange' },
    ...(cap('inventory') ? [{ key: 'cost', label: 'Parts & material cost', v: money(d.productCost + d.materialCost), tone: 'gray' }] : []),
  ]
  const daily = (d?.daily || []).map((r) => ({ ...r, label: shortDay(r.date) }))
  return (
    <div>
      <PageHead title="Analytics" sub="Computed from your real bills and dues — the same numbers as billing.">
        <select aria-label="Period" value={days} onChange={(e) => setDays(+e.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-[14px]">{[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </PageHead>
      <State q={q} empty={d && d.bills === 0 ? 'No bills in this period yet.' : ''}>{d && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{kpis.map((k) => <Card key={k.key} className="px-4 py-3.5"><div className="text-[12.5px] text-gray-500">{k.label}</div><div className={`mt-1 text-[22px] font-semibold ${TONE[k.tone]}`}>{k.v}</div></Card>)}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5"><h3 className="mb-2 text-[15px] font-semibold">Revenue by type</h3>
            <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={kinds.map((k) => ({ label: label(k), value: d.revenue[k], color: COLORS[k] }))} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>{kinds.map((k) => <Cell key={k} fill={COLORS[k]} />)}</Pie><Tooltip formatter={(v) => money(v)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer></Card>
          <Card className="p-5"><h3 className="mb-2 text-[15px] font-semibold">Collected vs pending, by day</h3>
            <ResponsiveContainer width="100%" height={240}><BarChart data={daily}><CartesianGrid vertical={false} stroke="#EEF0F5" /><XAxis dataKey="label" {...axis} minTickGap={16} /><YAxis {...axis} width={46} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} /><Tooltip formatter={(v) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="collected" name="Collected" stackId="a" fill="#16A34A" /><Bar dataKey="outstanding" name="Pending" stackId="a" fill="#EF4444" /></BarChart></ResponsiveContainer></Card>
          <Card className="p-5 lg:col-span-2"><h3 className="mb-2 text-[15px] font-semibold">Revenue by day</h3>
            <ResponsiveContainer width="100%" height={240}><BarChart data={daily}><CartesianGrid vertical={false} stroke="#EEF0F5" /><XAxis dataKey="label" {...axis} minTickGap={16} /><YAxis {...axis} width={46} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} /><Tooltip formatter={(v) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} />{kinds.map((k) => <Bar key={k} dataKey={k} name={label(k)} stackId="r" fill={COLORS[k]} />)}</BarChart></ResponsiveContainer></Card>
        </div>
        <Card className="mt-4 p-5"><h3 className="mb-3 text-[15px] font-semibold">Top billed items</h3>
          {d.topItems?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-[13.5px]"><thead className="text-gray-500"><tr><th className="py-1.5 font-medium">Item</th><th className="font-medium">Type</th><th className="text-right font-medium">Qty</th><th className="text-right font-medium">Billed</th></tr></thead><tbody>{d.topItems.map((i) => <tr key={`${i.type}-${i.name}`} className="border-t border-gray-100"><td className="py-2">{i.name}</td><td className="text-gray-500">{label(i.type)}</td><td className="text-right">{i.qty}</td><td className="text-right font-medium">{money(i.billed)}</td></tr>)}</tbody></table></div> : <p className="text-[13px] text-gray-400">No itemised lines in this period.</p>}
        </Card>
        <p className="mt-3 text-[12px] text-gray-400">Revenue is net of discount and excludes tax. Gross profit = revenue − parts/material cost. “Billed” on items is the line value before bill-level discount. Days are IST; the first day of a period may be partial.</p></>}</State>
    </div>
  )
}
