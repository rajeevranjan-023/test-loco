import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { loginUrl, setPendingAction } from '../utils/redirect.js'

// For protected actions on public pages (Follow, Save, Contact …):
//     const requireAuth = useRequireAuth()
//     const onClick = () => { if (!requireAuth({ action: { type: 'follow', targetType, targetId } })) return; …do it… }
// Logged out → remembers where the visitor was (+ the action), opens the login/signup experience, and returns false.
// The backend still enforces authentication on the API call itself.
export function useRequireAuth() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  return useCallback(({ action, next } = {}) => {
    if (isAuthenticated) return true
    const returnTo = next || pathname + search
    if (action) setPendingAction({ ...action, returnTo: pathname + search })
    navigate(loginUrl(returnTo))
    return false
  }, [isAuthenticated, navigate, pathname, search])
}
