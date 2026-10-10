import React, { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { setViewAs } from '../services/api.js'
import { looksLikeUsername, usernameMatches, profilePath, stripAt } from '../utils/username.js'

// Single source of truth for "who is looking at /:username?"
//   isOwner   – logged-in user's username === URL username   (can edit this profile)
//   isAdmin   – platform admin                               (can open every username's pages)
//   canManage – owner (seller) or admin                      (may see the management navigation + pages)
//   viewer    – everyone else, including logged-out users    (public profile only)
export function useAccess() {
  const { username } = useParams()
  const { user, isAuthenticated, isSeller, isAdmin, loading } = useAuth()
  const isOwner = isAuthenticated && usernameMatches(user?.username, username)
  const canManage = isAuthenticated && (isAdmin || (isOwner && isSeller))
  return { username, loading, isOwner, isAdmin, canManage, isViewer: !loading && !canManage }
}

// Wraps every /:username/* route. Step 1: validate the username BEFORE anything is fetched.
// Step 2: when an admin is looking at someone else's pages, tell the API who to act as.
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

// Guard for every management page (/:username/dashboard, /udhar, /billing …).
// Owner and admin pass; a viewer (or logged-out user) is sent back to the public profile /:username.
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
