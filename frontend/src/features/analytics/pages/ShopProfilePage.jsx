import React, { useEffect, useState } from 'react'
import { useSeller, call, State, PageHead, Btn, Field } from '../kit.jsx'
import { Card } from '../ui.jsx'
import { useBusiness } from '../../../context/BusinessContext.jsx'

export default function ShopProfilePage() {
  const { t: T, isStudy } = useBusiness()
  const q = useSeller('/api/seller/me')
  const [f, setF] = useState(null)
  const [msg, setMsg] = useState({ ok: '', err: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const a = q.data?.account; if (!a) return
    setF({ shopName: a.name, description: a.description || '', phone: a.phone || '', address: a.location?.address || '', area: a.location?.area || '', district: a.location?.district || '',
      openTime: a.timing?.open || '09:00', closeTime: a.timing?.close || '21:00', homeDelivery: !!a.homeDelivery })
  }, [q.data])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const save = async () => {
    setBusy(true); setMsg({ ok: '', err: '' })
    try { await call('patch', '/api/seller/account', f); setMsg({ ok: `${T.business} profile saved ✓`, err: '' }) } catch (e) { setMsg({ ok: '', err: e.message }) } finally { setBusy(false) }
  }
  return (
    <>
      <PageHead title={`${T.business} Details`} sub={`This is what ${T.customers} see on your public page`} />
      <State q={q} empty={q.data && !f && `${T.business} profile not available`}>
        {f && (
          <Card className="max-w-[760px] p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" label={`${T.business} name`} value={f.shopName} onChange={set('shopName')} />
              <label className="block text-[13px] text-gray-600 sm:col-span-2">Description
                <textarea rows={3} value={f.description} onChange={set('description')} className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-[14px] outline-none focus:border-[#1F6FEB]" /></label>
              <Field label="Phone" value={f.phone} onChange={set('phone')} />
              <Field label="Area / locality" value={f.area} onChange={set('area')} />
              <Field className="sm:col-span-2" label="Address" value={f.address} onChange={set('address')} />
              <Field label="District" value={f.district} onChange={set('district')} />
              <div className="grid grid-cols-2 gap-3"><Field label="Opens" type="time" value={f.openTime} onChange={set('openTime')} /><Field label="Closes" type="time" value={f.closeTime} onChange={set('closeTime')} /></div>
              {!isStudy && <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" checked={f.homeDelivery} onChange={set('homeDelivery')} />Home delivery available</label>}
            </div>
            {msg.err && <p className="mt-4 text-sm text-red-600">{msg.err}</p>}{msg.ok && <p className="mt-4 text-sm text-[#12A05C]">{msg.ok}</p>}
            <div className="mt-5 flex justify-end"><Btn disabled={busy || !f.shopName} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Btn></div>
          </Card>)}
      </State>
    </>
  )
}
