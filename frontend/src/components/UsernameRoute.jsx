import React, { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { setViewAs } from '../services/api.js'
import { looksLikeUsername, usernameMatches, profilePath, stripAt } from '../utils/username.js'
export function useAccess() {
  const { username } = useParams()
  const { user, isAuthenticated, isSeller, isAdmin, loading } = useAuth()
  const isOwner = isAuthenticated && usernameMatches(user?.username, username)
  const canManage = isAuthenticated && (isAdmin || (isOwner && isSeller))
  return { username, loading, isOwner, isAdmin, canManage, isViewer: !loading && !canManage }
}

export function UsernameShell() {
  const { username } = useParams()
  const { isAdmin, isOwner } = useAccess()
  const { pathname, search, hash } = useLocation()
  setViewAs(isAdmin && !isOwner ? stripAt(username) : null) // set during render so child effects fetch with the right header
  useEffect(() => () => setViewAs(null), [])

  if (!looksLikeUsername(username)) {
    return (
      <section className="section">
        <div className="container detail-not-found">
          <h2>Page not found</h2>
          <p>That doesn't look like a valid shop link.</p>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </section>
    )
  }
  // One canonical URL: /raj236/billing → /@raj236/billing (same page, no duplicate addresses)
  if (!username.startsWith('@')) {
    return <Navigate to={`/@${pathname.slice(1)}${search}${hash}`} replace />
  }
  return <Outlet />
}

export function OwnerOnly({ children }) {
  const { username, loading, canManage } = useAccess()
  if (loading) return <div className="detail-empty">Loading...</div>
  return canManage ? children : <Navigate to={profilePath(username)} replace />
}

// Unknown sub-route like /raj236/foo → back to the profile
export function RedirectToProfile() {
  const { username } = useParams()
  return <Navigate to={profilePath(username)} replace />
}
