import React, { useMemo, useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { CalendarDays, Eye, SlidersHorizontal, Receipt } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { useSeller } from '../kit.jsx'
import { Card } from '../ui.jsx'
import { EntryDetail, inr, dt } from '../udhar/parts.jsx'

const FILTERS = [['all', 'All'], ['bills', 'Bills'], ['payments', 'Payments'], ['udhar', 'Udhar'], ['advance', 'Advance'], ['adjustments', 'Adjustments']]
const TYPE = { Bill: 'bg-[#EEF1F6] text-gray-700', Payment: 'bg-[#E6F0FE] text-[#2F6FEB]', Udhar: 'bg-[#FDE8E8] text-[#D92D20]', Adjustment: 'bg-[#FFF3D6] text-[#B77700]' }
const STATUS = {
  Paid: 'bg-[#F1F3F7] text-gray-600', Udhar: 'bg-[#FDE8E8] text-[#D92D20]', Advance: 'bg-[#E3F7EC] text-[#12A05C]', Received: 'bg-[#E6F0FE] text-[#2F6FEB]',
  'Advance Used': 'bg-[#E3F7EC] text-[#12A05C]', Adjusted: 'bg-[#FFF3D6] text-[#B77700]', Cancelled: 'bg-[#F1F3F7] text-gray-400 line-through',
}
const time = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const Pill = ({ cls, children }) => <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>

// ledger sign: + owes the shop (red) · − advance balance (green)
const Bal = ({ v }) => (v > 0.005 ? <span className="font-semibold text-[#D92D20]">{inr(v)} <span className="text-[10px] font-normal opacity-70">due</span></span> : v < -0.005 ? <span className="font-semibold text-[#12A05C]">{inr(-v)} <span className="text-[10px] font-normal opacity-70">advance</span></span> : <span className="font-medium text-gray-500">₹0</span>)

function Amount({ r }) {
  if (r.kind === 'bill') return <span className={`font-semibold ${r.status === 'Cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{inr(r.amount)}</span>
  if (r.kind === 'udhar') return <span className="font-semibold text-[#D92D20]">+{inr(r.amount)}</span>
  if (r.kind === 'payment') return <span className="font-semibold text-[#2F6FEB]">−{inr(r.amount)}</span>
  if (r.kind === 'advance') return <span className="font-semibold text-[#12A05C]">+{inr(r.amount)}</span>
  if (r.kind === 'advance_used') return <span className="font-semibold text-[#12A05C]">−{inr(r.amount)}</span>
  return r.amount > 0 ? <span className="font-semibold text-[#D92D20]">+{inr(r.amount)}</span> : <span className="font-semibold text-[#12A05C]">−{inr(-r.amount)}</span>
}
// what a bill did to the account, shown under the bill row (All view)
const Effects = ({ list = [] }) => <>{list.map((e, i) => (
  <span key={i} className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${e.kind === 'udhar' ? 'bg-[#FDE8E8] text-[#D92D20]' : e.kind === 'payment' ? 'bg-[#E6F0FE] text-[#2F6FEB]' : 'bg-[#E3F7EC] text-[#12A05C]'}`}>
    {{ udhar: 'Udhar +', payment: 'Paid −', advance: 'Advance +', advance_used: 'Advance used −' }[e.kind]}{inr(e.amount)}</span>))}</>

function Stat({ l, v, tone, sub }) {
  return <div className={`rounded-xl border border-[#EEF0F5] px-3 py-2 ${tone}`}><div className="text-[11.5px] text-gray-500">{l}</div><div className="text-[18px] font-semibold leading-tight text-gray-900">{v}</div>{sub && <div className="text-[11px] text-gray-400">{sub}</div>}</div>
}

