import React, { useMemo, useState } from 'react'
import { OwnerLink as Link } from '../../../hooks/useOwnerPath.jsx'
import { CalendarDays, Eye, Printer } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Card } from '../ui.jsx'
import { inr, dt } from '../udhar/parts.jsx'

// Type: Bill neutral · Payment blue · Udhar red · Adjustment green
const TYPE = { bill: ['Bill', 'bg-[#F1F3F7] text-gray-700'], payment: ['Payment', 'bg-[#E6F0FE] text-[#2F6FEB]'], udhar: ['Udhar', 'bg-[#FDE8E8] text-[#D92D20]'], adjustment: ['Adjustment', 'bg-[#E3F7EC] text-[#12A05C]'] }
// Status: Udhar red · Advance green · Paid neutral · Payment received blue
const STATUS = { Paid: 'bg-[#F1F3F7] text-gray-600', Udhar: 'bg-[#FDE8E8] text-[#D92D20]', Advance: 'bg-[#E3F7EC] text-[#12A05C]', Received: 'bg-[#E6F0FE] text-[#2F6FEB]', Adjusted: 'bg-[#FFF1DC] text-[#E58A00]' }
const PAY = { Cash: 'text-gray-700', UPI: 'text-gray-700', Card: 'text-gray-700', Udhar: 'text-[#D92D20]' }
const FILTERS = [['all', 'All'], ['bill', 'Bills'], ['payment', 'Payments'], ['udhar', 'Udhar'], ['advance', 'Advance']]
const isIn = (t, f) => f === 'all' || (f === 'bill' && t.kind === 'bill') || (f === 'payment' && t.kind === 'payment') || (f === 'udhar' && (t.kind === 'udhar' || (t.kind === 'bill' && t.status === 'Udhar'))) || (f === 'advance' && (t.kind === 'adjustment' || (t.kind === 'bill' && t.status === 'Advance')))
const amountCls = (t) => (t.kind === 'payment' ? 'text-[#2F6FEB]' : t.kind === 'udhar' || t.status === 'Udhar' ? 'text-[#D92D20]' : t.kind === 'adjustment' || t.status === 'Advance' ? 'text-[#12A05C]' : 'text-gray-900')
const Pill = ({ cls, children }) => <span className={`inline-block rounded-md px-2.5 py-0.5 text-[11.5px] font-medium ${cls}`}>{children}</span>
const Th = ({ children, r }) => <th className={`whitespace-nowrap px-3 py-2 text-[12px] font-medium text-gray-600 ${r ? 'text-right' : 'text-left'}`}>{children}</th>
// Balance is the customer's view: − owes (red) · + advance (green)
const Bal = ({ n }) => (n > 0.005 ? <span className="font-semibold text-[#12A05C]">+{inr(n)}</span> : n < -0.005 ? <span className="font-semibold text-[#D92D20]">−{inr(-n)}</span> : <span className="font-semibold text-gray-500">₹0</span>)

