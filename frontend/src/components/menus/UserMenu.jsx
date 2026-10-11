import React, { useCallback, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useDismiss } from '../../hooks/useDismiss.js'
import { loginUrl, signupUrl } from '../../utils/redirect.js'
import { profilePath } from '../../utils/username.js'
import { PANEL, MenuItem, MenuDivider } from './MenuParts.jsx'

// PERSONAL account menu — opened by the avatar on the RIGHT of the header (like Instagram's profile menu). It only ever shows the
// current account's own details (read from the authenticated user, never hard-coded) and personal pages. Business management stays
// in the owner dashboard; application-level things stay in the Loco logo menu.
const SIZE = { 8: 'h-8 w-8', 10: 'h-10 w-10' } // literal class names (Tailwind can't see built-up ones)
function Avatar({ user, size = 8 }) {
  const [broken, setBroken] = useState(false)
  const initial = (user?.name || user?.username || '?').replace('@', '')[0]?.toUpperCase()
  const cls = `grid ${SIZE[size]} shrink-0 place-items-center overflow-hidden rounded-full bg-orange-100 text-xs font-semibold text-orange-600`
  return <span className={cls}>{user?.avatarUrl && !broken ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : initial}</span>
}

export default function UserMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef(null), btn = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, root, btn)
  const navigate = useNavigate(), { pathname, search } = useLocation()
  const { user, isAuthenticated, isSeller, logout } = useAuth()
  const go = (to) => () => { close(); navigate(to) }
  // a business owner's personal profile is their public page; everyone else's is their personal overview
  const myProfile = isSeller && user?.username ? profilePath(user.username) : '/activity'

  return (
    <div ref={root} className="relative">
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={isAuthenticated ? 'Account menu' : 'Login or sign up'} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full text-sm font-semibold hover:opacity-90">
        {isAuthenticated ? (<><Avatar user={user} /><span className="hidden sm:inline">{(user.name || '').split(' ')[0]} ⌄</span></>) : <span className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-base" aria-hidden>👤</span>}
      </button>
      {open && (
        <div role="menu" aria-label={isAuthenticated ? 'Account menu' : 'Login or sign up'} className={`${PANEL} right-0`}>
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5"><Avatar user={user} size={10} /><span className="min-w-0 leading-tight"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate text-xs text-gray-500">{user.username || user.email}</span></span></div>
              <MenuDivider />
              <MenuItem icon="👤" onClick={go(myProfile)}>Profile</MenuItem>
              <MenuItem icon="✏️" onClick={go('/settings?edit=1')}>Edit profile</MenuItem>
              <MenuItem icon="⚙️" onClick={go('/settings')}>Account settings</MenuItem>
              <MenuDivider />
              <MenuItem icon="🚪" danger onClick={() => { close(); logout(); navigate('/') }}>Log out</MenuItem>
            </>
          ) : (
            <>
              <MenuItem icon="🔑" onClick={go(loginUrl(pathname + search))}>Log in</MenuItem>
              <MenuItem icon="✨" onClick={go(signupUrl(pathname + search))}>Sign up</MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  )
}
