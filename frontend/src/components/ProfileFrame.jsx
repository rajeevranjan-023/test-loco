import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import SellerLayout from '../features/analytics/SellerLayout.jsx'
import SiteChrome from './SiteChrome.jsx'
import { useAccess } from './UsernameRoute.jsx'
import { profilePath, sectionOf } from '../utils/username.js'

export default function ProfileFrame() {
  const { username, loading, canManage } = useAccess()
  const { pathname } = useLocation()

  if (loading) return <div className="min-h-screen bg-[#F4F8FD]" aria-busy="true" />

  if (canManage) return <main><SellerLayout /></main>

  if (sectionOf(pathname) !== '') return <Navigate to={profilePath(username)} replace />
  return <SiteChrome />
}
