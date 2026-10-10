import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useOwnerNavigate } from '../../hooks/useOwnerPath.jsx'
import { X, ExternalLink, Store } from 'lucide-react'
import { useSeller } from './kit.jsx'
import { Avatar, inr, dt } from './udhar/parts.jsx'
import { useBusiness } from '../../context/BusinessContext.jsx'

// One slide-over for "who is this customer?", reachable from anywhere a customer name appears
// (billing form, recent bills, orders…):  const panel = useCustomerPanel();  panel.open(customerId)
const Ctx = createContext({ open: () => {} })
export const useCustomerPanel = () => useContext(Ctx)

export function CustomerPanelProvider({ children }) {
  const [id, setId] = useState(null)
  const value = useMemo(() => ({ open: setId, close: () => setId(null) }), [])
  return <Ctx.Provider value={value}>{children}{id && <CustomerPanel key={id} id={id} onClose={() => setId(null)} />}</Ctx.Provider>
}

// A customer name that opens the panel; plain text for walk-ins / unsaved customers.
export function CustomerLink({ id, className = '', children, stop = true }) {
  const { open } = useCustomerPanel()
  if (!id) return <span className={className}>{children}</span>
  return <button type="button" title="View customer history" onClick={(e) => { if (stop) e.stopPropagation(); open(id) }} className={`cursor-pointer text-left underline-offset-2 transition hover:text-orange-600 hover:underline ${className}`}>{children}</button>
}

const TONE = { Paid: 'bg-[#E3F7EC] text-[#12A05C]', Udhar: 'bg-[#F1EDFD] text-[#6D5BD0]', Advance: 'bg-[#E6F0FE] text-[#2F6FEB]' }
const Stat = ({ label, value, tone = 'text-gray-900' }) => <div className="rounded-xl bg-[#F6F8FB] px-3 py-2.5"><div className="text-[11px] text-gray-500">{label}</div><div className={`text-[17px] font-bold leading-tight ${tone}`}>{value}</div></div>

