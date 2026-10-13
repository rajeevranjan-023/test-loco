import React, { useEffect, useState } from 'react'
import { Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Bell, CalendarDays, ChevronDown, MessageCircle, Instagram, Facebook, Store } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useSeller } from './kit.jsx'
import RangePicker, { defaultRange } from './udhar/RangePicker.jsx'
import { CustomerPanelProvider } from './CustomerPanel.jsx'
import OwnerNav from '../../components/OwnerNav.jsx'
import { useAccess } from '../../components/UsernameRoute.jsx'
import { profilePath, sectionOf, toOwnerPath } from '../../utils/username.js'
import { BusinessProvider, useBusiness } from '../../context/BusinessContext.jsx'
import { iconOf } from '../../components/ownerIcons.js'
import { RouteErrorBoundary } from '../../components/ErrorBoundary.jsx'

// ONE page width/padding for the whole owner area — header, every page (profile included) and footer use it,
export const PAGE = 'mx-auto w-full max-w-[1320px] px-4 sm:px-6'

// The seller shell wraps every /:username/<dashboard|billing|udhar|analytics|inventory|customer|add|…> page.

function Clock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 15000); return () => clearInterval(i) }, [])
  const d = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), h = t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
  return <span className="hidden items-center gap-2 rounded-lg border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12px] text-gray-700 md:flex"><CalendarDays size={15} />{d}, {h}</span>
}

// Outer: fetch the shell summary (it carries the business schema) and publish it to every page below.
export default function SellerLayout() {
  const sum = useSeller('/api/seller/summary')
  return <BusinessProvider business={sum.data?.business}><Shell sum={sum} /></BusinessProvider>
}

