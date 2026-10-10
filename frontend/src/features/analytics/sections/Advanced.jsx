import React, { useMemo, useState } from 'react'
import { Download, Search, TrendingUp, TrendingDown, Check, FileDown } from 'lucide-react'
import { call } from '../kit.jsx'
import { Panel, Sel, MiniTabs, Gr, NoData, Tbl, Td, PName, StatusPill, inr } from './bits.jsx'
import { StockVsSales, TimeBars, GroupBars, Donut, Spark, Dot, C } from '../charts.jsx'
import { Thumb } from '../ui.jsx'

const Metric = ({ tone, label, p, value }) => (
  <div className={`flex items-center gap-3 rounded-xl border border-[#E8EEF6] p-3 transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white">{p ? <Thumb src={p.imageUrl} icon={p.icon} size={34} /> : null}</span>
    <div className="min-w-0 leading-tight"><div className="text-[10.5px] text-gray-500">{label}</div><div className="truncate text-[13.5px] font-semibold text-gray-900">{p?.name || '—'}</div><div className="text-[12px] text-gray-700">{value}</div></div>
  </div>
)
const Tick = () => <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[#12A05C] text-[#12A05C]"><Check size={10} strokeWidth={3} /></span>
const Mini = ({ tone, label, value, sub }) => (
  <div className={`rounded-xl border border-white/70 p-3.5 ${tone}`}><div className="text-[10.5px] text-gray-600">{label}</div><div className="my-0.5 text-[18px] font-semibold text-gray-900">{value}</div><div className="text-[10.5px] text-gray-600">{sub}</div></div>
)

export default function Advanced({ d, days, setDays, onToggled }) {
  const [cat, setCat] = useState('All Categories')
  const [q, setQ] = useState(''); const [search, setSearch] = useState(false)
  const [page, setPage] = useState(0); const [size, setSize] = useState(6)
  const [active, setActive] = useState({})
  const names = Object.keys(d.stockTimeline)
  const [prod, setProd] = useState(names[0] || '')
  const [tp, setTp] = useState('Daily'); const [beh, setBeh] = useState('Frequency')
  const [inv, setInv] = useState('Stock Level'); const [pl, setPl] = useState('Monthly')

  const cats = useMemo(() => ['All Categories', ...new Set(d.productTable.map((p) => p.category))], [d])
  const rows = d.productTable.filter((p) => (cat === 'All Categories' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.units - a.units)
  const pages = Math.max(1, Math.ceil(rows.length / size)), cur = Math.min(page, pages - 1), shown = rows.slice(cur * size, cur * size + size)
  const toggle = async (p) => {
    const next = !(active[p.id] ?? p.active); setActive((a) => ({ ...a, [p.id]: next }))
    try { await call('put', `/api/seller/products/${p.id}`, { active: next }) } catch { setActive((a) => ({ ...a, [p.id]: !next })) }
  }
  const pi = d.productInsights[prod]
  const insights = pi ? [`Sales ${pi.growth >= 0 ? 'increased' : 'dropped'} by ${Math.abs(pi.growth)}% this period`, pi.low ? `Current stock (${pi.stock}) is low — restock soon` : 'Current stock is sufficient', pi.best ? `Best performing product in ${pi.category} category` : `Not the top seller in ${pi.category} yet`, `Recommended: Keep stock above ${pi.recommend} units`] : []
  const tl = d.stockTimeline[prod] || []
  const ts = tp === 'Hourly' ? d.timeSeries.hourly : tp === 'Daily' ? d.timeSeries.daily : tp === 'Weekly' ? d.timeSeries.weekly : d.timeSeries.monthly
  const peak = ts.reduce((m, x) => (x.sales > (m?.sales || 0) ? x : m), null)
  const plData = pl === 'Daily' ? d.timeSeries.daily.map((x) => ({ label: x.label, sales: x.revenue, profit: x.profit })) : pl === 'Weekly' ? d.timeSeries.weekly : d.timeSeries.monthly
  const behData = { Frequency: d.behavior.frequency, 'Order Value': d.behavior.orderValue, 'Category Preference': d.behavior.categoryPreference, 'New vs Returning': d.behavior.newVsReturning }[beh]
  const invRows = { 'Stock Level': d.inventory.stock, 'Fast Moving': d.inventory.fast, 'Slow Moving': d.inventory.slow, 'Near Expiry': d.inventory.expiry }[inv]
  const f = d.forecast

  return (
    <div className="space-y-4">
      <Panel title="Best Performing Metrics">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric tone="bg-[#F5F9FF]" label="Most Sold Product" p={d.bestMetrics.mostSold} value={d.bestMetrics.mostSold?.value} />
          <Metric tone="bg-[#FFF8EC]" label="Most Profitable Product" p={d.bestMetrics.mostProfitable} value={d.bestMetrics.mostProfitable?.value} />
          <Metric tone="bg-[#FFF3F3]" label="Least Sold Product" p={d.bestMetrics.leastSold} value={d.bestMetrics.leastSold?.value} />
        </div>
      </Panel>

      <Panel id="sec-adv-products" title="Product Performance Analysis" right={<>
        <Sel value={cat} onChange={(v) => { setCat(v); setPage(0) }} options={cats} />
        <Sel value={days} onChange={(v) => setDays(+v)} options={[[7, 'Last 7 Days'], [30, 'Last 30 Days'], [90, 'Last 90 Days']]} />
        <button type="button" aria-label="Search" onClick={() => setSearch((s) => !s)} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-orange-300"><Search size={14} /></button>
      </>}>
        {search && <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search product…" className="mb-2 h-8 w-full max-w-[240px] rounded-lg border border-gray-200 px-3 text-[12px] outline-none focus:border-orange-400" />}
        {rows.length ? (
          <Tbl head={[['#'], ['Product'], ['Category'], ['Units Sold', 1], ['Revenue', 1], ['Profit', 1], ['Margin', 1], ['Trend'], ['Action']]}>
            {shown.map((p, i) => (
              <tr key={p.id}><Td>{cur * size + i + 1}</Td><Td><PName p={p} /></Td><Td className="text-gray-600">{p.category}</Td><Td r>{p.units}</Td><Td r>{inr(p.revenue)}</Td><Td r>{inr(p.profit)}</Td><Td r>{p.margin}%</Td>
                <Td><Spark v={p.trend} up={p.growth >= 0} /></Td>
                <Td><span className="flex items-center gap-2 whitespace-nowrap text-[11px] text-gray-500">
                  <button type="button" role="switch" aria-checked={active[p.id] ?? p.active} onClick={() => toggle(p)} className={`relative h-5 w-9 rounded-full transition ${(active[p.id] ?? p.active) ? 'bg-[#2F86F6]' : 'bg-gray-300'}`}><i className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${(active[p.id] ?? p.active) ? 'left-[18px]' : 'left-0.5'}`} /></button>{p.channels}</span></Td></tr>))}
          </Tbl>) : <NoData t="No matching products" />}
        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-1">
            <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-40">‹</button>
            {Array.from({ length: pages }, (_, i) => <button key={i} type="button" onClick={() => setPage(i)} className={`h-6 min-w-6 rounded-md px-1.5 ${i === cur ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}>{i + 1}</button>)}
            <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-40">›</button>
          </div>
          <span className="flex items-center gap-2">Show <Sel value={size} onChange={(v) => { setSize(+v); setPage(0) }} options={[6, 10, 24]} /></span>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Panel title="Product Sales vs Stock Analysis" right={<Sel value={prod} onChange={setProd} options={names} />}>
          <div className="mb-1 flex gap-4"><Dot c={C.blue}>Units Sold</Dot><Dot c={C.orange}>Current Stock</Dot></div>
          <StockVsSales data={tl} mode="Both" />
        </Panel>
        <Panel title="Insights"><ul className="space-y-3 pt-1">{insights.map((t) => <li key={t} className="flex items-start gap-2.5 text-[12px] text-gray-700"><Tick />{t}</li>)}</ul></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Sales by Time Period" right={<MiniTabs items={['Hourly', 'Daily', 'Weekly', 'Monthly']} value={tp} onChange={setTp} />}>
          <div className="relative">{peak && <div className="absolute right-2 top-0 z-10 rounded-md bg-[#FFF3E6] px-2 py-1 text-center text-[10px] leading-tight text-orange-700">Peak Sales {tp === 'Hourly' ? 'Hour' : 'Period'}<br /><b>{peak.label}</b><br />{inr(peak.sales)}</div>}<TimeBars data={ts} /></div>
        </Panel>
        <Panel title="Category Performance">
          {d.categories.length ? <Tbl head={[['Category'], ['Sales', 1], ['Profit', 1], ['Margin', 1]]}>{d.categories.map((c) => <tr key={c.name}><Td>{c.name}</Td><Td r>{inr(c.sales)}</Td><Td r>{inr(c.profit)}</Td><Td r>{c.margin}%</Td></tr>)}</Tbl> : <NoData />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Panel id="sec-customers-adv" title="Customer Purchase Behavior" right={<MiniTabs items={['Frequency', 'Order Value', 'Category Preference', 'New vs Returning']} value={beh} onChange={setBeh} />}>
          <div className="mb-1 flex gap-4"><Dot c={C.blue}>New Customers</Dot><Dot c={C.orange}>Returning Customers</Dot></div>
          {behData.length ? <GroupBars data={behData} /> : <NoData />}
        </Panel>
        <Panel title="Customer Insights"><ul className="space-y-3 pt-1">{d.customerInsights.map((t) => <li key={t} className="flex items-start gap-2.5 text-[12px] text-gray-700"><Tick />{t}</li>)}</ul></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Panel id="sec-inventory" title="Inventory Analysis" right={<MiniTabs items={['Stock Level', 'Fast Moving', 'Slow Moving', 'Near Expiry']} value={inv} onChange={setInv} />}>
          {invRows.length ? (
            <Tbl head={[['#'], ['Product'], ['Current Stock', 1], ['Avg. Daily Sale', 1], ['Days Left', 1], ['Action']]}>
              {invRows.map((p, i) => <tr key={p.id}><Td>{i + 1}</Td><Td><PName p={p} /></Td><Td r>{p.stock}</Td><Td r>{p.avgDaily}</Td><Td r>{inv === 'Near Expiry' ? `${p.expiryIn} d` : p.daysLeft ?? '—'}</Td><Td><StatusPill s={p.status} /></Td></tr>)}
            </Tbl>) : <NoData t="Nothing here — all clear 👍" />}
        </Panel>
        <Panel title="Stock Status"><Donut items={d.stockStatus.items} total={d.stockStatus.total} label="Total Products" colors={[C.blue, C.orange, C.red, C.gray]} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Panel id="sec-pl" title="Profit & Loss Summary" right={<MiniTabs items={['Daily', 'Weekly', 'Monthly']} value={pl} onChange={setPl} />}>
          <div className="mb-1 flex gap-4"><Dot c={C.blue}>Revenue</Dot><Dot c={C.orange}>Profit</Dot></div>
          <TimeBars data={plData} two />
        </Panel>
        <Panel title="Profit Breakdown"><Donut items={d.profitBreakdown.items} total={d.profitBreakdown.total} label="Total Profit" money colors={[C.blue, C.orange, C.purple, '#FBBF24']} /></Panel>
      </div>

      <Panel id="sec-trends" title="Forecast & Suggestions">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Mini tone="bg-[#EAF8F1]" label="Expected Sales (Next 30 Days)" value={inr(f.expectedSales)} sub={<span className="inline-flex items-center gap-1">{f.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}<Gr v={f.growth} /></span>} />
          <Mini tone="bg-[#FFF6DF]" label="Recommended Stock Increase" value={f.restock.join(', ') || '—'} sub="Based on demand prediction" />
          <Mini tone="bg-[#EAF3FF]" label="Potential Profit Boost" value={inr(f.profitBoost)} sub="If stock optimized" />
          <Mini tone="bg-[#FDECEC]" label="Slow Moving Products" value={`${f.slowMoving} items`} sub="Consider discount or bundle offer" />
        </div>
      </Panel>
    </div>
  )
}
export { Download, FileDown }
