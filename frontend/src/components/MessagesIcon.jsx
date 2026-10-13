import React from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useApiData } from '../hooks/useApiData.js'
import { useAuth } from '../context/AuthContext.jsx'

function MessagesIcon() {
  const { isAuthenticated, isSeller } = useAuth()

  const { data } = useApiData(
    () =>
      isAuthenticated
        ? isSeller
          ? api.get('/api/requirements/inbox?status=open', { requiresAuth: true })
          : api.get('/api/requirements/mine', { requiresAuth: true })
        : Promise.resolve(null),
    [isAuthenticated, isSeller]
  )

  if (!isAuthenticated) return null

  const count = isSeller
    ? data?.requirements?.filter((r) => !r.respondedByMe).length || 0
    : data?.filter((r) => r.status === 'open').length || 0

  return (
    <Link to="/requirements" className="messages-icon-btn" aria-label="Messages & Requests" title="Messages & Requests">
      💬
      {count > 0 && <span className="messages-icon-badge">{count > 9 ? '9+' : count}</span>}
    </Link>
  )
}

export default MessagesIcon
