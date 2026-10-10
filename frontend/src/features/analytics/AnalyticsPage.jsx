import React, { useEffect, useState } from 'react'
import { BarChart3, FileSpreadsheet, Printer } from 'lucide-react'
import { api } from '../../services/api.js'
import { Pulse } from './ui.jsx'
import { Panel, Sel } from './sections/bits.jsx'
import Overview from './sections/Overview.jsx'
import Advanced from './sections/Advanced.jsx'

const TABS1 = [['Overview', 'sec-top'], ['Sales', 'sec-sales'], ['Products', 'sec-products'], ['Customers', 'sec-customers'], ['Inventory', 'sec-inventory'], ['Profit & Loss', 'sec-pl'], ['Trends', 'sec-trends'], ['Reports', 'sec-reports']]
const TABS2 = [['Product Analysis', 'sec-adv-products'], ['Customer Insights', 'sec-customers-adv'], ['Inventory Insights', 'sec-inventory'], ['Profit & Loss', 'sec-pl'], ['Trends & Forecast', 'sec-trends'], ['Reports', 'sec-reports']]
const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function TabRow({ tabs, active, onPick }) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {tabs.map(([l, id]) => (
        <button key={l} type="button" onClick={() => { onPick(l); jump(id) }}
          className={`shrink-0 rounded-lg border px-3.5 py-1.5 text-[11.5px] font-medium transition ${active === l ? 'border-orange-500 bg-orange-500 text-white shadow-sm' : 'border-[#E3EAF3] bg-white text-gray-600 hover:border-orange-300 hover:text-orange-600'}`}>{l}</button>
      ))}
    </div>
  )
}
const Head = ({ title, sub, children }) => (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-orange-500"><BarChart3 size={26} /></span><div><h1 className="text-[18px] font-semibold text-gray-900">{title}</h1><p className="text-[12px] text-gray-500">{sub}</p></div></div>
    {children}
  </div>
)

// ---- CSV export (client-side, from the data already loaded) ----
const csv = (name, rows) => {
  if (!rows.length) return
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object')
  const body = [keys.join(','), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([body], { type: 'text/csv' })), download: `${name}-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click(); URL.revokeObjectURL(a.href)
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const [channel, setChannel] = useState('both')
  const [tick, setTick] = useState(0)
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [t1, setT1] = useState('Overview'); const [t2, setT2] = useState('Product Analysis')

  useEffect(() => {
    let live = true
    setLoading(true); setErr('')
    api.get(`/api/seller/insights?days=${days}&channel=${channel}`, { requiresAuth: true })
      .then((r) => live && setD(r)).catch((e) => live && setErr(e?.message || 'Could not load analytics')).finally(() => live && setLoading(false))
    return () => { live = false }
  }, [days, channel, tick])

  const filters = (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-gray-600">
      <span className="font-medium text-gray-800">Online / Offline Filter:</span>
      <Sel value={channel} onChange={setChannel} options={[['both', 'Both (All Orders)'], ['online', 'Online'], ['offline', 'Offline']]} />
      <Sel value={days} onChange={(v) => setDays(+v)} options={[[7, 'Last 7 Days'], [30, 'Last 30 Days'], [90, 'Last 90 Days']]} />
    </div>
  )

  return (
    <div id="sec-top" className="scroll-mt-24">
      <Head title="Analytics Dashboard" sub="Complete insights about your shop performance">{filters}</Head>
      <TabRow tabs={TABS1} active={t1} onPick={setT1} />
      {err && <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 p-3 text-[13px] text-red-600"><span className="flex-1">{err}</span><button type="button" onClick={() => setTick((t) => t + 1)} className="font-medium underline">Retry</button></div>}
      {!d && !err ? (
        <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Pulse key={i} className="h-[92px]" />)}</div><Pulse className="h-[300px]" /><Pulse className="h-[260px]" /></div>
      ) : d && (
        <div className={`space-y-8 transition-opacity duration-300 ${loading ? 'opacity-60' : 'opacity-100'}`}>
          <Overview d={d} days={days} />

          <div>
            <Head title="Advanced Analytics" sub="Deeper insights to grow your business" />
            <TabRow tabs={TABS2} active={t2} onPick={setT2} />
            <Advanced d={d} days={days} setDays={setDays} />
          </div>

          <Panel id="sec-reports" title="Reports" right={<button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11.5px] text-gray-700 transition hover:border-orange-300"><Printer size={13} />Print / Save PDF</button>}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[['Sales report', 'sales-daily', d.series], ['Product report', 'products', d.productTable], ['Top customers', 'customers', d.topCustomers], ['Inventory report', 'inventory', d.productTable.map(({ name, category, stock, avgDaily, daysLeft, status }) => ({ name, category, stock, avgDaily, daysLeft, status }))]].map(([l, n, rows]) => (
                <button key={l} type="button" onClick={() => csv(n, rows)} className="flex items-center gap-3 rounded-xl border border-[#E3EAF3] bg-[#F8FBFF] p-3 text-left transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-50 text-orange-500"><FileSpreadsheet size={18} /></span>
                  <span className="leading-tight"><span className="block text-[12.5px] font-medium text-gray-900">{l}</span><span className="text-[10.5px] text-gray-500">Download CSV</span></span>
                </button>))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
