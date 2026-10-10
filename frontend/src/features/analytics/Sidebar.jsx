import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Box, Package, FileText, Users, Wallet, BadgePercent, BarChart3, MessageSquare, Store, Settings, Crown, X } from 'lucide-react'

const B = '/analytics'
const items = [
  ['Dashboard', LayoutDashboard, B, true], ['Orders', ShoppingCart, `${B}/orders`, false, 'orders'], ['Products', Box, `${B}/products`], ['Inventory', Package, `${B}/inventory`],
  ['Billing', FileText, `${B}/billing`], ['Customers', Users, `${B}/customers`], ['Udhar / Credit', Wallet, `${B}/udhar`], ['Offers & Discounts', BadgePercent, `${B}/offers`],
  ['Analytics', BarChart3, `${B}/overview`], ['Messages', MessageSquare, `${B}/messages`, false, 'messages'], ['Shop Profile', Store, `${B}/profile`], ['Settings', Settings, `${B}/settings`],
]

export default function Sidebar({ shop, badges = {}, open, onClose }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[256px] flex-col bg-[#071B3E] text-white ${open ? 'flex' : 'hidden'} lg:flex`}>
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/logo.png" alt="" className="h-[50px] w-[50px] rounded-xl bg-white object-contain p-1" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-semibold">{shop?.name || 'Your Shop'}</div>
            <div className="text-xs text-white/60">Shop ID: {shop?.code || '—'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="lg:hidden"><X size={20} /></button>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-4">
          {items.map(([label, Icon, to, end, badge]) => (
            <NavLink key={label} to={to} end={end} onClick={onClose}
              className={({ isActive }) => `flex h-[48px] items-center gap-4 rounded-xl px-4 text-[15px] transition ${isActive ? 'bg-[#1F6FEB] font-medium text-white' : 'text-white/85 hover:bg-white/10'}`}>
              <Icon size={22} strokeWidth={1.7} />
              <span className="flex-1">{label}</span>
              {badge && badges[badge] > 0 && <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[#F04438] px-1 text-xs font-medium">{badges[badge]}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="m-4 rounded-2xl bg-[#0B5C4A] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#0A7A5F] text-amber-300"><Crown size={22} /></span>
            <div className="leading-tight"><div className="text-[15px] font-medium">Your Plan: {shop?.plan || 'Free'}</div><div className="mt-0.5 text-[11px] text-white/65">Upgrade for more features</div></div>
          </div>
          <button type="button" className="mt-3 h-11 w-full rounded-xl bg-[#12B76A] text-[15px] font-medium transition hover:bg-[#0fa35e]">Upgrade Now</button>
        </div>
      </aside>
    </>
  )
}
