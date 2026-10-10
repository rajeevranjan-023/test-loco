import React, { useMemo, useRef, useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { Users, UserX, Wallet, Search, Upload, Download, Plus, Eye, BarChart3, ArrowUpDown, SlidersHorizontal, LineChart as LineIcon } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useSeller, call, Modal, Field, State } from '../kit.jsx'
import { Card } from '../ui.jsx'
import { Avatar, RowMenu, inr, dt } from '../udhar/parts.jsx'

// ---- look-up tables (colours match the Udhar / Billing pages) ----
const STATUS = { pending: ['Pending', 'bg-[#FFF1DC] text-[#E58A00]'], advance: ['Advance', 'bg-[#E6F0FE] text-[#2F6FEB]'], cleared: ['Cleared', 'bg-[#E3F7EC] text-[#12A05C]'] }
const BAL_PILL = { pending: 'bg-[#FDE8E8] text-[#D92D20]', advance: 'bg-[#E3F7EC] text-[#12A05C]', cleared: 'bg-[#F1F3F7] text-gray-600' }
const SORTS = { latest: 'Latest Order', spent: 'Highest Spent', orders: 'Most Orders', due: 'Highest Udhar', name: 'Name A–Z' }
const PERIODS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['custom', 'Custom']]
const METRICS = {
  spent: { label: 'Total Spent', color: '#FF7A2F', money: true },
  orders: { label: 'Orders Count', color: '#2F6FEB', money: false },
  udhar: { label: 'Udhar Amount', color: '#E5381D', money: true },
  advance: { label: 'Advance Balance', color: '#12A05C', money: true },
}
const modalBtn = 'h-10 rounded-xl px-4 text-[14px] font-medium transition disabled:opacity-50'

const Pill = ({ cls, children, w = '' }) => <span className={`inline-block rounded-md px-3 py-1 text-center text-[12px] font-medium ${cls} ${w}`}>{children}</span>
const StatusPill = ({ s }) => <Pill cls={STATUS[s]?.[1] || STATUS.cleared[1]} w="min-w-[72px]">{STATUS[s]?.[0] || 'Cleared'}</Pill>
const Th = ({ children, c }) => <th className={`px-3 py-2.5 text-[12.5px] font-medium text-gray-700 ${c ? 'text-center' : 'text-left'}`}>{children}</th>
// Owing shows as −₹X (red), Advance as ₹X (green)
const balText = (r) => (r.status === 'pending' ? `-${inr(r.udharBalance)}` : r.status === 'advance' ? inr(r.creditBalance) : '₹0')
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)

