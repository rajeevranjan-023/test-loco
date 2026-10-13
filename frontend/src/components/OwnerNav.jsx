import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { profilePath, sectionOf } from '../utils/username.js'
import { useBusiness, SHOP_BUSINESS } from '../context/BusinessContext.jsx'
import { iconOf } from './ownerIcons.js'

export const OWNER_NAV = SHOP_BUSINESS.nav

const ALIAS = { bill: 'dashboard', order: 'dashboard', member: 'members' }
export const activeKey = (pathname, nav = OWNER_NAV) => {
  const sec = sectionOf(pathname)
  if (!sec) return 'profile'
  const key = ALIAS[sec] || sec
  return nav.some((n) => n.key === key) ? key : null
}

export default function OwnerNav({ username, className = '' }) {
  const { business } = useBusiness()
  const nav = business.nav
  const active = activeKey(useLocation().pathname, nav)
  return (
    <nav aria-label="Profile sections" className={className}>
      {nav.map(({ key, label, sub, icon }) => {
        const Icon = iconOf(icon)
        return (
          <NavLink
            key={key}
            to={profilePath(username, sub)}
            end
            aria-current={active === key ? 'page' : undefined}
            className={`flex min-w-[64px] shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-1.5 text-[11px] transition ${active === key ? 'border-orange-500 bg-orange-50 font-medium text-orange-600' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-orange-600'}`}
          >
            <Icon size={17} strokeWidth={1.8} />{label}
          </NavLink>
        )
      })}
    </nav>
  )
}
