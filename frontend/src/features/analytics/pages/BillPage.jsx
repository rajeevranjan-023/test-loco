import React, { useEffect, useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, MessageCircle, Plus, Store, CalendarDays, Phone, CheckCircle2 } from 'lucide-react'
import { useSeller, call, Modal } from '../kit.jsx'
import { Av, PayBadge, StatusSelect, inr, time, dateOnly, waLink } from '../orders/shared.jsx'
import BillActions from '../BillActions.jsx'
const SECTION = { product: 'PRODUCTS', service: 'SERVICES', material: 'MATERIALS', labour: 'LABOUR', other: 'OTHER CHARGES' }
const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card', advance: 'Advance' }

const Row = ({ l, v, bold, tone }) => <div className={`flex justify-between gap-4 py-1.5 text-[12.5px] ${bold ? 'border-t border-gray-100 pt-2 text-[14px] font-bold text-gray-900' : 'text-gray-600'}`}><span>{l}</span><span className={`font-medium ${tone || (bold ? '' : 'text-gray-900')}`}>{v}</span></div>
const Box = ({ title, children, className = '' }) => <section className={`rounded-xl border border-[#E8EEF6] bg-white p-3.5 ${className}`}>{title && <h3 className="mb-2 text-[13px] font-semibold text-gray-900">{title}</h3>}{children}</section>

