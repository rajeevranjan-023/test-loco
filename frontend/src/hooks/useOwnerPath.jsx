import React, { useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toOwnerPath } from '../utils/username.js'

// Inside /:username/* pages: translate legacy paths ("/analytics/billing", "/customer/ID") into the
// username-scoped URL ("/raj236/billing", "/raj236/customer/ID").
export function useOwnerPath() {
  const { username } = useParams()
  return useCallback((to) => toOwnerPath(username, to), [username])
}

// Drop-in for useNavigate() on owner pages.
export function useOwnerNavigate() {
  const navigate = useNavigate()
  const path = useOwnerPath()
  return useCallback((to, opts) => (typeof to === 'number' ? navigate(to) : navigate(path(to), opts)), [navigate, path])
}

// Drop-in for <Link> on owner pages.
export function OwnerLink({ to, ...rest }) {
  const path = useOwnerPath()
  return <Link to={path(to)} {...rest} />
}
