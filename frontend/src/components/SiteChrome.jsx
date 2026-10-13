import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import { RouteErrorBoundary } from './ErrorBoundary.jsx'

export default function SiteChrome({ children }) {
  return (
    <>
      <Navbar />
      <main><RouteErrorBoundary>{children ?? <Outlet />}</RouteErrorBoundary></main>
      <Footer />
    </>
  )
}
