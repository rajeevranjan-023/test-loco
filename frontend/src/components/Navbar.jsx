import React from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useViewMode } from '../context/ViewModeContext.jsx'
import Img from './Img.jsx'
import { stripAt, profilePath } from '../utils/username.js'
import { loginUrl } from '../utils/redirect.js'

export default function Navbar() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isSeller } = useAuth()
  const { goHome, goAnalytics, viewMode } = useViewMode()
  const { pathname } = useLocation()
  const onHome = pathname === '/'

  const items = [
    { label: 'Home', icon: '🏠', onClick: () => { goHome(); navigate('/') }, active: onHome && viewMode !== 'seller' },
    { label: 'Search', icon: '🔍', onClick: () => navigate('/search') },
    { label: 'Analytics', icon: '📊', onClick: () => { if (isSeller && user?.username) navigate(profilePath(user.username, 'dashboard')); else navigate('/start-yours') }, active: !!user?.username && pathname.startsWith(`${profilePath(user.username)}/`) },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Img src="logo.png" alt="Loco" className="h-8 w-8 rounded-full !bg-transparent" eager />
          <span className="leading-none"><span className="block text-lg font-semibold text-orange-500">Loco</span><span className="text-[9px] text-gray-500">Local Finder</span></span>
        </Link>
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
          {isAuthenticated ? (
            <NavLink to={user.username ? profilePath(user.username) : '/start-yours'} className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-100 text-xs font-semibold text-orange-600">{user.name[0]}</span>{user.name.split(' ')[0]} ⌄
            </NavLink>
          ) : (
            <Link to={loginUrl(pathname)} className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white">Login</Link>
          )}
        </div>
      </div>
    </header>
  )
}
