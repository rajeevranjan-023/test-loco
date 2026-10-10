import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { call, Modal } from './kit.jsx'

// What this business can put on a bill. Saved on the account; the billing screen and the API both obey it.
const FLAGS = [
  ['products', 'Sell products', 'Pick items from inventory and sell them'],
  ['services', 'Provide services', 'Bill services (fixed, per unit or hourly)'],
  ['materials', 'Use inventory materials', 'Parts used in a job — taken from the same stock'],
  ['labour', 'Charge labour', 'Labour by the job, hour or unit'],
  ['otherCharges', 'Other charges', 'Cleaning, visiting, delivery…'],
  ['discount', 'Discount', 'Bill or item discount, in ₹ or %'],
  ['tax', 'Tax', 'Add tax (e.g. GST) to the bill'],
  ['editRate', 'Change product rate on a bill', 'Edit a product’s price for one bill only — stock price stays'],
  ['partialPayment', 'Part payment', 'Customer may pay less than the total'],
  ['udhar', 'Udhar (credit)', 'Allow the whole bill on udhar'],
]

export default function BillingOptions({ cfg, onClose, onSaved }) {
  const [caps, setCaps] = useState(() => ({ ...cfg.capabilities }))
  const [ctx, setCtx] = useState(() => (cfg.capabilities.context || []).map((f) => ({ ...f })))
  const [taxRate, setTaxRate] = useState(String(cfg.capabilities.taxRate || '')); const [taxName, setTaxName] = useState(cfg.capabilities.taxName || 'GST'); const [terms, setTerms] = useState(cfg.capabilities.terms || '')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const flip = (k) => setCaps((c) => ({ ...c, [k]: !c[k] }))
  const save = async () => {
    setBusy(true); setErr('')
    try { onSaved(await call('put', '/api/seller/billing/config', { ...caps, taxRate: Number(taxRate) || 0, taxName, terms, context: ctx.filter((f) => f.label.trim()) })) }
    catch (e) { setErr(e.message || 'Could not save') } finally { setBusy(false) }
  }
  return (
    <Modal title="Billing options" onClose={onClose}>
      <p className="mb-3 text-[12.5px] text-gray-500">Choose what your bills can contain. The billing screen only shows what you turn on.</p>
      <ul className="divide-y divide-gray-100">
        {FLAGS.map(([k, label, hint]) => (
          <li key={k} className="flex items-center gap-3 py-2">
            <span className="flex-1 leading-tight"><span className="block text-[13.5px] font-medium">{label}</span><span className="text-[11.5px] text-gray-400">{hint}</span></span>
            <button type="button" role="switch" aria-checked={!!caps[k]} aria-label={label} onClick={() => flip(k)} className={`relative h-6 w-11 rounded-full transition ${caps[k] ? 'bg-[#12A05C]' : 'bg-gray-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${caps[k] ? 'left-[22px]' : 'left-0.5'}`} /></button>
          </li>))}
      </ul>
      {caps.tax && <div className="mt-3 flex items-end gap-2"><label className="text-[12px] text-gray-600">Tax name<input value={taxName} maxLength={12} onChange={(e) => setTaxName(e.target.value)} className="mt-0.5 h-9 w-24 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-orange-400" /></label><label className="text-[12px] text-gray-600">Rate %<input value={taxRate} inputMode="decimal" onChange={(e) => setTaxRate(e.target.value.replace(/[^0-9.]/g, ''))} className="mt-0.5 h-9 w-24 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-orange-400" /></label></div>}
      <label className="mt-3 block text-[12px] text-gray-600">Terms / note printed on invoices <span className="text-gray-400">(optional)</span><textarea value={terms} maxLength={300} rows={2} onChange={(e) => setTerms(e.target.value)} className="mt-0.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-orange-400" /></label>
      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="text-[13.5px] font-medium">Extra details on a bill <span className="text-[11.5px] font-normal text-gray-400">(optional — e.g. Vehicle, Device, Job reference)</span></div>
        <div className="mt-2 space-y-1.5">
          {ctx.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={f.label} maxLength={30} placeholder="Field name" onChange={(e) => setCtx((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value, key: undefined } : x)))} className="h-9 flex-1 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
              <label className="flex items-center gap-1 text-[12px] text-gray-600"><input type="checkbox" checked={!!f.required} onChange={() => setCtx((l) => l.map((x, j) => (j === i ? { ...x, required: !x.required } : x)))} />Required</label>
              <button type="button" aria-label="Remove field" onClick={() => setCtx((l) => l.filter((_, j) => j !== i))} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
            </div>))}
          {ctx.length < 6 && <button type="button" onClick={() => setCtx((l) => [...l, { label: '', required: false }])} className="flex items-center gap-1 text-[12.5px] font-medium text-[#2F6FEB]"><Plus size={14} />Add field</button>}
        </div>
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-gray-200 px-4 text-[14px]">Cancel</button><button type="button" onClick={save} disabled={busy} className="h-10 rounded-xl bg-orange-500 px-5 text-[14px] font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button></div>
    </Modal>
  )
}