export default function BillPage() {
  const { id } = useParams(); const nav = useOwnerNavigate(); const ctx = useOutletContext() || {}
  const q = useSeller(`/api/bills/${id}`)
  const b = q.data
  const [pay, setPay] = useState(null) // null | 'add' | 'convert'
  const [toast, setToast] = useState('')
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t) }, [toast])

  if (q.error) return <div className="rounded-xl bg-red-50 p-4 text-[13px] text-red-600">{q.error} <button type="button" className="ml-2 underline" onClick={() => nav('/analytics/orders')}>Back to orders</button></div>
  if (!b) return <div className="space-y-3"><div className="h-20 animate-pulse rounded-xl bg-gray-100" /><div className="h-64 animate-pulse rounded-xl bg-gray-100" /></div>

  const S = b.summary, c = b.customer, hasDue = S.unpaid > 0 && b.status !== 'Cancelled'
  const setStatus = async (status) => {
    if (status === 'Cancelled' && !window.confirm(`Cancel order ${b.id}? Stock will be returned and its udhar/advance entries reversed.`)) return
    try { await call('patch', `/api/bills/${b.billId}/status`, { status }); q.reload(); ctx.reloadSummary?.() } catch (e) { setToast(e.message) }
  }
  const remaining = hasDue
    ? { l: b.payment.kind === 'udhar' ? 'Remaining Udhar' : 'Pending amount', v: inr(S.unpaid), tone: b.payment.kind === 'udhar' ? 'text-[#6D5BD0]' : 'text-[#E58A00]' }
    : S.advanceAdded > 0 ? { l: 'Advance added', v: `+ ${inr(S.advanceAdded)}`, tone: 'text-[#2F6FEB]' } : { l: 'Remaining Udhar', v: '₹0 · Settled ✓', tone: 'text-[#12A05C]' }

  return (
    <div className="space-y-3 text-[12px]">
      {toast && <div role="status" className="fixed right-4 top-16 z-50 rounded-md bg-gray-900 px-3 py-1.5 text-[12px] text-white shadow-lg">{toast}</div>}
      <button type="button" onClick={() => nav('/analytics/orders')} className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#2F6FEB] hover:underline"><ArrowLeft size={14} />All Orders</button>

      {/* header */}
      <Box className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <i className="h-10 w-1 rounded bg-orange-500" />
          <div className="leading-tight"><div className="flex items-center gap-2.5"><h1 className="text-[20px] font-bold text-gray-900">Bill {b.id}</h1><StatusSelect value={b.status} disabled={b.status === 'Cancelled'} onChange={setStatus} /><PayBadge p={b.payment} /><span className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${b.statusKey === 'advance' ? 'bg-[#E3F7EC] text-[#12A05C]' : b.statusKey === 'udhar' ? 'bg-[#FDE8E8] text-[#D92D20]' : 'bg-[#F1F3F7] text-gray-600'}`}>{b.statusKey}</span></div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-gray-500"><span className="flex items-center gap-1"><CalendarDays size={13} />{dateOnly(b.date)}, {time(b.date)}</span><span className="flex items-center gap-1 capitalize"><Store size={13} />{b.channel}</span><span>Payment: <b className="text-gray-800">{b.method}</b></span></div></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BillActions size="sm" getDoc={() => call('get', `/api/seller/billing/bills/${b.billId}/document`)} />
          {hasDue && <><button type="button" onClick={() => setPay('add')} className="flex h-8 items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 text-[12.5px] font-medium text-white transition hover:bg-orange-600"><Plus size={15} />Add Payment</button>
          <button type="button" onClick={() => setPay('convert')} className="flex h-8 items-center gap-1.5 rounded-lg bg-[#12A05C] px-3.5 text-[12.5px] font-medium text-white transition hover:bg-[#0E8A4E]"><CheckCircle2 size={14} />Convert to Paid</button></>}
        </div>
      </Box>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Box title={`Items (${b.lines.length})`} className="!p-0">
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-[12.5px]">
              <thead className="bg-[#F8FAFC]"><tr className="text-left text-[11.5px] font-semibold text-gray-700"><th className="w-9 px-3 py-2">#</th><th className="px-2">Product</th><th className="px-2 text-right">Qty</th><th className="px-2 text-right">Price</th><th className="px-3 text-right">Total</th></tr></thead>
              <tbody>{['product', 'service', 'material', 'labour', 'other'].map((k) => { const rows = b.lines.map((l, i) => ({ l, i })).filter((x) => (x.l.type || 'product') === k); if (!rows.length) return null; return (
                <React.Fragment key={k}>
                  <tr className="bg-[#F8FAFC]"><td colSpan={5} className="px-3 py-1 text-[10.5px] font-semibold tracking-wide text-[#2F6FEB]">{SECTION[k]}</td></tr>
                  {rows.map(({ l, i }) => { const nc = l.charge && l.charge !== 'charged'; return (
                    <tr key={i} className="border-b border-gray-50 last:border-0 align-top hover:bg-[#FFFAF4]">
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-2 py-1.5"><span className="flex items-center gap-2">{l.imageUrl ? <img src={l.imageUrl} alt="" loading="lazy" className="h-6 w-6 rounded object-cover" /> : <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-gray-100 text-[12px]">{l.icon}</span>}<span>{l.name}{nc && <em className="ml-1.5 rounded bg-gray-100 px-1 text-[10px] not-italic text-gray-600">{l.charge === 'included' ? 'included in service' : 'not charged'}</em>}{l.description && <span className="block text-[11px] text-gray-400">{l.description}</span>}</span></span></td>
                      <td className="whitespace-nowrap px-2 text-right">{l.qty}{l.unit ? ` ${l.unit}` : ''}</td><td className="px-2 text-right">{nc ? '—' : inr(l.price)}{l.discount > 0 && <span className="block text-[10.5px] text-[#12A05C]">− {inr(l.discount)}</span>}</td><td className="px-3 text-right font-semibold">{nc ? '₹0' : inr(l.total)}</td>
                    </tr>) })}
                </React.Fragment>) })}</tbody>
            </table></div>
          </Box>
          {(b.notes || b.ledger.length > 0) && (
            <Box title="Notes & account activity">
              {b.notes && <p className="mb-2 rounded-md bg-[#F8FAFC] px-2.5 py-1.5 text-gray-600">Note: {b.notes}</p>}
              {b.ledger.length > 0 && <ul className="space-y-1">{b.ledger.map((e, i) => (
                <li key={i} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-gray-50"><span className="text-gray-700">{e.type === 'udhar' ? 'Udhar added' : e.type === 'payment' ? `Payment received (${e.paymentType})` : e.delta > 0 ? 'Advance used' : 'Advance added'}<span className="ml-2 text-[11px] text-gray-400">{dateOnly(e.date)}</span></span>
                  <span className={`font-semibold ${e.type === 'udhar' ? 'text-[#E5381D]' : e.type === 'payment' ? 'text-[#12A05C]' : 'text-[#2F6FEB]'}`}>{e.type === 'udhar' ? '+' : e.type === 'payment' ? '−' : e.delta > 0 ? '−' : '+'} {inr(e.amount)}</span></li>))}</ul>}
            </Box>)}
        </div>

        <div className="space-y-3">
          <Box title="Customer">
            <div className="flex items-center gap-2.5"><Av name={c.name} size={36} />
              <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13.5px] font-semibold text-gray-900">{c.name}</div><div className="flex items-center gap-1 text-gray-500"><Phone size={11} />{c.phone || 'No phone'}</div></div>
              {c.id && <button type="button" onClick={() => nav(`/customer/${c.id}#transactions`)} className="rounded-md border border-[#E3EAF3] px-2.5 py-1 text-[11.5px] transition hover:border-orange-300">Profile</button>}</div>
            {c.id && <div className="mt-2.5 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-[#F1EDFD] py-1.5"><div className="text-[10.5px] text-[#6D5BD0]">Udhar due now</div><div className="text-[14px] font-bold text-[#6D5BD0]">{inr(c.udharDue)}</div></div>
              <div className="rounded-lg bg-[#E6F0FE] py-1.5"><div className="text-[10.5px] text-[#2F6FEB]">Advance balance</div><div className="text-[14px] font-bold text-[#2F6FEB]">{inr(c.advance)}</div></div></div>}
            {b.balanceAfter != null && <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-gray-600"><span>Balance after this bill</span><b className={b.balanceAfter > 0 ? 'text-[#D92D20]' : b.balanceAfter < 0 ? 'text-[#12A05C]' : 'text-gray-700'}>{b.balanceAfter > 0 ? `${inr(b.balanceAfter)} due` : b.balanceAfter < 0 ? `${inr(-b.balanceAfter)} advance` : '₹0'}</b></div>}
          </Box>

          <Box title="Payment summary">
            <Row l="Subtotal" v={inr(S.subtotal)} />
            <Row l="Discount" v={S.discount > 0 ? `− ${inr(S.discount)}` : '₹0'} tone={S.discount > 0 ? 'text-[#12A05C]' : undefined} />
            {S.tax > 0 && <Row l={S.taxName || 'Tax'} v={`+ ${inr(S.tax)}`} />}
            <Row l="Total Amount" v={inr(S.total)} bold />
            {S.advanceUsed > 0 && <Row l="Advance used" v={`− ${inr(S.advanceUsed)}`} tone="text-[#2F6FEB]" />}
            <Row l="Amount Received" v={inr(S.received)} />
            <Row l="Return Amount" v={inr(S.returned)} />
            {b.payments?.length > 0 && <div className="mt-1 rounded-lg bg-[#F8FAFC] px-2.5 py-1 text-[11.5px] text-gray-600">{b.payments.map((p, i) => <div key={i} className="flex justify-between"><span>{METHOD_LABEL[p.method] || p.method} · {dateOnly(p.at)}</span><b className="text-gray-800">{inr(p.amount)}</b></div>)}</div>}
            <div className="mt-1 rounded-lg bg-[#F8FAFC] px-2.5 py-1"><Row l={remaining.l} v={remaining.v} tone={`text-[13.5px] font-bold ${remaining.tone}`} /></div>
            <p className="mt-2 text-[11px] leading-snug text-gray-400">{hasDue ? 'Paid less than the bill → the balance is on the customer’s Udhar.' : S.advanceAdded > 0 ? 'Paid extra → the difference was added to the customer’s Advance Balance.' : S.advanceUsed > 0 ? 'Part of this bill was paid from the customer’s Advance Balance.' : 'Paid in full.'}</p>
          </Box>
        </div>
      </div>

      {pay && <PayModal b={b} convert={pay === 'convert'} onClose={() => setPay(null)} onSaved={(r) => { setPay(null); q.reload(); ctx.reloadSummary?.(); setToast(r.extraToAdvance > 0 ? `Payment saved · ${inr(r.extraToAdvance)} extra added to Advance` : r.unpaid > 0 ? 'Payment recorded' : 'Bill fully paid ✓') }} />}
    </div>
  )
}

