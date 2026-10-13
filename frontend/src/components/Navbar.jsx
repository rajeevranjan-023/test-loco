import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useViewMode } from '../context/ViewModeContext.jsx'
import { Link } from 'react-router-dom'
import { profilePath } from '../utils/username.js'
import { loginUrl } from '../utils/redirect.js'
import AppMenu from './menus/AppMenu.jsx'
import UserMenu from './menus/UserMenu.jsx'

export default function Navbar() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isSeller } = useAuth()
  const { goHome, viewMode } = useViewMode()
  const { pathname } = useLocation()
  const onHome = pathname === '/'
  const ownerBase = user?.username ? profilePath(user.username) : null
  const merchant = isAuthenticated && isSeller && !!ownerBase // decided from the real account, not a flag

  const openAnalytics = () => {
    if (!isAuthenticated) return navigate(loginUrl('/activity'))
    navigate(merchant ? profilePath(user.username, 'dashboard') : '/activity')
  }

  const items = [
    { label: 'Home', icon: '🏠', onClick: () => { goHome(); navigate('/') }, active: onHome && viewMode !== 'seller' },
    { label: 'Search', icon: '🔍', onClick: () => navigate('/search') },
    { label: 'Analytics', icon: '📊', onClick: openAnalytics, active: merchant ? pathname.startsWith(`${ownerBase}/`) : pathname === '/activity' },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
        <AppMenu />
        <button type="button" className="hidden items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 sm:flex">
          📍 Bhopal, Madhya Pradesh ⌄
        </button>
        <nav className="order-last flex w-full justify-around md:order-none md:ml-auto md:w-auto md:gap-7">
          {items.map((i) => (
            <button key={i.label} type="button" onClick={i.onClick}
              className={`flex items-center gap-1.5 border-b-2 px-2 py-2 text-sm font-medium ${i.active ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-600 hover:text-orange-500'}`}>
              <span aria-hidden>{i.icon}</span>{i.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <Link to="/requirements" aria-label="Requirements" className="relative text-lg">🔔<span className="absolute -right-0.5 top-0 h-2 w-2 rounded-full bg-red-500" /></Link>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
