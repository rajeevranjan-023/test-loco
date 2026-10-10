import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Wallet, Users, Clock, Hourglass, CheckCircle2, Gift, Plus, Eye, Pin, BadgeIndianRupee, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { useSeller, call } from '../kit.jsx'
import RangePicker from '../udhar/RangePicker.jsx'
import { Kpi, Trend, Toolbar, RowMenu, PinnedCard, HistoryDrawer, EntryDetail, EntryModal, Avatar, DaysBadge, StatusBadge, inr, dt } from '../udhar/parts.jsx'
import { useBusiness } from '../../../context/BusinessContext.jsx'

const hit = (r, q) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()) || (r.phone || '').includes(q.trim())
const Th = ({ children, c }) => <th className={`px-2 py-1.5 text-[11px] font-semibold text-gray-700 ${c ? 'text-center' : 'text-left'}`}>{children}</th>
const btn = 'flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition'

export default function UdharPage() {
  const { tx } = useBusiness()
  const { urange, setUrange, reloadSummary } = useOutletContext()
  const [bucket, setBucket] = useState('month')
  const [graph, setGraph] = useState(false) // trends hidden by default; the 5th card toggles it
  const q = useSeller(`/api/seller/udhar/overview?from=${urange.from}&to=${urange.to}&bucket=${bucket}`)
  const d = q.data

  const [drawer, setDrawer] = useState(null); const [ver, setVer] = useState(0)
  const [entry, setEntry] = useState(null); const [detail, setDetail] = useState(null)
  const [toast, setToast] = useState('')
  const [pq, setPq] = useState(''); const [psort, setPsort] = useState('recent'); const [pfilter, setPfilter] = useState('all'); const [pall, setPall] = useState(false)
  const [aq, setAq] = useState(''); const [asort, setAsort] = useState('updated'); const [aall, setAall] = useState(false)
  const [cq, setCq] = useState(''); const [csort, setCsort] = useState('cleared'); const [cfilter, setCfilter] = useState('all'); const [call_, setCall] = useState(false)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }, [toast])

  const pending = useMemo(() => {
    const a = (d?.pending || []).filter((r) => hit(r, pq) && (pfilter === 'all' || (pfilter === 'overdue' && r.days > 7) || (pfilter === 'pinned' && r.pinned)))
    return a.sort({ recent: (x, y) => +new Date(y.lastAdded || 0) - +new Date(x.lastAdded || 0), amount: (x, y) => y.total - x.total, customer: (x, y) => x.name.localeCompare(y.name) }[psort])
  }, [d, pq, psort, pfilter])
  const cleared = useMemo(() => {
    const a = (d?.cleared || []).filter((r) => hit(r, cq) && (cfilter === 'all' || (r.lastCleared && Date.now() - +new Date(r.lastCleared) < 30 * 864e5)))
    return a.sort(csort === 'cleared' ? (x, y) => +new Date(y.lastCleared || 0) - +new Date(x.lastCleared || 0) : (x, y) => x.name.localeCompare(y.name))
  }, [d, cq, csort, cfilter])

  const advance = useMemo(() => {
    const a = (d?.advance || []).filter((r) => hit(r, aq))
    return a.sort({ updated: (x, y) => +new Date(y.lastUpdated || 0) - +new Date(x.lastUpdated || 0), amount: (x, y) => y.advance - x.advance, customer: (x, y) => x.name.localeCompare(y.name) }[asort])
  }, [d, aq, asort])

  const refresh = () => { q.reload(); setVer((v) => v + 1); reloadSummary?.() }
  const pin = async (r, pinned) => { try { await call('patch', `/api/seller/udhar/customers/${r.id}/pin`, { pinned }); refresh() } catch (e) { setToast(e.message) } }
  const remind = (r) => { if (!r.phone) return setToast('No phone number saved for this customer'); window.open(`https://wa.me/91${r.phone}?text=${encodeURIComponent(`Namaste ${r.name}, aapka ${inr(r.total)} udhar baaki hai. Kripya jaldi clear karein. Dhanyavaad!`)}`, '_blank') }
  const openEntry = (customer, type) => setEntry({ customer, type })
  const saved = (res) => { setEntry(null); refresh(); const t = res.entries.map((e) => e.type); setToast(t.includes('credit') ? `Saved · ${inr(res.entries.filter((e) => e.type === 'credit').reduce((s, e) => s + e.amount, 0))} added to Advance Balance` : t[0] === 'payment' ? tx('Payment recorded') : tx('Udhar added')) }
  const menu = (r, pend) => [['View history', () => setDrawer(r)], ['Add / Receive', () => openEntry(r, pend ? 'payment' : 'udhar')], ['Add Advance', () => openEntry(r, 'credit')], ...(pend ? [[r.pinned ? 'Unpin' : 'Pin to top', () => pin(r, !r.pinned)], ['Send reminder (WhatsApp)', () => remind(r)]] : [])]
  const k = d?.kpis
  const seg = (on) => `rounded px-2 py-0.5 text-[11px] font-medium transition ${on ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`
  const pRows = pall ? pending : pending.slice(0, 8), aRows = aall ? advance : advance.slice(0, 4), cRows = call_ ? cleared : cleared.slice(0, 4)

  return (
    <div className="space-y-2.5 text-[12px]">
      {toast && <div role="status" className="fixed right-4 top-16 z-50 rounded-md bg-gray-900 px-3 py-1.5 text-[12px] text-white shadow-lg">{toast}</div>}
      {q.error && <div className="flex items-center gap-3 rounded-lg bg-red-50 p-2 text-[12px] text-red-600"><span className="flex-1">{q.error}</span><button type="button" onClick={q.reload} className="font-medium underline">Retry</button></div>}

      {/* one row: 4 KPI cards + graph toggle */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {!d ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[52px] animate-pulse rounded-lg bg-gray-100" />) : <>
          <Kpi tone="orange" icon={Wallet} label={tx('Total Pending Udhar')} value={inr(k.pending.amount)} sub={`${k.pending.customers} customers`} valueClass="text-[#E8590C]" />
          <Kpi tone="green" icon={BadgeIndianRupee} label="Total Recovered" value={inr(k.recovered.amount)} sub="this period" valueClass="text-[#16A870]" />
          <Kpi tone="blue" icon={Users} label={tx('Total Customers')} value={k.totalCustomers} sub={tx('with udhar a/c')} valueClass="text-[#0F2A52]" />
          <Kpi tone="red" icon={Clock} label="Overdue Amount" value={inr(k.overdue.amount)} sub={`${k.overdue.customers} customers · 7d+`} valueClass="text-[#D92D20]" />
          <button type="button" onClick={() => setGraph((g) => !g)} aria-expanded={graph} className={`flex h-[52px] items-center gap-2.5 rounded-lg border px-2.5 text-left transition ${graph ? 'border-orange-400 bg-orange-50' : 'border-[#E3EAF3] bg-white hover:border-orange-300'}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${graph ? 'bg-orange-500 text-white' : 'bg-[#FFF3EA] text-orange-500'}`}><TrendingUp size={16} /></span>
            <span className="min-w-0 flex-1 leading-none"><span className="block text-[11px] text-gray-600">Graph</span><span className="mt-1 block text-[13px] font-semibold text-gray-900">View Trends</span></span>
            {graph ? <ChevronUp size={15} className="text-orange-500" /> : <ChevronDown size={15} className="text-gray-400" />}
          </button>
        </>}
      </div>

      {graph && (
        <section className="rounded-lg border border-[#E8EEF6] bg-white px-3 pb-1 pt-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[12.5px] font-semibold text-gray-900">{tx('Udhar vs Recovery Trend')}</h3>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1 text-[11px] text-gray-700"><i className="h-2 w-2 rounded-full bg-red-500" />{tx('Udhar Given')}</span>
              <span className="flex items-center gap-1 text-[11px] text-gray-700"><i className="h-2 w-2 rounded-full bg-green-600" />Recovered</span>
              <span className="flex rounded-md border border-[#E3EAF3] p-0.5"><button type="button" onClick={() => setBucket('day')} className={seg(bucket === 'day')}>Daily</button><button type="button" onClick={() => setBucket('month')} className={seg(bucket === 'month')}>Monthly</button></span>
              <RangePicker compact value={urange} onChange={setUrange} />
            </div>
          </div>
          {!d ? <div className="h-[160px] animate-pulse rounded bg-gray-100" /> : <Trend data={d.trend} h={160} />}
        </section>
      )}

      {/* Pending */}
      <section className="rounded-lg border border-[#FBE3D3] bg-[#FFF8F2] p-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-900"><Hourglass size={16} className="text-[#E5381D]" />{tx('Pending Udhar (')}{d?.pending.length ?? '…'})</h2>
          <div className="flex flex-wrap items-center gap-2"><Toolbar q={pq} setQ={setPq} sort={psort} setSort={setPsort} sorts={[['recent', 'Recent Added'], ['amount', 'Amount'], ['customer', tx('Customer')]]} filter={pfilter} setFilter={setPfilter} filters={[['all', tx('All Customers')], ['overdue', 'Overdue (7+ days)'], ['pinned', 'Pinned']]} />
            <button type="button" onClick={() => openEntry(null, 'udhar')} className="flex h-7 items-center gap-1 rounded-md bg-orange-500 px-3 text-[12px] font-medium text-white transition hover:bg-orange-600"><Plus size={14} />{tx('Add Udhar / Payment')}</button></div>
        </div>

        <div className="mb-2 flex items-center gap-2 rounded-md bg-[#FFF1E6] px-2 py-1.5">
          <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-gray-800"><Pin size={12} className="text-orange-500" fill="currentColor" />Pinned ({d?.pinned.length ?? 0}/4)</span>
          {d?.pinned.length ? <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 lg:grid-cols-4">{d.pinned.map((r, i) => <PinnedCard key={r.id} r={r} i={i} onView={setDrawer} onUnpin={(x) => pin(x, false)} />)}</div>
            : <span className="text-[11px] text-gray-500">{tx('Pin up to 4 customers from the table — they stay on top.')}</span>}
        </div>

        <div className="overflow-x-auto rounded-md bg-white">
          <table className="w-full min-w-[860px] text-[12px]">
            <thead className="bg-[#F8FAFC]"><tr><Th>#</Th><Th>Name</Th><Th>Phone</Th><Th>{tx('Total Udhar')}</Th><Th>Last Added</Th><Th>Days Pending</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {!d && [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={8} className="p-1"><div className="h-6 animate-pulse rounded bg-gray-100" /></td></tr>)}
              {d && !pRows.length && <tr><td colSpan={8} className="py-6 text-center text-[12px] text-gray-400">{d.pending.length ? 'No customers match this search/filter' : tx('No pending udhar 🎉')}</td></tr>}
              {pRows.map((r, i) => (
                <tr key={r.id} className="h-[34px] border-b border-gray-50 transition last:border-0 hover:bg-[#FFFAF4]">
                  <td className="px-2 text-gray-500">{i + 1}</td>
                  <td className="px-2"><button type="button" onClick={() => setDrawer(r)} className="flex items-center gap-1.5 text-left font-medium hover:text-orange-600"><Avatar name={r.name} size={20} i={i} />{r.name}</button></td>
                  <td className="px-2 text-gray-600">{r.phone}</td>
                  <td className="px-2 text-[13px] font-bold text-[#E5381D]">{inr(r.total)}</td>
                  <td className="px-2 text-gray-600">{dt(r.lastAdded)}</td>
                  <td className="px-2"><DaysBadge n={r.days} /></td>
                  <td className="px-2"><StatusBadge s="pending" /></td>
                  <td className="px-2"><span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <button type="button" title={r.pinned ? 'Unpin' : 'Pin to top'} aria-label="Pin" onClick={() => pin(r, !r.pinned)} className={`rounded p-1 transition hover:bg-orange-50 ${r.pinned ? 'text-orange-500' : 'text-gray-500'}`}><Pin size={13} fill={r.pinned ? 'currentColor' : 'none'} /></button>
                    <button type="button" onClick={() => openEntry(r, 'payment')} className={`${btn} bg-[#EAF3FF] text-[#2F6FEB] hover:bg-[#d9eaff]`}><Plus size={11} />Add / Receive</button>
                    <button type="button" onClick={() => setDrawer(r)} className={`${btn} border border-gray-200 text-gray-700 hover:border-orange-300`}><Eye size={11} />View</button>
                    <RowMenu items={menu(r, true)} /></span></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        {d && pending.length > 8 && <button type="button" onClick={() => setPall((v) => !v)} className="mx-auto mt-1 block text-[11.5px] font-medium text-[#2F6FEB] hover:underline">{pall ? 'Show less' : `Show all ${pending.length}`}</button>}
      </section>

      {/* Advance Balance — customer credit (positive balance) */}
      <section className="rounded-lg border border-[#D5E4FB] bg-[#F5F9FF] p-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-900"><Gift size={16} className="text-[#2F6FEB]" />Advance Balance ({d?.advance.length ?? '…'})<span className="text-[11px] font-normal text-gray-500">{tx('Customer Credit Balance')}</span>{!!d?.kpis.advance.amount && <span className="rounded bg-[#E3F7EC] px-1.5 py-0.5 text-[11px] font-semibold text-[#12A05C]">Total +{inr(d.kpis.advance.amount)}</span>}</h2>
          <Toolbar q={aq} setQ={setAq} sort={asort} setSort={setAsort} sorts={[['updated', 'Last Updated'], ['amount', 'Amount'], ['customer', tx('Customer')]]} filter="all" setFilter={() => {}} filters={[['all', tx('All Customers')]]} />
        </div>
        <div className="overflow-x-auto rounded-md bg-white">
          <table className="w-full min-w-[680px] text-[12px]">
            <thead className="bg-[#F8FAFC]"><tr><Th>#</Th><Th>Name</Th><Th>Phone</Th><Th>Credit Amount</Th><Th>Last Updated</Th><Th>Status</Th><Th c>Actions</Th></tr></thead>
            <tbody>
              {d && !aRows.length && <tr><td colSpan={7} className="py-5 text-center text-[12px] text-gray-400">{d.advance.length ? 'No customers match' : 'No advance balance yet — extra payments show up here'}</td></tr>}
              {aRows.map((r, i) => (
                <tr key={r.id} className="h-[34px] border-b border-gray-50 transition last:border-0 hover:bg-[#F5F9FF]">
                  <td className="px-2 text-gray-500">{i + 1}</td>
                  <td className="px-2"><button type="button" onClick={() => setDrawer(r)} className="flex items-center gap-1.5 text-left font-medium hover:text-orange-600"><Avatar name={r.name} size={20} i={i + 1} />{r.name}</button></td>
                  <td className="px-2 text-gray-600">{r.phone}</td>
                  <td className="px-2 text-[13px] font-bold text-[#12A05C]">+{inr(r.advance)}</td>
                  <td className="px-2 text-gray-600">{dt(r.lastUpdated)}</td>
                  <td className="px-2"><StatusBadge s="advance" /></td>
                  <td className="px-2 text-center"><span className="inline-flex items-center gap-1"><button type="button" onClick={() => setDrawer(r)} className={`${btn} border border-gray-200 px-3 text-gray-700 hover:border-orange-300`}><Eye size={11} />View</button><RowMenu items={menu(r, false)} /></span></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        {d && advance.length > 4 && <button type="button" onClick={() => setAall((v) => !v)} className="mx-auto mt-1 block text-[11.5px] font-medium text-[#2F6FEB] hover:underline">{aall ? 'Show less' : `Show all ${advance.length}`}</button>}
      </section>

      {/* Cleared */}
      <section className="rounded-lg border border-[#D8EEDF] bg-[#F6FCF8] p-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-900"><CheckCircle2 size={16} className="text-[#12A05C]" />{tx('Cleared Udhar (')}{d?.cleared.length ?? '…'})</h2>
          <Toolbar q={cq} setQ={setCq} sort={csort} setSort={setCsort} sorts={[['cleared', 'Latest Cleared'], ['name', 'Name']]} filter={cfilter} setFilter={setCfilter} filters={[['all', tx('All Customers')], ['recent', 'Cleared in 30 days']]} />
        </div>
        <div className="overflow-x-auto rounded-md bg-white">
          <table className="w-full min-w-[680px] text-[12px]">
            <thead className="bg-[#F8FAFC]"><tr><Th>#</Th><Th>Name</Th><Th>Phone</Th><Th>{tx('Total Udhar')}</Th><Th>Last Cleared</Th><Th>Status</Th><Th c>Actions</Th></tr></thead>
            <tbody>
              {d && !cRows.length && <tr><td colSpan={7} className="py-5 text-center text-[12px] text-gray-400">{d.cleared.length ? 'No customers match' : 'Nothing cleared yet'}</td></tr>}
              {cRows.map((r, i) => (
                <tr key={r.id} className="h-[34px] border-b border-gray-50 transition last:border-0 hover:bg-[#F6FCF8]">
                  <td className="px-2 text-gray-500">{i + 1}</td>
                  <td className="px-2"><button type="button" onClick={() => setDrawer(r)} className="flex items-center gap-1.5 text-left font-medium hover:text-orange-600"><Avatar name={r.name} size={20} i={i + 2} />{r.name}</button></td>
                  <td className="px-2 text-gray-600">{r.phone}</td>
                  <td className="px-2 text-[13px] font-bold text-gray-900">₹0</td>
                  <td className="px-2 text-gray-600">{dt(r.lastCleared)}</td>
                  <td className="px-2"><StatusBadge s="cleared" /></td>
                  <td className="px-2 text-center"><span className="inline-flex items-center gap-1"><button type="button" onClick={() => setDrawer(r)} className={`${btn} border border-gray-200 px-3 text-gray-700 hover:border-orange-300`}><Eye size={11} />View</button><RowMenu items={menu(r, false)} /></span></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        {d && cleared.length > 4 && <button type="button" onClick={() => setCall((v) => !v)} className="mx-auto mt-1 block text-[11.5px] font-medium text-[#2F6FEB] hover:underline">{call_ ? 'Show less' : `Show all ${cleared.length}`}</button>}
      </section>

      {drawer && <HistoryDrawer customer={drawer} version={ver} onClose={() => setDrawer(null)} onEntry={(c, t) => openEntry(c, t)} onOpenEntry={setDetail} />}
      {detail && <EntryDetail id={detail} onClose={() => setDetail(null)} />}
      {entry && <EntryModal init={entry} onClose={() => setEntry(null)} onSaved={saved} />}
    </div>
  )
}
