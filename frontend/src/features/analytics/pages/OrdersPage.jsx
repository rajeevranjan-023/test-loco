import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { useOutletContext } from 'react-router-dom'
import { Download, Printer, Plus, Search, CalendarDays, Wallet, ArrowUpDown, Eye, ChevronRight, ChevronLeft, Store, ShoppingCart, Box, Truck, CheckCircle2, Package, RefreshCw } from 'lucide-react'
import { useSeller, call, Modal } from '../kit.jsx'
import { useCustomerPanel } from '../CustomerPanel.jsx'
import { Av, PayBadge, StatusSelect, Menu, STATUS, inr, time, dateOnly, waLink, orderText, printHtml, payText, pageKey, pageList } from '../orders/shared.jsx'
import { thermalHtml, printHtml as printDoc } from '../billOutput.js'

const TABS = ['All', 'Draft', ...STATUS] // Draft sits first: drafts are always on top of the list
const sel = 'h-8 rounded-lg border border-[#E3EAF3] bg-white pl-7 pr-2 text-[12px] text-gray-700 outline-none transition hover:border-orange-300 focus:border-orange-400'
const Pct = ({ v }) => <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${v > 0 ? 'bg-[#DDF3E7] text-[#12A05C]' : v < 0 ? 'bg-[#FDE0E0] text-[#D92D20]' : 'bg-gray-100 text-gray-500'}`}>{v > 0 ? `↑ +${v}%` : v < 0 ? `↓ ${v}%` : '0%'}</span>

function Card({ tone, icon: I, ic, label, count, pct, sub }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${tone}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${ic}`}><I size={19} /></span>
      <div className="min-w-0 flex-1 leading-tight"><div className="text-[11.5px] font-medium text-gray-800">{label}</div>
        <div className="flex items-center justify-between gap-1"><span className="text-[22px] font-bold text-gray-900">{count}</span><Pct v={pct} /></div>
        <div className="text-[11px] text-gray-500">{sub}</div></div>
    </div>
  )
}