export default function CustomersPage() {
  const navigate = useOwnerNavigate()
  const q = useSeller('/api/customers')
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [sort, setSort] = useState('latest')
  const [adding, setAdding] = useState(false); const [toast, setToast] = useState('')
  const fileRef = useRef()

  const all = q.data || []
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }
  const go = (id, section) => navigate(`/customer/${id}${section ? `#${section}` : ''}`) // customer detail is its own page

  const counts = useMemo(() => ({ all: all.length, pending: all.filter((c) => c.status === 'pending').length, advance: all.filter((c) => c.status === 'advance').length, cleared: all.filter((c) => c.status === 'cleared').length }), [all])
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    const r = all.filter((c) => (filter === 'all' || c.status === filter) && (!s || c.name.toLowerCase().includes(s) || c.phone.includes(s)))
    const by = { latest: (a, b) => +new Date(b.lastOrder || 0) - +new Date(a.lastOrder || 0), spent: (a, b) => b.totalSpent - a.totalSpent, orders: (a, b) => b.totalOrders - a.totalOrders, due: (a, b) => b.udharBalance - a.udharBalance, name: (a, b) => a.name.localeCompare(b.name) }
    return [...r].sort(by[sort])
  }, [all, search, filter, sort])
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const newThisMonth = all.filter((c) => new Date(c.createdAt) >= monthStart).length
  const pct = (n) => (all.length ? Math.round((n / all.length) * 100) : 0)

  const exportCsv = () => {
    const lines = [['Name', 'Phone', 'Total Orders', 'Total Spent', 'Udhar Balance', 'Advance Balance', 'Status', 'Last Order'], ...rows.map((c) => [c.name, c.phone, c.totalOrders, c.totalSpent, c.udharBalance, c.creditBalance, STATUS[c.status][0], c.lastOrder ? new Date(c.lastOrder).toISOString().slice(0, 10) : ''])]
    const blob = new Blob([lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'customers.csv'; a.click(); URL.revokeObjectURL(a.href)
  }
  const importCsv = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const lines = (await f.text()).split(/\r?\n/).map((l) => l.split(',').map((v) => v.replace(/^"|"$/g, '').trim())).filter((l) => l[0] && !/^name$/i.test(l[0]))
    let ok = 0
    for (const [name, phone] of lines) { try { await call('post', '/api/seller/billing/customers', { name, phone: phone || '' }); ok++ } catch { /* skip invalid row */ } }
    say(`Imported ${ok} of ${lines.length} customers`); q.reload()
  }
  const reset = () => { setSearch(''); setFilter('all'); setSort('latest') }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-4 border-orange-500 pl-3"><h2 className="text-[22px] font-semibold leading-tight text-gray-900">Customers</h2><p className="text-[13.5px] text-gray-500">Manage your customers, view purchase history, udhar and credit balance</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-9 items-center gap-2 rounded-xl border border-[#BFD4F7] bg-white px-4 text-[13.5px] font-medium text-[#2F6FEB] transition hover:bg-[#F2F7FF]"><Download size={15} />Import</button>
          <button type="button" onClick={exportCsv} className="flex h-9 items-center gap-2 rounded-xl border border-[#BFD4F7] bg-white px-4 text-[13.5px] font-medium text-[#2F6FEB] transition hover:bg-[#F2F7FF]"><Upload size={15} />Export</button>
          <button type="button" onClick={() => setAdding(true)} className="flex h-9 items-center gap-2 rounded-xl bg-orange-500 px-4 text-[13.5px] font-semibold text-white transition hover:bg-orange-600"><Plus size={17} />Add Customer</button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi tone="bg-[#EAF2FE]" ic="bg-[#D7E6FD] text-[#2F6FEB]" Icon={Users} label="Total Customers" value={all.length} chip={`+${newThisMonth} this month`} chipCls="bg-[#D7E6FD] text-[#2F6FEB]" />
          <Kpi tone="bg-[#FFF3EC]" ic="bg-[#FFE0CC] text-orange-500" Icon={UserX} label="With Pending Udhar" value={counts.pending} chip={`${pct(counts.pending)}%`} chipCls="bg-[#FFDCCB] text-[#E5381D]" labelCls="text-orange-600" />
          <Kpi tone="bg-[#EAF8F0]" ic="bg-[#CDEFDC] text-[#12A05C]" Icon={Wallet} label="With Advance Balance" value={counts.advance} chip={`${pct(counts.advance)}%`} chipCls="bg-[#CDEFDC] text-[#12A05C]" labelCls="text-[#12A05C]" />
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2.5 p-3">
            <form onSubmit={(e) => e.preventDefault()} className="flex min-w-[240px] flex-1">
              <div className="relative flex-1"><Search size={15} className="absolute left-3 top-[11px] text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer by name or phone number..." className="h-9 w-full rounded-l-xl border border-gray-200 bg-white pl-9 pr-3 text-[13.5px] outline-none focus:border-orange-400" /></div>
              <button type="submit" className="flex h-9 items-center gap-2 rounded-r-xl bg-orange-500 px-4 text-[13.5px] font-medium text-white hover:bg-orange-600"><Search size={14} />Search</button>
            </form>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 text-[12.5px]">
              {[['all', 'All'], ['pending', 'Pending'], ['advance', 'Advance'], ['cleared', 'Cleared']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFilter(k)} className={`px-3 py-2 font-medium transition ${filter === k ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 hover:bg-orange-50'}`}>{l} ({counts[k]})</button>
              ))}
            </div>
            <label className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-[12.5px] font-medium text-gray-700"><ArrowUpDown size={14} />Sort: <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent outline-none">{Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <button type="button" onClick={reset} title="Reset filters" className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><SlidersHorizontal size={15} /></button>
          </div>
          <State q={q} empty={q.data && !rows.length && (search || filter !== 'all' ? 'No matching customers' : 'No customers yet')}>
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full min-w-[820px] text-[13.5px]">
                <thead className="bg-[#FAFBFD]"><tr><Th>#</Th><Th>Customer</Th><Th>Phone</Th><Th c>Total Orders</Th><Th>Total Spent</Th><Th c>Current Balance</Th><Th c>Status</Th><Th>Last Order</Th><Th c>Actions</Th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} onClick={() => go(r.id)} className="h-[52px] cursor-pointer border-b border-gray-100 transition last:border-0 hover:bg-[#FFF8F3]">
                      <td className="px-3 text-gray-600">{i + 1}</td>
                      <td className="px-3"><span className="flex items-center gap-2.5 font-medium text-gray-900"><Avatar name={r.name} size={30} i={i + 1} />{r.name}</span></td>
                      <td className="px-3 text-gray-700">{r.phone || '—'}</td>
                      <td className="px-3 text-center font-medium">{r.totalOrders}</td>
                      <td className="px-3 font-semibold">{inr(r.totalSpent)}</td>
                      <td className="px-3 text-center"><Pill cls={BAL_PILL[r.status]} w="min-w-[64px] font-semibold">{balText(r)}</Pill></td>
                      <td className="px-3 text-center"><StatusPill s={r.status} /></td>
                      <td className="px-3 text-gray-700">{dt(r.lastOrder)}</td>
                      <td className="px-3" onClick={(e) => e.stopPropagation()}>
                        <span className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => go(r.id)} title="View customer" className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-700 hover:bg-white"><Eye size={15} /></button>
                          <button type="button" onClick={() => go(r.id, 'transactions')} title="Transactions" className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-700 hover:bg-white"><BarChart3 size={15} /></button>
                          <RowMenu items={[['View details', () => go(r.id)], ['Transactions', () => go(r.id, 'transactions')], ['Udhar history', () => go(r.id, 'udhar')], ['Balance history', () => go(r.id, 'balance')]]} />
                        </span>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </State>
        </Card>

        <ActivityCard />
      </div>

      {adding && <AddCustomerModal onClose={() => setAdding(false)} onSaved={(c) => { setAdding(false); q.reload(); say(`${c.name} added`) }} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] text-white shadow-lg">{toast}</div>}
    </>
  )
}

