import React, { useEffect, useRef, useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { useParams, useSearchParams } from 'react-router-dom'
import { OwnerLink as Link } from '../../../hooks/useOwnerPath.jsx'
import { ArrowLeft, Printer, MessageCircle, Plus, CheckCircle2 } from 'lucide-react'
import { useSeller, call, Modal, Field } from '../kit.jsx'
import { Card } from '../ui.jsx'
import { inr, dt } from '../udhar/parts.jsx'
import { printBill, whatsappLink, billWhen } from '../billShare.js'

// Paid → neutral · Udhar → red · Advance → green
const STATUS = { Paid: 'bg-[#F1F3F7] text-gray-600', Udhar: 'bg-[#FDE8E8] text-[#D92D20]', Advance: 'bg-[#E3F7EC] text-[#12A05C]' }
const PAY = { Cash: 'bg-[#E6F0FE] text-[#2F6FEB]', UPI: 'bg-[#E6F0FE] text-[#2F6FEB]', Card: 'bg-[#EFE9FE] text-[#7A4BE0]', Udhar: 'bg-[#FFF1DC] text-[#E58A00]' }
const modalBtn = 'h-10 rounded-xl px-4 text-[14px] font-medium transition disabled:opacity-50'
const Pill = ({ cls, children, big }) => <span className={`inline-block rounded-md font-medium ${big ? 'px-3 py-1 text-[12.5px]' : 'px-2.5 py-0.5 text-[11.5px]'} ${cls}`}>{children}</span>
const Th = ({ children, r }) => <th className={`px-3 py-2 text-[12px] font-medium text-gray-600 ${r ? 'text-right' : 'text-left'}`}>{children}</th>

export default function BillDetailPage() {
  const { id } = useParams()
  const nav = useOwnerNavigate()
  const [sp, setSp] = useSearchParams()
  const q = useSeller(`/api/bills/${id}`)
  const [pay, setPay] = useState(null) // 'partial' | 'full' | null
  const [toast, setToast] = useState('')
  const printed = useRef(false)
  const b = q.data
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2400) }

  // "?print=1" (from the timeline's print icon) opens the print dialog once the bill is loaded
  useEffect(() => {
    if (b && sp.get('print') && !printed.current) { printed.current = true; printBill(b); setSp({}, { replace: true }) }
  }, [b, sp, setSp])

  const backTo = b?.customer?.id ? [`/customer/${b.customer.id}`, `Back to ${b.customer.name}`] : ['/analytics/billing', 'Back to Billing']
  const Back = () => <Link to={backTo[0]} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2F6FEB] hover:underline"><ArrowLeft size={15} />{backTo[1]}</Link>

  if (q.error) return <div className="space-y-3"><Back /><div className="rounded-xl bg-red-50 p-4 text-[13.5px] text-red-600">{q.error} <button type="button" onClick={() => nav(-1)} className="ml-2 font-medium underline">Go back</button></div></div>
  if (!b) return <div className="space-y-3"><Back />{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200/70" />)}</div>

  const s = b.summary
  return (
    <div className="space-y-4">
      <Back />

      {/* Header */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="leading-tight">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-[18px] font-semibold text-gray-900">Bill {b.id}</h2><Pill big cls={STATUS[b.status]}>{b.status}</Pill><Pill cls={PAY[b.paymentMethod] || PAY.Cash}>{b.paymentMethod}</Pill></div>
            <div className="mt-1 text-[13px] text-gray-500">{billWhen(b.date)}</div>
            <div className="mt-1 text-[13.5px] text-gray-800">
              {b.customer ? <>{b.customer.id ? <Link to={`/customer/${b.customer.id}`} className="font-medium text-[#2F6FEB] hover:underline">{b.customer.name}</Link> : <span className="font-medium">{b.customer.name}</span>}{b.customer.phone ? <span className="text-gray-500"> · {b.customer.phone}</span> : null}</> : <span className="text-gray-500">Walk-in customer</span>}
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" onClick={() => printBill(b)} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"><Printer size={14} />Print Bill</button>
            <a href={whatsappLink(b)} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg bg-[#E3F7EC] px-3 text-[12.5px] font-medium text-[#12A05C] transition hover:bg-[#d3f0e0]"><MessageCircle size={14} />Share on WhatsApp</a>
            {b.canAddPayment && <>
              <button type="button" onClick={() => setPay('partial')} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#E6F0FE] px-3 text-[12.5px] font-medium text-[#2F6FEB] transition hover:bg-[#d8e7fd]"><Plus size={14} />Add Payment</button>
              <button type="button" onClick={() => setPay('full')} className="flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-[12.5px] font-medium text-white transition hover:bg-orange-600"><CheckCircle2 size={14} />Convert to Paid</button>
            </>}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Items */}
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-2.5"><h3 className="text-[14.5px] font-semibold text-gray-900">Items <span className="text-[12px] font-normal text-gray-400">({b.items.length})</span></h3></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead className="bg-[#FAFBFD]"><tr><Th>Product</Th><Th r>Qty</Th><Th r>Price</Th><Th r>Total</Th></tr></thead>
              <tbody>{b.items.map((i, k) => (
                <tr key={k} className="h-10 border-b border-gray-50 last:border-0"><td className="px-3 font-medium text-gray-900">{i.name}</td><td className="px-3 text-right">{i.qty}</td><td className="px-3 text-right">{inr(i.price)}</td><td className="px-3 text-right font-semibold">{inr(i.total)}</td></tr>))}
              {!b.items.length && <tr><td colSpan={4} className="py-6 text-center text-gray-400">No item details saved for this bill</td></tr>}</tbody>
            </table>
          </div>
        </Card>

        {/* Payment summary */}
        <Card className="p-4">
          <h3 className="mb-2 text-[14.5px] font-semibold text-gray-900">Payment Summary</h3>
          <dl className="space-y-1.5 text-[13px]">
            <Row l="Subtotal" v={inr(s.subtotal)} />
            {s.discount > 0 && <Row l="Discount" v={`−${inr(s.discount)}`} vc="text-[#12A05C]" />}
            <Row l="Total Amount" v={inr(s.total)} bold />
            <hr className="border-gray-100" />
            {s.advanceUsed > 0 && <Row l="Advance used" v={`−${inr(s.advanceUsed)}`} vc="text-[#2F6FEB]" />}
            <Row l="Amount Received" v={inr(s.amountReceived)} />
            <Row l="Return Amount" v={inr(s.returnAmount)} />
            {s.laterPayments > 0 && <Row l="Paid later" v={inr(s.laterPayments)} vc="text-[#2F6FEB]" />}
            <hr className="border-gray-100" />
            <Row l="Remaining Udhar" v={inr(s.remainingUdhar)} bold vc={s.remainingUdhar > 0 ? 'text-[#D92D20]' : 'text-gray-500'} />
            {s.advanceAdded > 0 && <Row l="Advance Balance added" v={`+${inr(s.advanceAdded)}`} bold vc="text-[#12A05C]" />}
          </dl>
          <p className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${b.status === 'Udhar' ? 'bg-[#FDECEC] text-[#D92D20]' : b.status === 'Advance' ? 'bg-[#EAF8F0] text-[#12A05C]' : 'bg-[#F7F8FB] text-gray-600'}`}>
            {b.status === 'Udhar' ? `Paid less than the total — ${inr(s.remainingUdhar)} is on udhar.` : b.status === 'Advance' ? `Paid more than the total — ${inr(s.advanceAdded)} went to Advance Balance.` : 'Paid in full.'}
          </p>
          {b.customerBalance != null && <p className="mt-2 text-[12px] text-gray-500">Customer balance now: <b className={b.customerBalance < 0 ? 'text-[#D92D20]' : b.customerBalance > 0 ? 'text-[#12A05C]' : ''}>{b.customerBalance < 0 ? `−${inr(-b.customerBalance)} (owes)` : b.customerBalance > 0 ? `+${inr(b.customerBalance)} (advance)` : '₹0'}</b></p>}
        </Card>
      </div>

      {b.payments.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-2.5"><h3 className="text-[14.5px] font-semibold text-gray-900">Payments received on this bill <span className="text-[12px] font-normal text-gray-400">({b.payments.length})</span></h3></div>
          <table className="w-full text-[13px]"><thead className="bg-[#FAFBFD]"><tr><Th>Date</Th><Th>Method</Th><Th r>Amount</Th></tr></thead>
            <tbody>{b.payments.map((p) => <tr key={p.id} className="h-9 border-b border-gray-50 last:border-0"><td className="px-3">{dt(p.date)}</td><td className="px-3">{p.method}</td><td className="px-3 text-right font-semibold text-[#2F6FEB]">{inr(p.amount)}</td></tr>)}</tbody></table>
        </Card>
      )}
      {b.notes && <Card className="p-4 text-[13px] text-gray-600"><b className="text-gray-800">Note:</b> {b.notes}</Card>}

      {pay && <PayModal bill={b} mode={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); q.reload(); say(pay === 'full' ? 'Bill marked as paid' : 'Payment recorded') }} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] text-white shadow-lg">{toast}</div>}
    </div>
  )
}

const Row = ({ l, v, bold, vc = 'text-gray-900' }) => <div className="flex items-center justify-between gap-3"><dt className={bold ? 'font-semibold text-gray-900' : 'text-gray-600'}>{l}</dt><dd className={`${bold ? 'text-[15px] font-semibold' : 'font-medium'} ${vc}`}>{v}</dd></div>

// Add Payment (any amount up to what is pending) · Convert to Paid (pays everything pending)
function PayModal({ bill, mode, onClose, onDone }) {
  const pending = bill.summary.remainingUdhar
  const [amount, setAmount] = useState(mode === 'full' ? String(pending) : '')
  const [method, setMethod] = useState('cash'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const n = Number(amount)
  const bad = mode === 'partial' && (!(n > 0) || n > pending + 0.005)
  const save = async () => {
    setBusy(true); setErr('')
    try { await call('post', `/api/bills/${bill.billId}/${mode === 'full' ? 'settle' : 'payment'}`, { amount: n, paymentType: method }); onDone() } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <Modal title={mode === 'full' ? 'Convert to Paid' : 'Add Payment'} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg bg-[#FDECEC] px-3 py-2 text-[13px] text-[#D92D20]">Pending on this bill: <b>{inr(pending)}</b></div>
        {mode === 'partial' ? <Field label="Amount received (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /> : <p className="text-[13px] text-gray-600">The full pending amount of <b>{inr(pending)}</b> will be received and this bill becomes Paid.</p>}
        <div>
          <div className="mb-1 text-[12.5px] text-gray-600">Received via</div>
          <div className="flex gap-2">{[['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']].map(([k, l]) => <button key={k} type="button" onClick={() => setMethod(k)} className={`h-9 flex-1 rounded-lg border text-[13px] font-medium transition ${method === k ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{l}</button>)}</div>
        </div>
        {mode === 'partial' && n > pending + 0.005 && <p className="text-[12.5px] text-red-600">Only {inr(pending)} is pending. For extra money use “Adjust Balance” on the customer page.</p>}
        {err && <p className="text-[13px] text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className={`${modalBtn} border border-gray-200 text-gray-700 hover:bg-gray-50`}>Cancel</button><button type="button" onClick={save} disabled={busy || bad} className={`${modalBtn} bg-orange-500 text-white hover:bg-orange-600`}>{mode === 'full' ? 'Mark as Paid' : 'Save Payment'}</button></div>
      </div>
    </Modal>
  )
}
