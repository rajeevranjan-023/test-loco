import React, { useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { PageHead, Btn } from '../kit.jsx'
import { Card } from '../ui.jsx'

const PREFS = [['orders', 'New order alerts'], ['lowStock', 'Low stock alerts'], ['udhar', 'Udhar due reminders'], ['messages', 'Customer message alerts']]
const read = () => { try { return { orders: true, lowStock: true, udhar: true, messages: true, ...JSON.parse(localStorage.getItem('lf_seller_prefs') || '{}') } } catch { return {} } }

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
