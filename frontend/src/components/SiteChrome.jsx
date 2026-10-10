import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'

// The public site frame (Navbar + page + Footer). Used as a layout route for normal pages and,
// around the profile, for viewers. Owners never get this frame — they get the owner shell instead (ProfileFrame).
export default function SiteChrome({ children }) {
  return (
    <>
      <Navbar />
      <main>{children ?? <Outlet />}</main>
      <Footer />
    </>
  )
}