export default function Timeline({ customerId, initial = 'all', version = 0, onAdjust }) {
  const nav = useOwnerNavigate()
  const [type, setType] = useState(initial); const [limit, setLimit] = useState(120); const [detail, setDetail] = useState(null)
  const q = useSeller(`/api/customers/${customerId}/transactions?type=${type}&limit=${limit}&v=${version}`)
  const d = q.data

  const groups = useMemo(() => {
    const m = new Map()
    ;(d?.rows || []).forEach((r) => { const k = dt(r.date); if (!m.has(k)) m.set(k, []); m.get(k).push(r) })
    return [...m.entries()]
  }, [d])
  const S = d?.summary
  const open = (r) => (r.kind === 'bill' ? nav(`/bill/${r.billRef}`) : r.billRef ? nav(`/bill/${r.billRef}`) : setDetail(r.entryId))

  return (
    <div id="transactions" className="scroll-mt-4 space-y-3">
      {/* summary */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {!S ? [0, 1, 2, 3].map((i) => <div key={i} className="h-[62px] animate-pulse rounded-xl bg-gray-100" />) : <>
          <Stat l="Total Transactions" v={S.transactions} tone="bg-white" sub="bills, payments, udhar, adjustments" />
          <Stat l="Total Udhar Given" v={inr(S.totalUdhar)} tone="bg-[#FFF3EE]" sub="all time" />
          <Stat l="Total Payment Received" v={inr(S.totalPayments)} tone="bg-[#EEF4FD]" sub="incl. advance deposits" />
          <Stat l="Net Balance" v={S.udharDue > 0 ? <span className="text-[#D92D20]">{inr(S.udharDue)} Udhar</span> : S.advance > 0 ? <span className="text-[#12A05C]">{inr(S.advance)} Advance</span> : <span className="text-gray-500">₹0 · Clear</span>} tone={S.udharDue > 0 ? 'bg-[#FDECEC]' : S.advance > 0 ? 'bg-[#EAF8F0]' : 'bg-white'} sub={S.udharDue > 0 ? 'customer owes you' : S.advance > 0 ? 'you hold for customer' : 'nothing pending'} />
        </>}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3.5 py-2.5">
          <h3 className="flex items-center gap-1.5 text-[14.5px] font-semibold text-gray-900"><Receipt size={15} className="text-orange-500" />Transaction History <span className="text-[12px] font-normal text-gray-400">· timeline with running balance</span></h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">{FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => { setType(k); setLimit(120) }} className={`h-7 shrink-0 rounded-full border px-3 text-[12px] font-medium transition ${type === k ? 'border-orange-500 bg-orange-500 text-white' : 'border-[#E3EAF3] bg-white text-gray-700 hover:border-orange-300'}`}>{l}{d ? ` (${d.counts[k]})` : ''}</button>)}</div>
            <button type="button" onClick={onAdjust} className="flex h-7 items-center gap-1 rounded-md border border-[#E3EAF3] px-2.5 text-[12px] text-gray-700 transition hover:border-orange-300"><SlidersHorizontal size={12} />Adjustment</button>
          </div>
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[860px] text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#F8FAFC]"><tr className="text-left text-[11.5px] font-semibold text-gray-600"><th className="px-3 py-2">Date</th><th className="px-2">Type</th><th className="px-2">Bill ID</th><th className="px-2 text-right">Amount</th><th className="px-2">Payment</th><th className="px-2">Status</th><th className="px-2 text-right">Balance After</th><th className="px-3 text-right">Actions</th></tr></thead>
            <tbody>
              {q.loading && !d && [0, 1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={8} className="p-1.5"><div className="h-8 animate-pulse rounded bg-gray-100" /></td></tr>)}
              {q.error && <tr><td colSpan={8} className="p-4 text-red-600">{q.error} <button type="button" className="underline" onClick={q.reload}>Retry</button></td></tr>}
              {d && !d.rows.length && <tr><td colSpan={8} className="py-10 text-center text-[13px] text-gray-400">No transactions {type === 'all' ? 'yet' : 'in this view'}</td></tr>}
              {groups.map(([day, rows]) => (
                <React.Fragment key={day}>
                  <tr className="bg-[#FFF8F1]"><td colSpan={8} className="px-3 py-1.5 text-[12px] font-semibold text-gray-800"><span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-orange-500" />{day}<span className="font-normal text-gray-400">· {rows.length} transaction{rows.length > 1 ? 's' : ''}</span></span></td></tr>
                  {rows.map((r) => (
                    <tr key={r.key} className={`h-[40px] border-b border-gray-50 transition hover:bg-[#FFFAF4] ${r.status === 'Cancelled' ? 'opacity-60' : ''}`}>
                      <td className="px-3 leading-tight text-gray-600"><span className="block">{shortDate(r.date)}</span><span className="block text-[10.5px] text-gray-400">{time(r.date)}</span></td>
                      <td className="px-2"><Pill cls={TYPE[r.type]}>{r.type}</Pill></td>
                      <td className="px-2 leading-tight">{r.billId ? <button type="button" onClick={() => nav(`/bill/${r.billRef}`)} className="font-semibold text-[#2F6FEB] hover:underline">{r.billId}</button> : <span className="text-gray-300">—</span>}{r.kind === 'bill' && <span className="block text-[10.5px] text-gray-400">{r.items} item{r.items === 1 ? '' : 's'}</span>}</td>
                      <td className="px-2 text-right"><Amount r={r} /></td>
                      <td className="px-2 text-gray-600">{r.payment}</td>
                      <td className="px-2"><Pill cls={STATUS[r.status] || STATUS.Paid}>{r.status}</Pill>{r.kind === 'bill' && type === 'all' && <Effects list={r.effects} />}{r.note && r.kind !== 'bill' && <span className="block max-w-[170px] truncate text-[10.5px] text-gray-400" title={r.note}>{r.note}</span>}</td>
                      <td className="px-2 text-right"><Bal v={r.balanceAfter} /></td>
                      <td className="px-3 text-right"><button type="button" onClick={() => open(r)} title={r.kind === 'bill' || r.billRef ? 'Open bill' : 'Details'} aria-label="View" className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E3EAF3] px-2.5 text-[11.5px] text-gray-700 transition hover:border-orange-300"><Eye size={12} />View</button></td>
                    </tr>))}
                </React.Fragment>))}
            </tbody>
          </table>
        </div>
        {d?.hasMore && <button type="button" onClick={() => setLimit((l) => l + 120)} className="block w-full border-t border-gray-100 py-2 text-[12px] font-medium text-[#2F6FEB] hover:bg-[#F8FAFC]">Load older transactions</button>}
      </Card>

      {/* bonus graphs */}
      {d && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-3.5">
            <h4 className="mb-1 text-[13px] font-semibold text-gray-900">Balance vs Time <span className="font-normal text-gray-400">· above 0 = owes · below = advance</span></h4>
            {d.charts.balance.length > 1 ? (
              <div className="h-[170px]"><ResponsiveContainer><AreaChart data={d.charts.balance} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                <defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F97316" stopOpacity={0.3} /><stop offset="100%" stopColor="#F97316" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#EEF2F7" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => `₹${v}`} />
                <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
                <Tooltip formatter={(v) => [v >= 0 ? `Owes ${inr(v)}` : `Advance ${inr(-v)}`, 'Balance']} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Area type="stepAfter" dataKey="balance" stroke="#F97316" strokeWidth={1.5} fill="url(#gb)" dot={false} activeDot={{ r: 3.5 }} />
              </AreaChart></ResponsiveContainer></div>) : <div className="grid h-[170px] place-items-center text-[12px] text-gray-400">Not enough ledger activity yet</div>}
          </Card>
          <Card className="p-3.5">
            <h4 className="mb-1 text-[13px] font-semibold text-gray-900">Payment Trend <span className="font-normal text-gray-400">· last 12 months</span></h4>
            <div className="mb-1 flex gap-3 text-[11px] text-gray-600"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#2F86F6]" />Billed</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#22B07D]" />Paid</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#EF4444]" />Udhar given</span></div>
            <div className="h-[150px]"><ResponsiveContainer><BarChart data={d.charts.monthly} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={1}>
              <CartesianGrid vertical={false} stroke="#EEF2F7" /><XAxis dataKey="label" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)} />
              <Tooltip formatter={(v, n) => [inr(v), n === 'billed' ? 'Billed' : n === 'paid' ? 'Paid' : 'Udhar given']} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Bar dataKey="billed" fill="#2F86F6" radius={[2, 2, 0, 0]} barSize={7} /><Bar dataKey="paid" fill="#22B07D" radius={[2, 2, 0, 0]} barSize={7} /><Bar dataKey="udhar" fill="#EF4444" radius={[2, 2, 0, 0]} barSize={7} />
            </BarChart></ResponsiveContainer></div>
          </Card>
        </div>)}
      {detail && <EntryDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
