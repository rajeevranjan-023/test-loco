import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { loginUrl } from '../utils/redirect.js'
import { useAuth } from '../context/AuthContext.jsx'
import { toOwnerPath, profilePath } from '../utils/username.js'

// Old global URLs (/analytics/billing, /customer/ID, /bill/ID …) no longer render anything.
// A logged-in seller is forwarded to the same page under their own username; everyone else goes to login / home.
export default function LegacyOwnerRedirect() {
  const { user, isAuthenticated, loading } = useAuth()
  const { pathname, search, hash } = useLocation()
  if (loading) return <div className="detail-empty">Loading...</div>
  if (!isAuthenticated) return <Navigate to={loginUrl(pathname + search)} replace />
  if (!user?.username) return <Navigate to="/start-yours" replace />
  const target = toOwnerPath(user.username, pathname + search + hash)
  return <Navigate to={target === pathname + search + hash ? profilePath(user.username) : target} replace />
}
