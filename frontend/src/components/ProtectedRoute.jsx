import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { loginUrl } from '../utils/redirect.js'

function ProtectedRoute({ children, requireSeller = false }) {
  const { isAuthenticated, isSeller, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="detail-empty">Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to={loginUrl(location.pathname + location.search)} replace />
  }

  if (requireSeller && !isSeller) {
    return <Navigate to="/start-yours" replace />
  }

  return children
}

export default ProtectedRoute