function Shell({ sum }) {
  const { business: biz, t: T } = useBusiness()
  const BrandIcon = iconOf(biz.brand?.icon || 'Store')
  const { user, logout } = useAuth()
  const { isAdmin, isOwner } = useAccess()
  const { username } = useParams() // the shop being managed (admins may be on someone else's)
  const navigate = useNavigate()
  const section = sectionOf(useLocation().pathname)
  const [pop, setPop] = useState(null)
  const [urange, setUrange] = useState(defaultRange)
  const s = sum.data
  const toggle = (k) => setPop((p) => (p === k ? null : k))
  const go = (to) => { setPop(null); navigate(toOwnerPath(username, to)) }
  const Pop = ({ k, className = '', children }) => pop === k && (
    <><div className="fixed inset-0 z-40" onClick={() => setPop(null)} /><div className={`absolute right-0 top-[calc(100%+8px)] z-50 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg ${className}`}>{children}</div></>
  )
  const Item = ({ onClick, children, danger }) => <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition hover:bg-orange-50 ${danger ? 'text-red-600' : 'text-gray-800'}`}>{children}</button>
  return (
    <CustomerPanelProvider>
    <div className="min-h-screen bg-[#F4F8FD] text-gray-900">
      <header className="sticky top-0 z-30 border-b border-[#E8EEF6] bg-white">
        <div className={`${PAGE} flex items-center gap-4 py-2`}>
          <Link to={profilePath(username, 'analytics')} className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500 text-white"><BrandIcon size={19} /></span>
            <span className="leading-tight"><span className="block max-w-[150px] truncate text-[13px] font-semibold">{s?.shop?.name || `Your ${T.business}`}</span><span className="text-[10px] text-gray-500">{T.businessId}: {s?.shop?.code || '—'}</span></span>
          </Link>
          <OwnerNav username={username} className="mx-auto hidden items-center gap-1 lg:flex" />
          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            {(section === 'billing' || section === 'add') && <Clock />}
            {(section === 'udhar' || section === 'dues') && <RangePicker value={urange} onChange={setUrange} className="hidden md:block" />}
            <div className="relative">
              <button type="button" aria-label="Notifications" onClick={() => toggle('bell')} className="relative grid h-9 w-9 place-items-center rounded-lg transition hover:bg-gray-50"><Bell size={18} />{s?.notifications?.length > 0 && <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />}</button>
              <Pop k="bell" className="w-[300px]">
                <div className="px-3 py-2 text-[12px] font-semibold">Notifications</div>
                {s?.notifications?.length ? s.notifications.map((n) => <Item key={n.text} onClick={() => go(n.to)}>{n.text}</Item>) : <div className="px-3 py-4 text-center text-[12px] text-gray-500">You’re all caught up 🎉</div>}
              </Pop>
            </div>
            <div className="relative">
              <button type="button" onClick={() => toggle('user')} className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-500 text-sm font-semibold text-white">{(user?.name || 'U')[0]}</span>
                <span className="hidden text-left leading-tight sm:block"><span className="block text-[12.5px] font-medium">{user?.name}</span><span className="text-[10.5px] text-gray-500">{isAdmin && !isOwner ? 'Admin' : T.owner}</span></span>
                <ChevronDown size={15} className="text-gray-500" />
              </button>
              <Pop k="user" className="w-[220px]">
                {biz.userMenu ? biz.userMenu.map(([label, to]) => <Item key={label} onClick={() => go(to)}>{label}</Item>) : <>
                <Item onClick={() => go('/analytics/products')}>Products</Item>
                <Item onClick={() => go('/analytics/offers')}>Offers & Discounts</Item>
                <Item onClick={() => go('/analytics/messages')}><span className="flex-1">Messages</span>{s?.badges?.messages > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{s.badges.messages}</span>}</Item>
                <Item onClick={() => go('/analytics/profile')}>Shop Details</Item>
                <Item onClick={() => go('/analytics/settings')}>Settings</Item></>}
                <Item onClick={() => go(profilePath(username))}>View profile</Item>
                <Item onClick={() => go('/')}>Back to Loco</Item>
                <Item danger onClick={() => { logout(); navigate('/login') }}>Log out</Item>
              </Pop>
            </div>
          </div>
        </div>
        <OwnerNav username={username} className="flex gap-1 overflow-x-auto border-t border-[#EEF2F7] px-3 py-1.5 [scrollbar-width:none] lg:hidden" />
      </header>

      <main className={`${PAGE} py-5`}><RouteErrorBoundary><Outlet context={{ summary: s, reloadSummary: sum.reload, urange, setUrange }} /></RouteErrorBoundary></main>

      <footer className="mt-10 bg-[#0B0B0E] text-white">
        <div className={`${PAGE} grid gap-8 py-9 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]`}>
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-lg bg-orange-500"><BrandIcon size={22} /></span><div><div className="text-[15px] font-semibold">{s?.shop?.name || `Your ${T.business}`}</div><div className="text-[12px] text-white/60">{biz.brand?.tagline || `Your Local ${s?.shop?.category || 'Business'} Partner`}</div></div></div>
          <div><h4 className="mb-3 text-[12.5px] font-semibold">Quick Links</h4><ul className="space-y-2 text-[12px] text-white/65">{biz.footerLinks.map(([label, sub]) => <li key={sub}><Link to={profilePath(username, sub)} className="hover:text-orange-400">{label}</Link></li>)}</ul></div>
          <div><h4 className="mb-3 text-[12.5px] font-semibold">Support</h4><ul className="space-y-2 text-[12px] text-white/65"><li><Link to="/faq" className="hover:text-orange-400">Help Center</Link></li><li><Link to="/contact" className="hover:text-orange-400">Contact Us</Link></li><li><Link to="/terms" className="hover:text-orange-400">Terms & Conditions</Link></li></ul></div>
          <div><h4 className="mb-3 text-[12.5px] font-semibold">Follow Us</h4><div className="flex gap-2.5">{[[MessageCircle, 'bg-[#22C55E]', 'WhatsApp'], [Instagram, 'bg-gradient-to-br from-[#F59E0B] via-[#EF4444] to-[#C026D3]', 'Instagram'], [Facebook, 'bg-[#2563EB]', 'Facebook']].map(([I, bg, l]) => <a key={l} href="#" aria-label={l} onClick={(e) => e.preventDefault()} className={`grid h-9 w-9 place-items-center rounded-full transition hover:scale-110 ${bg}`}><I size={17} /></a>)}</div></div>
          <div><h4 className="mb-3 text-[12.5px] font-semibold">Download App</h4><div className="flex flex-wrap gap-2">{[['GET IT ON', 'Google Play'], ['Download on the', 'App Store']].map(([a, b]) => <button key={b} type="button" className="rounded-lg border border-white/30 px-3 py-1.5 text-left leading-tight transition hover:border-orange-400"><span className="block text-[8.5px] text-white/70">{a}</span><span className="text-[12px] font-medium">{b}</span></button>)}</div></div>
        </div>
        <div className="border-t border-white/10"><div className={`${PAGE} flex flex-wrap items-center justify-between gap-2 py-4 text-[11px] text-white/55`}><span>© {new Date().getFullYear()} {s?.shop?.name || 'Loco'}. All rights reserved.</span><span className="flex gap-5"><Link to="/privacy" className="hover:text-orange-400">Privacy Policy</Link><Link to="/terms" className="hover:text-orange-400">Terms of Service</Link><Link to="/terms" className="hover:text-orange-400">Refund Policy</Link></span></div></div>
      </footer>
    </div>
    </CustomerPanelProvider>
  )
}