export default function TransactionTimeline({ txns, summary }) {
  const [filter, setFilter] = useState('all')
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, txns.filter((t) => isIn(t, k)).length])), [txns])
  const groups = useMemo(() => {
    const out = []
    txns.filter((t) => isIn(t, filter)).forEach((t) => { const k = new Date(t.date).toDateString(); const g = out.at(-1); if (g?.k === k) g.rows.push(t); else out.push({ k, date: t.date, rows: [t] }) })
    return out
  }, [txns, filter])

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden" >
        <div id="transactions" className="scroll-mt-4 border-b border-gray-100 px-4 py-2.5"><h3 className="text-[14.5px] font-semibold text-gray-900">Transaction History <span className="text-[12px] font-normal text-gray-400">({txns.length})</span></h3></div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2.5 p-3 lg:grid-cols-4">
          <Sum l="Total Transactions" v={summary.totalTransactions} />
          <Sum l="Total Udhar Given" v={inr(summary.totalUdharGiven)} tone="bg-[#FDECEC]" lc="text-[#D92D20]" vc="text-[#D92D20]" />
          <Sum l="Total Payment Received" v={inr(summary.totalPaymentReceived)} tone="bg-[#EAF2FE]" lc="text-[#2F6FEB]" vc="text-[#2F6FEB]" />
          <Sum l="Net Balance" v={summary.netBalance < -0.005 ? `−${inr(-summary.netBalance)}` : summary.netBalance > 0.005 ? `+${inr(summary.netBalance)}` : '₹0'} sub={summary.netBalance < -0.005 ? 'Customer owes you' : summary.netBalance > 0.005 ? 'Advance with you' : 'All settled'} tone={summary.netBalance < -0.005 ? 'bg-[#FDECEC]' : summary.netBalance > 0.005 ? 'bg-[#EAF8F0]' : 'bg-[#F7F8FB]'} lc="text-gray-600" vc={summary.netBalance < -0.005 ? 'text-[#D92D20]' : summary.netBalance > 0.005 ? 'text-[#12A05C]' : 'text-gray-700'} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${filter === k ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-orange-50'}`}>{l} ({counts[k]})</button>)}
        </div>

        <div className="max-h-[480px] overflow-auto border-t border-gray-100">
          <table className="w-full min-w-[800px] text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-[#FAFBFD]"><tr><Th>Date</Th><Th>Type</Th><Th>Bill ID</Th><Th r>Amount</Th><Th>Payment</Th><Th>Status</Th><Th r>Balance After</Th><Th r>Actions</Th></tr></thead>
            <tbody>
              {!groups.length && <tr><td colSpan={8} className="py-8 text-center text-[13px] text-gray-400">{txns.length ? 'No transactions in this filter' : 'No transactions yet'}</td></tr>}
              {groups.map((g) => (
                <React.Fragment key={g.k}>
                  <tr className="bg-[#FFF8F3]"><td colSpan={8} className="px-3 py-1.5 text-[12px] font-semibold text-orange-700"><span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />{dt(g.date)}<span className="font-normal text-gray-400">· {g.rows.length} {g.rows.length === 1 ? 'transaction' : 'transactions'}</span></span></td></tr>
                  {g.rows.map((t) => (
                    <tr key={t.key} className="h-10 border-b border-gray-50 transition hover:bg-[#FAFBFD]">
                      <td className="whitespace-nowrap px-3 text-gray-500">{new Date(t.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3"><Pill cls={TYPE[t.kind][1]}>{TYPE[t.kind][0]}</Pill></td>
                      <td className="px-3">{t.billId ? <Link to={`/bill/${t.billId}`} className="font-medium text-[#2F6FEB] hover:underline">{t.billCode}</Link> : <span className="text-gray-400">—</span>}{t.kind === 'bill' && t.items > 0 && <span className="ml-1.5 text-[11px] text-gray-400">{t.items} item{t.items > 1 ? 's' : ''}</span>}</td>
                      <td className={`px-3 text-right font-semibold ${amountCls(t)}`}>{inr(t.amount)}</td>
                      <td className={`px-3 ${PAY[t.payment] || 'text-gray-700'}`}>{t.payment}</td>
                      <td className="px-3"><Pill cls={STATUS[t.status] || STATUS.Paid}>{t.status}</Pill></td>
                      <td className="px-3 text-right"><Bal n={t.balanceAfter} /></td>
                      <td className="px-3 text-right">
                        {t.billId ? (
                          <span className="inline-flex gap-1.5">
                            <Link to={`/bill/${t.billId}`} title="View bill" className="grid h-7 w-7 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-white"><Eye size={13} /></Link>
                            <Link to={`/bill/${t.billId}?print=1`} title="Print bill" className="grid h-7 w-7 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-white"><Printer size={13} /></Link>
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>))}
                </React.Fragment>))}
            </tbody>
          </table>
        </div>
      </Card>

      <Charts txns={txns} />
    </div>
  )
}

const Sum = ({ l, v, sub, tone = 'bg-[#F7F8FB]', lc = 'text-gray-500', vc = 'text-gray-900' }) => <div className={`rounded-lg px-3 py-2 ${tone}`}><div className={`text-[11.5px] ${lc}`}>{l}</div><div className={`text-[18px] font-semibold leading-tight ${vc}`}>{v}</div>{sub && <div className="text-[11px] text-gray-500">{sub}</div>}</div>

// Bonus: balance over time + billed vs payments received per month
function Charts({ txns }) {
  const asc = useMemo(() => [...txns].reverse(), [txns])
  const balance = useMemo(() => asc.map((t) => ({ label: dt(t.date), balance: t.balanceAfter })), [asc])
  const monthly = useMemo(() => {
    const m = {}
    asc.forEach((t) => {
      const d = new Date(t.date), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const x = (m[k] ||= { k, label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), billed: 0, received: 0 })
      if (t.kind === 'bill') x.billed += t.amount
      if (t.kind === 'payment') x.received += t.amount
    })
    return Object.values(m).sort((a, b) => a.k.localeCompare(b.k))
  }, [asc])
  if (txns.length < 2) return null
  const tick = { fontSize: 11, fill: '#9CA3AF' }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-1 text-[14px] font-semibold text-gray-900">Balance vs Time</h3><p className="mb-2 text-[11.5px] text-gray-500">Below zero = customer owes · above zero = advance</p>
        <div className="h-[170px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={balance} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#EEF0F5" /><XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} minTickGap={24} /><YAxis tick={tick} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => inr(v)} />
            <Tooltip formatter={(v) => [v < 0 ? `−${inr(-v)} (owes)` : `+${inr(v)}`, 'Balance']} />
            <Line type="stepAfter" dataKey="balance" stroke="#FF7A2F" strokeWidth={2.2} dot={{ r: 2.5, fill: '#FF7A2F', strokeWidth: 0 }} activeDot={{ r: 5 }} animationDuration={700} />
          </LineChart></ResponsiveContainer></div>
      </Card>
      <Card className="p-4">
        <h3 className="mb-1 text-[14px] font-semibold text-gray-900">Payment Trend</h3><p className="mb-2 text-[11.5px] text-gray-500">Billed vs payments received, per month</p>
        <div className="h-[170px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#EEF0F5" /><XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} /><YAxis tick={tick} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => inr(v)} />
            <Tooltip formatter={(v) => inr(v)} cursor={{ fill: '#FFF3EC' }} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="billed" name="Billed" fill="#FF7A2F" radius={[3, 3, 0, 0]} maxBarSize={26} animationDuration={650} /><Bar dataKey="received" name="Payments received" fill="#2F6FEB" radius={[3, 3, 0, 0]} maxBarSize={26} animationDuration={650} />
          </BarChart></ResponsiveContainer></div>
      </Card>
    </div>
  )
}
