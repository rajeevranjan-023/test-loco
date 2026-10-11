import React, { useCallback, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useViewMode } from '../../context/ViewModeContext.jsx'
import { useDismiss } from '../../hooks/useDismiss.js'
import { loginUrl, signupUrl } from '../../utils/redirect.js'
import Img from '../Img.jsx'
import { PANEL, MenuItem, MenuDivider } from './MenuParts.jsx'

// APPLICATION menu — opened by the Loco logo on the LEFT of the header. Things about the app itself (home, help, starting a
// business, signing in/out). Everything about the signed-in person lives in the avatar menu on the right (UserMenu).
export default function AppMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef(null), btn = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, root, btn)
  const navigate = useNavigate(), { pathname, search } = useLocation()
  const { isAuthenticated, isSeller, logout } = useAuth()
  const { goHome } = useViewMode()
  const go = (to) => () => { close(); navigate(to) }

  return (
    <div ref={root} className="relative">
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Loco menu" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-gray-50">
        <Img src="logo.png" alt="" className="h-8 w-8 rounded-full !bg-transparent" eager />
        <span className="text-left leading-none"><span className="block text-lg font-semibold text-orange-500">Loco</span><span className="text-[9px] text-gray-500">Local Finder ⌄</span></span>
      </button>
      {open && (
        <div role="menu" aria-label="Loco menu" className={`${PANEL} left-0`}>
          <MenuItem icon="🏠" onClick={() => { close(); goHome(); navigate('/') }}>Home</MenuItem>
          {isAuthenticated ? (
            <MenuItem icon="🔁" onClick={() => { close(); logout(); navigate(loginUrl(pathname + search)) }}>Switch account</MenuItem>
          ) : (
            <>
              <MenuItem icon="🔑" onClick={go(loginUrl(pathname + search))}>Log in</MenuItem>
              <MenuItem icon="✨" onClick={go(signupUrl(pathname + search))}>Sign up</MenuItem>
            </>
          )}
          {!isSeller && <MenuItem icon="🚀" onClick={go(isAuthenticated ? '/start-yours' : loginUrl('/start-yours'))}>Start your business</MenuItem>}
          <MenuItem icon="💬" onClick={go('/faq')}>Help &amp; Support</MenuItem>
          {isAuthenticated && (<><MenuDivider /><MenuItem icon="🚪" danger onClick={() => { close(); logout(); navigate('/') }}>Log out</MenuItem></>)}
        </div>
      )}
    </div>
  )
}