function Kpi({ tone, ic, Icon, label, value, chip, chipCls, labelCls = 'text-gray-900' }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-white p-3 ${tone}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${ic}`}><Icon size={22} /></span>
      <div className="flex-1"><div className={`text-[13px] font-medium ${labelCls}`}>{label}</div><div className="flex items-center justify-between gap-2"><span className="text-[24px] font-semibold leading-tight text-gray-900">{value}</span><span className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${chipCls}`}>{chip}</span></div></div>
    </div>
  )
}

// ---- Customer Activity: time filter + data filter + bar / line ----
function ActivityCard() {
  const today = new Date()
  const [period, setPeriod] = useState('monthly')
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 29 * 864e5))); const [to, setTo] = useState(iso(today))
  const [metric, setMetric] = useState('spent')
  const [type, setType] = useState('bar')
  const path = `/api/customers/activity?period=${period}${period === 'custom' ? `&from=${from}&to=${to}` : ''}`
  const q = useSeller(path)
  const m = METRICS[metric]
  const data = q.data?.buckets || []
  const total = q.data?.totals?.[metric] ?? 0
  const fmt = (v) => (m.money ? inr(v) : Math.round(v))
  const chartProps = { data, margin: { top: 10, right: 12, left: 0, bottom: 0 } }
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="#EEF0F5" />
      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4B5563' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={52} allowDecimals={false} tickFormatter={fmt} />
      <Tooltip cursor={type === 'bar' ? { fill: '#FFF3EC' } : { stroke: '#FFD2B5' }} content={<Tip metric={metric} />} />
    </>
  )
  const seg = (on) => `px-3 py-1.5 text-[12px] font-medium transition ${on ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 hover:bg-orange-50'}`

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div><h3 className="text-[16px] font-semibold text-gray-900">Customer Activity</h3><p className="text-[12px] text-gray-500">{m.label}: <b className="text-gray-800">{fmt(total)}</b> in this range</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-gray-200">{PERIODS.map(([k, l]) => <button key={k} type="button" onClick={() => setPeriod(k)} className={seg(period === k)}>{l}</button>)}</div>
          {period === 'custom' && (
            <span className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-gray-200 px-2 text-[12px] text-gray-700 outline-none focus:border-orange-400" />to
              <input type="date" value={to} min={from} max={iso(today)} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-gray-200 px-2 text-[12px] text-gray-700 outline-none focus:border-orange-400" />
            </span>
          )}
          <div className="flex overflow-hidden rounded-lg border border-gray-200" role="group" aria-label="Chart type">
            <button type="button" onClick={() => setType('bar')} title="Bar chart" className={`grid h-8 w-8 place-items-center ${type === 'bar' ? 'bg-[#E6F0FE] text-[#2F6FEB]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><BarChart3 size={15} /></button>
            <button type="button" onClick={() => setType('line')} title="Line chart" className={`grid h-8 w-8 place-items-center border-l border-gray-200 ${type === 'line' ? 'bg-[#E6F0FE] text-[#2F6FEB]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><LineIcon size={15} /></button>
          </div>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {Object.entries(METRICS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setMetric(k)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition ${metric === k ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}><span className="h-2 w-2 rounded-full" style={{ background: v.color }} />{v.label}</button>
        ))}
      </div>
      <State q={q} rows={3}>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChart key={`bar-${metric}`} {...chartProps}>{axes}<Bar dataKey={metric} fill={m.color} radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive animationDuration={650} animationEasing="ease-out" /></BarChart>
            ) : (
              <LineChart key={`line-${metric}`} {...chartProps}>{axes}<Line type="monotone" dataKey={metric} stroke={m.color} strokeWidth={2.5} dot={{ r: 3, fill: m.color, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={750} animationEasing="ease-out" /></LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </State>
    </Card>
  )
}

function Tip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null
  const m = METRICS[metric], v = payload[0].value
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-[12px] shadow-lg">
      <div className="text-gray-500">{label}</div>
      <div className="font-semibold" style={{ color: m.color }}>{m.label}: {m.money ? inr(v) : v}</div>
    </div>
  )
}

function AddCustomerModal({ onClose, onSaved }) {
  const [f, setF] = useState({ name: '', phone: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const save = async () => { setBusy(true); setErr(''); try { onSaved(await call('post', '/api/seller/billing/customers', f)) } catch (e) { setErr(e.message); setBusy(false) } }
  return (
    <Modal title="Add Customer" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        <Field label="Mobile (10 digits, optional)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
        {err && <p className="text-[13px] text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className={`${modalBtn} border border-gray-200 text-gray-700 hover:bg-gray-50`}>Cancel</button><button type="button" onClick={save} disabled={busy || !f.name.trim()} className={`${modalBtn} bg-orange-500 text-white hover:bg-orange-600`}>Save</button></div>
      </div>
    </Modal>
  )
}