function PayModal({ b, convert, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(b.summary.unpaid)); const [pt, setPt] = useState('cash'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const a = Number(amount) || 0, left = Math.round((b.summary.unpaid - a) * 100) / 100
  const submit = async () => { setBusy(true); setErr(''); try { onSaved(await call('post', convert ? `/api/bills/${b.billId}/convert-paid` : `/api/bills/${b.billId}/payment`, convert ? { paymentType: pt } : { amount: a, paymentType: pt })) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const seg = (on) => `h-9 flex-1 rounded-lg border text-[12.5px] font-medium transition ${on ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`
  return (
    <Modal title={`${convert ? 'Convert to Paid' : 'Add Payment'} · ${b.id}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); a > 0 && submit() }} className="space-y-3 text-[13px]">
        <div className="flex justify-between rounded-lg bg-[#F8FAFC] px-3 py-2"><span className="text-gray-500">{b.customer.name} owes on this bill</span><b className="text-[#E5381D]">{inr(b.summary.unpaid)}</b></div>
        <label className="block text-[12px] text-gray-600">Amount received (₹)<input autoFocus readOnly={convert} value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} onFocus={(e) => e.target.select()} className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-[20px] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
        <div className="flex gap-2">{['cash', 'upi', 'card'].map((m) => <button key={m} type="button" onClick={() => setPt(m)} className={seg(pt === m)}>{m.toUpperCase()}</button>)}</div>
        {a > 0 && <div className={`rounded-lg px-3 py-2 text-[12px] ${left < 0 ? 'bg-[#E6F0FE] text-[#2F6FEB]' : left === 0 ? 'bg-[#E3F7EC] text-[#12A05C]' : 'bg-[#F8FAFC] text-gray-600'}`}>{left < 0 ? `${inr(-left)} extra will be added to the customer’s Advance Balance` : left === 0 ? 'This clears the bill completely ✓' : `Remaining after this: ${inr(left)}`}</div>}
        {err && <p className="text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4">Cancel</button><button type="submit" disabled={busy || !(a > 0)} className="h-9 rounded-lg bg-[#12A05C] px-5 font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : convert ? 'Mark as Paid' : 'Save Payment'}</button></div>
      </form>
    </Modal>
  )
}
