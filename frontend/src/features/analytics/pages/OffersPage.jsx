import React, { useState } from 'react'
import { Plus, Trash2, Tag } from 'lucide-react'
import { useSeller, call, State, PageHead, Btn, Field, Modal, Pill, day } from '../kit.jsx'
import { Card } from '../ui.jsx'
import { CATEGORIES } from './ProductsPage.jsx'

const blank = { title: '', discountPercent: '', appliesTo: 'All products', validUntil: '' }
export default function OffersPage() {
  const q = useSeller('/api/seller/offers')
  const [form, setForm] = useState(null)
  const [err, setErr] = useState('')
  const act = async (fn) => { try { await fn(); q.reload() } catch (e) { alert(e.message) } }
  const save = async () => { setErr(''); try { await call('post', '/api/seller/offers', { ...form, discountPercent: +form.discountPercent, validUntil: form.validUntil || null }); setForm(null); q.reload() } catch (e) { setErr(e.message) } }
  const rows = q.data || []
  return (
    <>
      <PageHead title="Offers & Discounts" sub="Attract more customers with limited-time deals"><Btn onClick={() => { setErr(''); setForm(blank) }}><Plus size={16} />New Offer</Btn></PageHead>
      <State q={q} empty={q.data && !rows.length && 'No offers yet — create your first deal'}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((o) => {
            const expired = o.validUntil && new Date(o.validUntil) < new Date()
            return (
              <Card key={o._id} className="p-5">
                <div className="flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#FFF8E3] text-[#E09A0B]"><Tag size={22} /></span>
                  <span className="text-[26px] font-semibold text-[#12A05C]">{o.discountPercent}% <span className="text-[13px] font-normal text-gray-400">OFF</span></span>
                </div>
                <div className="mt-3 text-[16px] font-semibold">{o.title}</div>
                <div className="text-[13px] text-gray-500">On {o.appliesTo} · valid till {day(o.validUntil)}</div>
                <div className="mt-4 flex items-center justify-between">
                  {expired ? <Pill tone="red">Expired</Pill> : <Pill tone={o.active ? 'green' : 'gray'}>{o.active ? 'Active' : 'Paused'}</Pill>}
                  <span className="flex gap-2">
                    {!expired && <Btn variant="ghost" className="!h-8 !px-3 !text-[13px]" onClick={() => act(() => call('patch', `/api/seller/offers/${o._id}`, { active: !o.active }))}>{o.active ? 'Pause' : 'Activate'}</Btn>}
                    <button type="button" aria-label="Delete" onClick={() => window.confirm('Delete this offer?') && act(() => call('delete', `/api/seller/offers/${o._id}`))} className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"><Trash2 size={16} /></button>
                  </span>
                </div>
              </Card>)
          })}
        </div>
      </State>
      {form && (
        <Modal title="New Offer" onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field className="col-span-2" label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Field label="Discount %" type="number" min="1" max="100" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
            <Field label="Valid until" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            <label className="col-span-2 text-[13px] text-gray-600">Applies to
              <select value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px]">{['All products', ...CATEGORIES].map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setForm(null)}>Cancel</Btn><Btn disabled={!form.title || !(+form.discountPercent > 0)} onClick={save}>Create</Btn></div>
        </Modal>
      )}
    </>
  )
}
