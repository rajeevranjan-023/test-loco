import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { loginUrl, setPendingAction } from '../utils/redirect.js'

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
