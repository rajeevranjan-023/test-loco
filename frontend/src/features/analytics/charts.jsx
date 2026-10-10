import React from 'react'
import { ResponsiveContainer, ComposedChart, AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts'
import { inr } from './ui.jsx'

export const C = { blue: '#2F86F6', orange: '#F97316', green: '#22B07D', red: '#EF4444', purple: '#8B5CF6', gray: '#C2CBDA', sky: '#EAF4FF' }
export const PALETTE = [C.blue, '#7EDDB8', '#FBBF24', '#F97362', '#8ED1BE', '#F4A3C0', C.gray]
const tick = { fontSize: 10, fill: '#475569' }
const money = (v) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)
const Tip = ({ money: m }) => <Tooltip formatter={(v) => (m ? inr(v) : v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
const Box = ({ h = 210, children }) => <div style={{ height: h }}><ResponsiveContainer>{children}</ResponsiveContainer></div>
const gap = (n) => (n <= 10 ? 0 : Math.ceil(n / 7) - 1)

export function Dot({ c, children }) { return <span className="flex items-center gap-1.5 text-[11px] text-gray-700"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{children}</span> }

// ring + legend (legend on the right, like the reference)
export function Donut({ items, total, label, colors = PALETTE, money: m = false, size = 150, vertical = false }) {
  const fmt = (v) => (m ? inr(v) : v)
  return (
    <div className={`flex items-center gap-4 ${vertical ? 'flex-col' : ''}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer>
          <PieChart><Pie data={items} dataKey="value" innerRadius="66%" outerRadius="100%" startAngle={90} endAngle={-270} paddingAngle={1} stroke="none">{items.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie></PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center leading-tight"><div><div className="text-[15px] font-semibold text-gray-900">{typeof total === 'number' ? fmt(total) : total}</div><div className="text-[10px] text-gray-500">{label}</div></div></div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {items.map((c, i) => <li key={c.name} className="flex items-center text-[11px] text-gray-700"><i className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} /><span className="flex-1 truncate">{c.name}</span><span className="ml-2 text-gray-900">{c.pct}%</span></li>)}
      </ul>
    </div>
  )
}

export function SalesOrders({ data }) {
  const none = !data.some((d) => d.sales)
  return (
    <div className="relative">
      {none && <div className="absolute inset-0 z-10 grid place-items-center text-xs text-gray-400">No sales in this period</div>}
      <Box h={220}>
        <ComposedChart data={data} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#EEF2F7" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={gap(data.length)} />
          <YAxis yAxisId="s" tick={tick} tickLine={false} axisLine={false} tickFormatter={money} width={44} />
          <YAxis yAxisId="o" hide domain={[0, (m) => m * 2]} />
          <Tip money />
          <Bar yAxisId="s" dataKey="sales" fill={C.blue} radius={[2, 2, 0, 0]} barSize={7} />
          <Line yAxisId="o" dataKey="orders" stroke={C.green} strokeWidth={1.8} type="monotone" dot={{ r: 2, fill: C.green }} />
        </ComposedChart>
      </Box>
    </div>
  )
}

export function RevenueProfit({ data }) {
  return (
    <Box h={200}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
        <defs>{[['r', C.blue], ['p', C.orange]].map(([id, c]) => <linearGradient key={id} id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity={0.35} /><stop offset="100%" stopColor={c} stopOpacity={0.03} /></linearGradient>)}</defs>
        <CartesianGrid vertical={false} stroke="#EEF2F7" />
        <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={gap(data.length)} />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={money} width={44} />
        <Tip money />
        <Area dataKey="revenue" stroke={C.blue} strokeWidth={1.6} fill="url(#gr)" />
        <Area dataKey="profit" stroke={C.orange} strokeWidth={1.6} fill="url(#gp)" />
      </AreaChart>
    </Box>
  )
}

export function StockVsSales({ data, mode }) {
  return (
    <Box h={210}>
      <ComposedChart data={data} margin={{ top: 6, right: 0, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EEF2F7" />
        <XAxis dataKey="name" tick={{ ...tick, fontSize: 9 }} tickLine={false} axisLine={false} interval={0} />
        <YAxis yAxisId="u" tick={tick} tickLine={false} axisLine={false} width={34} />
        <YAxis yAxisId="s" orientation="right" tick={tick} tickLine={false} axisLine={false} width={30} />
        <Tip />
        {mode !== 'Current Stock' && <Bar yAxisId="u" dataKey="units" name="Units Sold" fill={C.blue} radius={[2, 2, 0, 0]} barSize={9} />}
        {mode !== 'Units Sold' && <Line yAxisId="s" dataKey="stock" name="Current Stock" stroke={C.orange} strokeWidth={1.8} dot={{ r: 2.5, fill: C.orange }} />}
      </ComposedChart>
    </Box>
  )
}

export function HourlyArea({ data }) {
  return (
    <Box h={200}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
        <defs><linearGradient id="gh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.orange} stopOpacity={0.4} /><stop offset="100%" stopColor={C.orange} stopOpacity={0.04} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#EEF2F7" />
        <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={3} />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={money} width={44} />
        <Tip money />
        <Area dataKey="sales" stroke={C.orange} strokeWidth={1.8} fill="url(#gh)" dot={{ r: 2, fill: C.orange }} />
      </AreaChart>
    </Box>
  )
}

export function Heatmap({ heat }) {
  const max = Math.max(1, ...heat.rows.flatMap((r) => r.v))
  return (
    <div className="text-[10px] text-gray-600">
      <div className="mb-1 grid grid-cols-[34px_repeat(6,1fr)] gap-1"><span />{heat.cols.map((c, i) => <span key={i} className="text-center">{c}</span>)}</div>
      {heat.rows.map((r) => (
        <div key={r.day} className="mb-1 grid grid-cols-[34px_repeat(6,1fr)] gap-1">
          <span className="self-center">{r.day}</span>
          {r.v.map((v, i) => <i key={i} title={inr(v)} className="h-[19px] rounded-[3px] transition hover:ring-2 hover:ring-orange-300" style={{ background: `rgba(47,134,246,${0.1 + 0.9 * (v / max)})` }} />)}
        </div>))}
    </div>
  )
}

export function GroupBars({ data, a = 'new', b = 'returning', names = ['New Customers', 'Returning Customers'], h = 190 }) {
  return (
    <Box h={h}>
      <BarChart data={data} margin={{ top: 6, right: 0, left: -18, bottom: 0 }} barGap={3}>
        <CartesianGrid vertical={false} stroke="#EEF2F7" />
        <XAxis dataKey="label" tick={{ ...tick, fontSize: 9 }} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={tick} tickLine={false} axisLine={false} width={34} />
        <Tip />
        <Bar dataKey={a} name={names[0]} fill={C.blue} radius={[2, 2, 0, 0]} barSize={14} />
        <Bar dataKey={b} name={names[1]} fill={C.orange} radius={[2, 2, 0, 0]} barSize={14} />
      </BarChart>
    </Box>
  )
}

export function MarginBars({ data }) {
  return (
    <Box h={170}>
      <BarChart data={data} margin={{ top: 6, right: 0, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EEF2F7" />
        <XAxis dataKey="name" tick={{ ...tick, fontSize: 8 }} tickLine={false} axisLine={false} interval={0} tickFormatter={(n) => n.split(' ')[0]} />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={34} />
        <Tip />
        <Bar dataKey="margin" name="Margin %" radius={[3, 3, 0, 0]} barSize={14}>{data.map((_, i) => <Cell key={i} fill={[C.blue, C.purple, C.orange, '#FBBF24', C.green, '#F4A3C0'][i % 6]} />)}</Bar>
      </BarChart>
    </Box>
  )
}

export function TimeBars({ data, two }) {
  return (
    <Box h={210}>
      <BarChart data={data} margin={{ top: 6, right: 0, left: -6, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EEF2F7" />
        <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={gap(data.length)} />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={money} width={44} />
        <Tip money />
        <Bar dataKey="sales" name={two ? 'Revenue' : 'Sales'} fill={C.blue} radius={[2, 2, 0, 0]} barSize={two ? 11 : 8} />
        {two && <Bar dataKey="profit" name="Profit" fill={C.orange} radius={[2, 2, 0, 0]} barSize={11} />}
      </BarChart>
    </Box>
  )
}

export function Spark({ v, up = true }) {
  const max = Math.max(1, ...v), pts = v.map((n, i) => `${(i / (v.length - 1)) * 54},${16 - (n / max) * 14}`).join(' ')
  return <svg width="56" height="18" aria-hidden><polyline points={pts} fill="none" stroke={up ? C.green : C.red} strokeWidth="1.5" /></svg>
}