export default function OrdersPage() {
  const nav = useOwnerNavigate()
  const ctx = useOutletContext() || {}
  const panel = useCustomerPanel()
  const [tab, setTab] = useState('All'); const [q, setQ] = useState(''); const [qd, setQd] = useState('')
  const [date, setDate] = useState('all'); const [pay, setPay] = useState('all'); const [sort, setSort] = useState('status'); const [page, setPage] = useState(1)
  const [picked, setPicked] = useState(() => new Set()); const [edit, setEdit] = useState(null); const [toast, setToast] = useState('')
  const searchRef = useRef()

  useEffect(() => { const t = setTimeout(() => setQd(q), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(1); setPicked(new Set()) }, [tab, qd, date, pay, sort])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t) }, [toast])
  useEffect(() => { // "/" jumps to search
    const h = (e) => { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  const params = useCallback((extra = {}) => new URLSearchParams({ ...(tab !== 'All' && { status: tab }), ...(qd.trim() && { q: qd.trim() }), ...(date !== 'all' && { date }), ...(pay !== 'all' && { payment: pay }), sort, ...extra }).toString(), [tab, qd, date, pay, sort])
  const data = useSeller(`/api/seller/orders?${params({ page, limit: 10 })}`)
  const d = data.data
  const [rows, setRows] = useState([]); const [counts, setCounts] = useState({}); const [summary, setSummary] = useState(null); const [preview, setPreview] = useState(null)
  useEffect(() => { if (d) { setRows(d.orders); setCounts(d.counts); setSummary(d.summary) } }, [d]) // sorted order comes from the API — only on (re)fetch
  // Rows never jump when a status changes. The list is only re-sorted when the page loads or when Refresh is pressed.
  const refresh = () => { data.reload(); ctx.reloadSummary?.() }
  const CARD = { New: 'new', Preparing: 'preparing', 'Out for Delivery': 'out', Delivered: 'delivered' }
  const bump = (from, to) => { // keep tab counts + summary cards honest without moving any row
    setCounts((c) => ({ ...c, [from]: Math.max((c[from] || 0) - 1, 0), [to]: (c[to] || 0) + 1 }))
    setSummary((x) => { if (!x) return x; const n = { ...x }; if (CARD[from]) n[CARD[from]] = { ...n[CARD[from]], count: Math.max(n[CARD[from]].count - 1, 0) }; if (CARD[to]) n[CARD[to]] = { ...n[CARD[to]], count: n[CARD[to]].count + 1 }; return n })
  }

  const setStatus = async (o, status) => {
    if (status === 'Cancelled' && !window.confirm(`Cancel order ${o.id}? Stock will be returned and its udhar/advance entries reversed.`)) return
    const prev = o.status, patch = (st) => setRows((rs) => rs.map((r) => (r.billId === o.billId ? { ...r, status: st, ...(st === 'Cancelled' ? { payment: { kind: 'void', amount: 0, method: r.payment.method } } : {}) } : r)))
    patch(status); bump(prev, status) // instant, in place
    try { await call('patch', `/api/seller/orders/${o.billId}/status`, { status }); ctx.reloadSummary?.() }
    catch (e) { patch(prev); bump(status, prev); setToast(e.message) } // roll the row back if the server refused
  }
  const remove = async (o) => {
    if (o.isDraft) {
      if (!window.confirm('Delete this draft?')) return
      try { await call('delete', `/api/seller/billing/drafts/${o.draftId}`); setRows((rs) => rs.filter((r) => r.billId !== o.billId)); setCounts((c) => ({ ...c, All: Math.max((c.All || 1) - 1, 0), Draft: Math.max((c.Draft || 1) - 1, 0) })); setToast('Draft deleted') } catch (e) { setToast(e.message) }
      return
    }
    if (!window.confirm(`Delete order ${o.id} permanently? Stock is returned and its udhar/advance entries are reversed.`)) return
    try { await call('delete', `/api/seller/orders/${o.billId}`); setRows((rs) => rs.filter((r) => r.billId !== o.billId)); setCounts((c) => ({ ...c, All: Math.max((c.All || 1) - 1, 0), [o.status]: Math.max((c[o.status] || 1) - 1, 0) })); if (CARD[o.status]) setSummary((x) => x && { ...x, [CARD[o.status]]: { ...x[CARD[o.status]], count: Math.max(x[CARD[o.status]].count - 1, 0) }, total: { ...x.total, count: Math.max(x.total.count - 1, 0) } }); setToast('Order deleted'); ctx.reloadSummary?.() } catch (e) { setToast(e.message) }
  }
  const everything = async () => { const r = await call('get', `/api/seller/orders?${params({ export: 1 })}`); return picked.size ? r.orders.filter((o) => picked.has(o.billId)) : r.orders }
  const exportCsv = async () => {
    const list = await everything()
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = ['Order ID,Customer,Phone,Items,Channel,Amount,Payment,Status,Placed', ...list.map((o) => [o.id, o.customerName, o.phone, o.itemCount, o.channel, o.amount, payText(o.payment), o.status, `${dateOnly(o.createdAt)} ${time(o.createdAt)}`].map(esc).join(','))].join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `orders-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }
  const printList = async () => {
    const list = await everything()
    printHtml('Orders', `<h3>All Orders (${list.length})</h3><table><tr><th>Order</th><th>Customer</th><th>Items</th><th>Channel</th><th>Amount</th><th>Payment</th><th>Status</th><th>Placed</th></tr>${list.map((o) => `<tr><td>${o.id}</td><td>${o.customerName} ${o.phone}</td><td>${o.itemCount}</td><td>${o.channel}</td><td>${inr(o.amount)}</td><td>${payText(o.payment)}</td><td>${o.status}</td><td>${dateOnly(o.createdAt)} ${time(o.createdAt)}</td></tr>`).join('')}</table>`)
  }
  // the print icon on a row → the 80mm receipt (A4 / Share are on the bill page and in billing)
  const printOne = async (o) => { try { printDoc(thermalHtml(await call('get', `/api/seller/billing/bills/${o.billId}/document`))) } catch (e) { alert(e.message || 'Could not print this bill') } }
  const open = (o) => (o.isDraft ? nav(`/analytics/billing?draft=${o.draftId}`) : nav(`/bill/${o.billId}`)) // a draft opens in the billing screen, ready to continue
  const openCustomer = (o) => o.customerId && panel.open(o.customerId)
  const stop = (e) => e.stopPropagation()

  const allPicked = rows.length > 0 && rows.every((o) => picked.has(o.billId))
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(rows.map((o) => o.billId)))
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const pages = useMemo(() => pageList(d?.pages || 1, d?.page || 1), [d])
  const from = d && d.total ? (d.page - 1) * d.limit + 1 : 0, to = d ? Math.min(d.page * d.limit, d.total) : 0
  const S = summary

  return (
    <div className="space-y-3 text-[12px]">
      {toast && <div role="status" className="fixed right-4 top-16 z-50 rounded-md bg-gray-900 px-3 py-1.5 text-[12px] text-white shadow-lg">{toast}</div>}

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5"><i className="h-9 w-1 rounded bg-orange-500" /><div className="leading-tight"><h1 className="text-[20px] font-semibold text-gray-900">All Orders</h1><p className="text-[12px] text-gray-500">Manage and track all your orders in one place</p></div></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={refresh} title="Reload and re-sort the list" className="flex h-8 items-center gap-1.5 rounded-lg border border-[#BFD7FB] bg-white px-3.5 text-[12.5px] font-medium text-[#2F6FEB] transition hover:bg-[#F5F9FF]"><RefreshCw size={14} className={data.loading && d ? 'animate-spin' : ''} />Refresh</button>
          <button type="button" onClick={exportCsv} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#BFD7FB] bg-white px-3.5 text-[12.5px] font-medium text-[#2F6FEB] transition hover:bg-[#F5F9FF]"><Download size={14} />Export</button>
          <button type="button" onClick={printList} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#BFD7FB] bg-white px-3.5 text-[12.5px] font-medium text-[#2F6FEB] transition hover:bg-[#F5F9FF]"><Printer size={14} />Print</button>
          <button type="button" onClick={() => nav('/analytics/billing')} className="flex h-8 items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 text-[12.5px] font-medium text-white transition hover:bg-orange-600"><Plus size={15} />New Order</button>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        {!S ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[66px] animate-pulse rounded-xl bg-gray-100" />) : <>
          <Card tone="bg-[#EEF4FD]" ic="bg-[#DCE9FB] text-[#2F6FEB]" icon={Store} label="Total Orders" count={S.total.count} pct={S.total.pct} sub="vs last month" />
          <Card tone="bg-[#FFF3EE]" ic="bg-[#FFE0D2] text-orange-500" icon={ShoppingCart} label="New Orders" count={S.new.count} pct={S.new.pct} sub="awaiting confirmation" />
          <Card tone="bg-[#EEF4FD]" ic="bg-[#DCE9FB] text-[#2F6FEB]" icon={Box} label="Preparing" count={S.preparing.count} pct={S.preparing.pct} sub="being packed" />
          <Card tone="bg-[#FFF8EC]" ic="bg-[#FFEBC7] text-[#E58A00]" icon={Truck} label="Out for Delivery" count={S.out.count} pct={S.out.pct} sub="on the way" />
          <Card tone="bg-[#EDF9F2]" ic="bg-[#D3F0E0] text-[#12A05C]" icon={CheckCircle2} label="Delivered" count={S.delivered.count} pct={S.delivered.pct} sub="completed orders" />
        </>}
      </div>

      {/* tabs + search + filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`h-8 rounded-full border px-3.5 text-[12px] font-medium transition ${tab === t ? 'border-orange-500 bg-orange-500 text-white' : 'border-[#E3EAF3] bg-white text-gray-700 hover:border-orange-300'}`}>{t} ({counts?.[t] ?? '·'})</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative"><Search size={14} className="absolute left-2.5 top-[9px] text-gray-400" /><input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by Order ID, customer name or phone…  ( / )" aria-label="Search orders" className="h-8 w-[300px] rounded-lg border border-[#E3EAF3] bg-white pl-8 pr-2 text-[12px] outline-none transition focus:border-orange-400" /></div>
          <div className="relative"><CalendarDays size={13} className="pointer-events-none absolute left-2 top-[9px] text-gray-500" /><select value={date} onChange={(e) => setDate(e.target.value)} className={sel} aria-label="Date"><option value="all">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option></select></div>
          <div className="relative"><Wallet size={13} className="pointer-events-none absolute left-2 top-[9px] text-gray-500" /><select value={pay} onChange={(e) => setPay(e.target.value)} className={sel} aria-label="Payment"><option value="all">Payment</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="udhar">Udhar</option><option value="advance">Advance</option></select></div>
          <div className="relative"><ArrowUpDown size={13} className="pointer-events-none absolute left-2 top-[9px] text-gray-500" /><select value={sort} onChange={(e) => setSort(e.target.value)} className={sel} aria-label="Sort"><option value="status">Default (by status)</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount_desc">Amount: high → low</option><option value="amount_asc">Amount: low → high</option><option value="customer">Customer A–Z</option></select></div>
        </div>
      </div>

      {picked.size > 0 && <div className="flex items-center gap-3 rounded-lg bg-[#FFF3EA] px-3 py-1.5 text-[12px]"><b>{picked.size} selected</b><button type="button" onClick={printList} className="text-[#2F6FEB] underline">Print</button><button type="button" onClick={exportCsv} className="text-[#2F6FEB] underline">Export</button><button type="button" onClick={() => setPicked(new Set())} className="text-gray-500 underline">Clear</button></div>}

      {/* table */}
      <div className={`overflow-x-auto rounded-xl border border-[#E8EEF6] bg-white transition-opacity ${data.loading && d ? 'opacity-60' : ''}`}>
        <table className="w-full min-w-[1040px] text-[12px]">
          <thead className="bg-[#F8FAFC]"><tr className="text-left text-[11.5px] font-semibold text-gray-700">
            <th className="w-9 px-3 py-2"><input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Select all" className="h-3.5 w-3.5 accent-orange-500" /></th>
            <th className="px-2">Order ID</th><th className="px-2">Customer</th><th className="px-2">Items</th><th className="px-2">Channel</th><th className="px-2">Amount</th><th className="px-2">Payment</th><th className="px-2">Status</th><th className="px-2">Placed</th><th className="px-2">Actions</th></tr></thead>
          <tbody>
            {data.loading && !d && [0, 1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={10} className="p-1.5"><div className="h-9 animate-pulse rounded bg-gray-100" /></td></tr>)}
            {data.error && <tr><td colSpan={10} className="p-4 text-red-600">{data.error} <button type="button" className="underline" onClick={data.reload}>Retry</button></td></tr>}
            {d && !rows.length && <tr><td colSpan={10} className="py-12 text-center text-[13px] text-gray-400">No orders match these filters</td></tr>}
            {rows.map((o) => {
              const cancelled = o.status === 'Cancelled', link = !!o.customerId
              return (
                <tr key={o.billId} onClick={() => open(o)} title={o.isDraft ? 'Resume draft' : 'Open bill details'} className={`h-[52px] cursor-pointer border-b border-gray-50 transition last:border-0 hover:bg-[#FFF3E6] ${o.isDraft ? 'bg-[#FAF8FF]' : cancelled ? 'bg-[#FAFAFB]' : o.payment.kind === 'pending' ? 'bg-[#FFF6EE]' : ''}`}>
                  <td className="px-3" onClick={stop}><input type="checkbox" checked={picked.has(o.billId)} onChange={() => toggle(o.billId)} aria-label={`Select ${o.id}`} className="h-3.5 w-3.5 cursor-pointer accent-orange-500" /></td>
                  <td className="px-2"><button type="button" onClick={(e) => { stop(e); open(o) }} title={o.isDraft ? 'Resume draft' : 'Open order details'} className="flex cursor-pointer items-center gap-1.5 font-bold text-gray-900 underline-offset-2 transition hover:text-orange-600 hover:underline">{o.id}<ChevronRight size={13} className="text-gray-400" /></button></td>
                  <td className="px-2">
                    <button type="button" disabled={!link} onClick={(e) => { stop(e); openCustomer(o) }} title={link ? `Open ${o.customerName}'s profile` : 'Walk-in customer'} className={`flex items-center gap-2 text-left ${link ? 'group cursor-pointer' : 'cursor-default'}`}>
                      <Av name={o.customerName} />
                      <span className="leading-tight"><span className={`block font-medium text-gray-900 ${link ? 'underline-offset-2 transition group-hover:text-orange-600 group-hover:underline' : ''}`}>{o.customerName}</span>
                        <span className={`block text-[11px] text-gray-500 ${link ? 'transition group-hover:text-orange-600 group-hover:underline' : ''}`}>{o.phone || (o.customerName === 'Walk-in' ? 'Walk-in Customer' : '—')}</span></span>
                    </button>
                  </td>
                  <td className="px-2 leading-tight"><button type="button" onClick={(e) => { stop(e); o.isDraft ? open(o) : setPreview(o) }} title={o.isDraft ? 'Resume draft' : 'Quick preview'} className="block cursor-pointer text-left"><span className="block font-semibold text-gray-900 hover:text-orange-600">{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</span>
                    <span className="mt-0.5 flex items-center gap-1">{o.preview.map((p, i) => (p.imageUrl ? <img key={i} src={p.imageUrl} alt={p.name} title={p.name} loading="lazy" className="h-5 w-5 rounded object-cover" /> : <span key={i} title={p.name} className="grid h-5 w-5 place-items-center rounded bg-gray-100 text-[11px]">{p.icon}</span>))}{o.more > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gray-100 px-1 text-[10px] font-medium text-gray-600">+{o.more}</span>}</span></button></td>
                  <td className="px-2"><span className="flex items-center gap-1.5 capitalize text-gray-700"><Store size={14} className="text-gray-500" />{o.channel}</span></td>
                  <td className={`px-2 text-[13px] font-bold ${cancelled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{inr(o.amount)}</td>
                  <td className="px-2"><PayBadge p={o.payment} /></td>
                  <td className="px-2" onClick={stop}><StatusSelect value={o.status} disabled={cancelled || o.isDraft} onChange={(st) => setStatus(o, st)} /></td>
                  <td className="px-2 leading-tight text-gray-700"><span className="block">{dateOnly(o.createdAt)}</span><span className="block text-gray-500">{time(o.createdAt)}</span></td>
                  <td className="px-2" onClick={stop}><span className="inline-flex items-center gap-1.5">
                    <button type="button" title={o.isDraft ? 'Resume draft' : 'View details'} aria-label={`View ${o.id}`} onClick={() => open(o)} className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-[#E3EAF3] text-gray-700 transition hover:border-orange-300 hover:text-orange-600"><Eye size={14} /></button>
                    {!o.isDraft && <button type="button" title="Print bill" aria-label={`Print ${o.id}`} onClick={() => printOne(o)} className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-[#E3EAF3] text-gray-700 transition hover:border-orange-300 hover:text-orange-600"><Printer size={14} /></button>}
                    <Menu items={o.isDraft ? [['Resume', () => open(o)], ['Delete', () => remove(o), true]] : [...(cancelled ? [] : [['Edit', () => setEdit(o)]]), ['Delete', () => remove(o), true], ['Share', () => window.open(waLink(o.phone, orderText(o)), '_blank')]]} /></span></td>
                </tr>)
            })}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-gray-500">Showing {from}–{to} of {d?.total ?? 0} orders</span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!d || d.page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page" className="grid h-8 w-8 place-items-center rounded-md border border-[#E3EAF3] bg-white text-gray-600 transition hover:border-orange-300 disabled:opacity-40"><ChevronLeft size={15} /></button>
          {pages.map((p, i) => (p === '…' ? <span key={pageKey(p, i)} className="px-1 text-gray-400">…</span> : <button key={pageKey(p, i)} type="button" onClick={() => setPage(p)} className={`h-8 min-w-8 rounded-md border px-2 text-[12px] font-medium transition ${p === d?.page ? 'border-orange-500 bg-orange-500 text-white' : 'border-[#E3EAF3] bg-white text-gray-700 hover:border-orange-300'}`}>{p}</button>))}
          <button type="button" disabled={!d || d.page >= d.pages} onClick={() => setPage(page + 1)} aria-label="Next page" className="grid h-8 w-8 place-items-center rounded-md border border-[#E3EAF3] bg-white text-gray-600 transition hover:border-orange-300 disabled:opacity-40"><ChevronRight size={15} /></button>
        </div>
      </div>

      {preview && <QuickPreview o={preview} onClose={() => setPreview(null)} onOpen={() => open(preview)} />}
      {edit && <EditModal o={edit} onClose={() => setEdit(null)} onSaved={(patch) => { setRows((rs) => rs.map((r) => (r.billId === edit.billId ? { ...r, ...patch } : r))); setEdit(null); setToast('Order updated') }} />}
    </div>
  )
}

function EditModal({ o, onClose, onSaved }) {
  const [notes, setNotes] = useState(o.notes || ''); const [channel, setChannel] = useState(o.channel); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const save = async () => { setBusy(true); try { onSaved(await call('patch', `/api/seller/orders/${o.billId}`, { notes, channel })) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <Modal title={`Edit ${o.id}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-3 text-[13px]">
        <div className="text-gray-500">{o.customerName} · {inr(o.amount)}</div>
        <label className="block text-[12px] text-gray-600">Channel<select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 outline-none focus:border-orange-400"><option value="offline">Offline</option><option value="online">Online</option></select></label>
        <label className="block text-[12px] text-gray-600">Notes<input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 outline-none focus:border-orange-400" /></label>
        {err && <p className="text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4">Cancel</button><button type="submit" disabled={busy} className="h-9 rounded-lg bg-orange-500 px-5 font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  )
}

// Bonus: peek into an order without leaving the list
function QuickPreview({ o, onClose, onOpen }) {
  const q = useSeller(`/api/bills/${o.billId}`)
  const b = q.data
  return (
    <Modal title={`Order ${o.id} · ${o.customerName}`} onClose={onClose}>
      {q.loading && !b ? <div className="h-32 animate-pulse rounded-xl bg-gray-100" /> : q.error ? <p className="text-sm text-red-600">{q.error}</p> : (
        <div className="text-[13px]">
          <table className="w-full"><thead className="bg-[#F5F7FA] text-left text-[12px]"><tr><th className="px-2 py-1.5">Item</th><th>Qty</th><th className="text-right">Price</th><th className="px-2 text-right">Total</th></tr></thead>
            <tbody>{b.lines.map((l, i) => <tr key={i} className="border-b border-gray-50"><td className="px-2 py-1.5">{l.icon} {l.name}</td><td>{l.qty}</td><td className="text-right">{inr(l.price)}</td><td className="px-2 text-right">{inr(l.total)}</td></tr>)}</tbody></table>
          <div className="mt-2 flex justify-between text-[14px] font-semibold"><span>Total</span><span>{inr(b.summary.total)}</span></div>
          <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4">Close</button><button type="button" onClick={onOpen} className="h-9 rounded-lg bg-orange-500 px-4 font-medium text-white transition hover:bg-orange-600">Open full bill</button></div>
        </div>)}
    </Modal>
  )
}
