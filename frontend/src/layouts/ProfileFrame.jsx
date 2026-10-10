import { Navigate, useLocation } from 'react-router-dom'
import SellerLayout from './SellerLayout.jsx'
import SiteChrome from './SiteChrome.jsx'
import { useAccess } from '../components/UsernameRoute.jsx'
import { profilePath, sectionOf } from '../utils/username.js'

// THE layout for /@username/* — it is mounted once and stays mounted while the owner moves between
// Profile · Dashboard · Billing · Udhar · Analytics · Inventory · Customer · Add, so the header and the tab bar
// can never jump, remount or appear in two different places.
//
//   owner / admin → owner shell (SellerLayout: header + OwnerNav rendered ONCE) with the page in its <Outlet/>
//   viewer        → normal site frame, public profile only; any management URL is sent back to /@username
export default function ProfileFrame() {
  const { username, loading, canManage } = useAccess()
  const { pathname } = useLocation()

  // Don't guess owner-vs-viewer before auth is known — guessing wrong is what made the page flash and shift.
  if (loading) return <div className="min-h-screen bg-[#F4F8FD]" aria-busy="true" />

  if (canManage) return <main><SellerLayout /></main>

  if (sectionOf(pathname) !== '') return <Navigate to={profilePath(username)} replace />
  return <SiteChrome />
}
