import React, { useEffect, useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { PageHead, Btn, call } from '../kit.jsx'
import { BillingItemsList } from '../BillingOptions.jsx'
import { Card } from '../ui.jsx'

const PREFS = [['orders', 'New order alerts'], ['lowStock', 'Low stock alerts'], ['udhar', 'Udhar due reminders'], ['messages', 'Customer message alerts']]
const read = () => { try { return { orders: true, lowStock: true, udhar: true, messages: true, ...JSON.parse(localStorage.getItem('lf_seller_prefs') || '{}') } } catch { return {} } }

// Study centre only: which items the Billing page offers under “Add Item”. Each switch is saved to the database straight away (per centre).
function BillingItemsCard() {
  const [cfg, setCfg] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { let live = true; call('get', '/api/seller/billing/config').then((c) => live && setCfg(c)).catch(() => {}); return () => { live = false } }, [])
  if (!cfg?.billingItems) return null
  const flip = async (key) => {
    setBusy(true); setErr('')
    try { setCfg(await call('put', '/api/seller/billing/config', { [key]: !cfg.capabilities[key] })) } catch (e) { setErr(e.message || 'Could not save') } finally { setBusy(false) }
  }
  const none = !cfg.billingItems.some((i) => cfg.capabilities[i.key])
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-[16px] font-semibold">Billing Items</h3>
      <p className="mb-2 text-[12.5px] text-gray-500">Choose what can be added on the Billing page. Turning an item off only hides it for new bills — past bills are never changed.</p>
      <BillingItemsList items={cfg.billingItems} caps={cfg.capabilities} onToggle={flip} busy={busy} />
      {none && <p className="mt-2 text-[12.5px] text-amber-600">All items are off — the Billing page will show a message instead of the Add Item buttons.</p>}
      {err && <p role="alert" className="mt-2 text-[13px] text-red-600">{err}</p>}
    </Card>
  )
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { summary } = useOutletContext()
  const navigate = useOwnerNavigate()
  const [p, setP] = useState(read)
  const toggle = (k) => setP((x) => { const n = { ...x, [k]: !x[k] }; localStorage.setItem('lf_seller_prefs', JSON.stringify(n)); return n })
  return (
    <div className="grid max-w-[760px] gap-4">
      <PageHead title="Account & Preferences" />
      <Card className="p-5">
        <h3 className="mb-3 text-[16px] font-semibold">Account</h3>
        <dl className="grid gap-2 text-[14px] sm:grid-cols-2"><div><dt className="text-gray-500">Name</dt><dd>{user?.name}</dd></div><div><dt className="text-gray-500">Email</dt><dd>{user?.email}</dd></div><div><dt className="text-gray-500">Username</dt><dd>@{user?.username}</dd></div><div><dt className="text-gray-500">Plan</dt><dd>{summary?.shop?.plan || 'Free'}</dd></div></dl>
        <div className="mt-4 flex gap-2"><Btn variant="ghost" onClick={() => navigate('/settings')}>Edit account & password</Btn><Btn variant="ghost" onClick={() => navigate('/analytics/profile')}>Edit shop details</Btn></div>
      </Card>
      <BillingItemsCard />
      <Card className="p-5">
        <h3 className="mb-3 text-[16px] font-semibold">Notifications</h3>
        {PREFS.map(([k, l]) => (
          <label key={k} className="flex cursor-pointer items-center justify-between border-b border-gray-50 py-3 text-[14px] last:border-0">{l}
            <button type="button" role="switch" aria-checked={!!p[k]} onClick={() => toggle(k)} className={`relative h-6 w-11 rounded-full transition ${p[k] ? 'bg-[#1F6FEB]' : 'bg-gray-300'}`}><i className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${p[k] ? 'left-[22px]' : 'left-0.5'}`} /></button>
          </label>))}
      </Card>
      <div><Btn variant="danger" onClick={() => { logout(); navigate('/login') }}>Log out</Btn></div>
    </div>
  )
}
