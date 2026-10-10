import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { profilePath } from '../utils/username.js'
import { loginUrl } from '../utils/redirect.js'

function MoreMenu() {
  const [open, setOpen] = useState(false)
  const { user, isAuthenticated, isSeller } = useAuth()
  const navigate = useNavigate()

  const goStartYours = () => {
    setOpen(false)
    if (!isAuthenticated) {
      navigate(loginUrl('/start-yours'))
      return
    }
    navigate('/start-yours')
  }

  const goToMyDashboard = () => {
    setOpen(false)
    if (user?.username) navigate(profilePath(user.username))
  }

  return (
    <div className="more-menu">
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)}>
        More ▾
      </button>
      {open && (
        <>
          <div className="more-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="more-menu-dropdown">
            {!isSeller && (
              <button type="button" onClick={goStartYours}>🚀 Start Yours</button>
            )}
            {isSeller && (
              <button type="button" onClick={goToMyDashboard}>
                📊 Manage My Business
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default MoreMenu