function CustomerPanel({ id, onClose }) {
  const nav = useOwnerNavigate()
  const q = useSeller(`/api/customers/${id}`)
  const [tab, setTab] = useState('Bills')
  const c = q.data

  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  const go = (to) => { onClose(); nav(to) }

  // payments the customer made (cash/UPI/card received, advance deposits)
  const payments = useMemo(() => (c?.balanceHistory || []).filter((e) => e.type === 'payment' || (e.type === 'credit' && e.delta < 0)), [c])
  const owes = c?.udharBalance > 0

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Customer details">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[430px] flex-col bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
          {c ? <Avatar name={c.name} size={44} i={1} /> : <div className="h-11 w-11 animate-pulse rounded-full bg-gray-100" />}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[16px] font-semibold text-gray-900">{c?.name || 'Loading…'}</div>
            <div className="text-[12px] text-gray-500">{c?.phone || (c ? 'No mobile number' : '')}</div>
          </div>
          {c && <button type="button" onClick={() => go(`/customer/${id}`)} title="Open full page" className="grid h-8 w-8 place-items-center rounded-md border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600"><ExternalLink size={15} /></button>}
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md hover:bg-gray-100"><X size={18} /></button>
        </div>

        {q.error ? <div className="m-4 rounded-xl bg-red-50 p-3 text-[13px] text-red-600">{q.error} <button type="button" className="underline" onClick={q.reload}>Retry</button></div>
          : !c ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}</div> : (
            <>
              <div className="grid grid-cols-2 gap-2 p-4">
                <Stat label="Total spent" value={inr(c.totalSpent)} />
                <Stat label="Total bills" value={c.totalOrders} />
                <Stat label={owes ? 'Udhar (owes you)' : c.creditBalance > 0 ? 'Advance (you hold)' : 'Udhar'} value={inr(owes ? c.udharBalance : c.creditBalance || 0)} tone={owes ? 'text-[#E58A00]' : c.creditBalance > 0 ? 'text-[#2F6FEB]' : 'text-gray-900'} />
                <Stat label="Last bill" value={dt(c.lastOrder)} />
              </div>

              <div className="flex gap-1.5 px-4">
                {['Bills', 'Payments', 'All shops'].map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`h-8 rounded-full px-3.5 text-[12px] font-medium transition ${tab === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-orange-50'}`}>{t}{t === 'Bills' ? ` (${c.orders.length})` : t === 'Payments' ? ` (${payments.length})` : ''}</button>)}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
                {tab === 'Bills' && (c.orders.length === 0 ? <p className="py-10 text-center text-[13px] text-gray-400">No bills yet</p> : (
                  <ul className="divide-y divide-gray-50">{c.orders.map((o) => (
                    <li key={o.billId}><button type="button" onClick={() => go(`/bill/${o.billId}`)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-orange-50/50">
                      <span className="flex-1 leading-tight"><span className="block text-[13px] font-semibold text-gray-900">{o.id}</span><span className="text-[11.5px] text-gray-500">{dt(o.date)} · {o.payment}</span></span>
                      <span className="text-right leading-tight"><span className="block text-[13px] font-semibold">{inr(o.amount)}</span><span className={`mt-0.5 inline-block rounded px-1.5 text-[10.5px] font-medium ${TONE[o.txnStatus] || TONE.Paid}`}>{o.txnStatus}</span></span>
                    </button></li>))}</ul>))}

                {tab === 'Payments' && (payments.length === 0 ? <p className="py-10 text-center text-[13px] text-gray-400">No payments recorded</p> : (
                  <ul className="divide-y divide-gray-50">{payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 leading-tight"><span className="block text-[13px] font-medium text-gray-900">{p.description}</span><span className="text-[11.5px] text-gray-500">{dt(p.date)} · {String(p.paymentType || 'cash').toUpperCase()}</span></span>
                      <span className="text-[13px] font-semibold text-[#12A05C]">+{inr(p.amount)}</span>
                    </li>))}</ul>))}

                {tab === 'All shops' && <AllShops id={id} />}
              </div>
            </>)}
      </aside>
    </div>
  )
}

// Same person (same phone) across every shop — fetched only when this tab is opened
function AllShops({ id }) {
  const q = useSeller(`/api/customers/${id}/global`)
  const g = q.data
  if (q.error) return <p className="text-[13px] text-red-600">{q.error}</p>
  if (!g) return <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
  if (!g.linked) return <p className="py-10 text-center text-[13px] text-gray-400">No mobile number saved, so this customer can’t be matched across shops.</p>
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-gray-500">{g.totals.shops} shop{g.totals.shops === 1 ? '' : 's'} · {g.totals.bills} bills · {inr(g.totals.spent)} spent in total</p>
      {g.shops.map((s) => (
        <div key={String(s.shopId)} className="rounded-xl border border-gray-100">
          <div className="flex items-center gap-2 border-b border-gray-50 px-3 py-2"><Store size={14} className="text-gray-500" /><span className="flex-1 truncate text-[13px] font-semibold">{s.shopName}{s.current && <em className="ml-1.5 rounded bg-orange-50 px-1 text-[10px] not-italic text-orange-600">this shop</em>}</span><span className="text-[12px] font-medium">{inr(s.spent)}</span></div>
          <ul className="max-h-40 divide-y divide-gray-50 overflow-y-auto px-3">{s.bills.map((b) => <li key={b.billId} className="flex items-center justify-between py-1.5 text-[12px]"><span className="text-gray-600">{s.current ? b.id : '#•••• '} · {dt(b.date)}</span><span><b>{inr(b.amount)}</b> <span className={`ml-1 rounded px-1 text-[10.5px] ${TONE[b.status]}`}>{b.status}</span></span></li>)}</ul>
        </div>))}
    </div>
  )
}
