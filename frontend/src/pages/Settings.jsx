import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTitle } from '../hooks/title.js'
import { useFeedback } from '../hooks/useFeedback.js'
import { DEFAULT_AVATAR, DEFAULT_BANNER } from '../utils/placeholders.js'
import EditAccountModal from '../features/profile/EditAccountModal.jsx'
import FeedbackBanner from '../components/FeedbackBanner.jsx'
import '../css/Settings.css'
import { profilePath } from '../utils/username.js'

// Instagram-style Settings page, opened by clicking the SERVOP logo.
// Every logged-in user (consumer or seller) can edit their own account
// here; becoming a seller and logging out live here too, which keeps the
// header itself uncluttered.
function Settings() {
  useTitle('Settings')
  const { user, isAuthenticated, isSeller, logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [showEdit, setShowEdit] = useState(() => params.get('edit') === '1') // the avatar menu's "Edit profile" opens the existing editor straight away
  const { feedback, showSuccess } = useFeedback()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!isAuthenticated) {
    return (
      <section className="section">
        <div className="container detail-not-found">
          <h2>You're not logged in</h2>
          <p>Log in to see your account settings.</p>
          <Link to="/login?next=%2Fsettings" className="btn btn-primary">Log In</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="section settings-page">
      <div className="container settings-container">
        <h1 className="settings-title">Settings</h1>

        <FeedbackBanner feedback={feedback} />

        <div className="settings-profile-card card">
          <div className="settings-banner">
            <img src={user.bannerUrl || DEFAULT_BANNER} alt="" />
          </div>
          <div className="settings-profile-body">
            <span className="settings-avatar">
              <img src={user.avatarUrl || DEFAULT_AVATAR} alt={user.name} />
            </span>
            <div className="settings-profile-text">
              <p className="settings-name">{user.name}</p>
              {user.username && <p className="settings-username">{user.username}</p>}
              <p className="settings-email">{user.email}</p>
              {user.phone && <p className="settings-email">{user.phone}</p>}
              {user.bio && <p className="settings-bio">{user.bio}</p>}
            </div>
            <button type="button" className="btn btn-outline btn-sm settings-edit-btn" onClick={() => setShowEdit(true)}>
              ✏️ Edit Profile
            </button>
          </div>
        </div>

        <div className="settings-options">
          <button type="button" className="settings-row" onClick={() => setShowEdit(true)}>
            <span>✏️ Edit profile</span>
            <span className="settings-row-arrow">›</span>
          </button>

          {user.username && isSeller && (
            <Link to={profilePath(user.username)} className="settings-row">
              <span>👤 View my public profile</span>
              <span className="settings-row-arrow">›</span>
            </Link>
          )}

          {!isSeller && (
            <Link to="/start-yours" className="settings-row">
              <span>🚀 More — Become a Seller</span>
              <span className="settings-row-arrow">›</span>
            </Link>
          )}

          <button type="button" className="settings-row settings-row-danger" onClick={handleLogout}>
            <span>🚪 Logout</span>
            <span className="settings-row-arrow">›</span>
          </button>
        </div>
      </div>

      {showEdit && (
        <EditAccountModal
          onClose={() => setShowEdit(false)}
          onSaved={(msg) => { showSuccess(msg); setShowEdit(false) }}
        />
      )}
    </section>
  )
}

export default Settings
