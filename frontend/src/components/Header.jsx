import React, { useState } from 'react'
import Navbar from './Navbar.jsx'
import MessagesIcon from './MessagesIcon.jsx'
import '../css/Header.css'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

// Clean, app-like header: logo (opens Settings), the 4-item Navbar
// (Home / Search Servop / Analytic View / Account), the messages icon,
// and the signed-in user's name at the far right.
function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { isAuthenticated, user } = useAuth()
  const { theme } = useTheme()

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/settings" className="logo" aria-label="Open Settings">
          <span className="logo-icon"> <img src={theme === 'dark' ? '/logo.png' : '/logo.png'} alt={theme === 'dark' ? 'dark' : 'light'} /></span>
          <span className="logo-text">
            SERV<span className="logo-highlight">OP</span>
          </span>
        </Link>

        <Navbar menuOpen={menuOpen} closeMenu={() => setMenuOpen(false)} />

        <div className="header-actions">
          <MessagesIcon />

          {isAuthenticated ? (
            <span className="header-username">Hi, {user.name.split(' ')[0]}</span>
          ) : (
            <>
              <Link to="/login">
                <button className="btn btn-outline btn-sm header-login">Login</button>
              </Link>
              <Link to="/signup">
                <button className="btn btn-primary btn-sm header-signup">Sign Up</button>
              </Link>
            </>
          )}

          {/* Hamburger button, only visible on smaller screens */}
          <button
            className={`hamburger ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
