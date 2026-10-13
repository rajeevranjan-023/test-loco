import React, { useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { useAuth } from '../../context/AuthContext.jsx'
import HomeSection from '../../components/profile/HomeSection.jsx'
import ProductsSection from '../../components/profile/ProductsSection.jsx'
import ServicesSection from '../../components/profile/ServicesSection.jsx'
import AboutSection from '../../components/profile/AboutSection.jsx'
import ReviewsSection from '../review/ReviewsSection.jsx'
import EditProfileModal from './EditProfileModal.jsx'
import FollowButton from '../follow/FollowButton.jsx'
import FollowListModal from '../follow/FollowListModal.jsx'
import EditButton from '../../components/common/EditButton.jsx'
import { useFeedback } from '../../hooks/useFeedback.js'
import FeedbackBanner from '../../components/FeedbackBanner.jsx'
import ProfileSkeleton from '../../components/profile/ProfileSkeleton.jsx'
import { DEFAULT_AVATAR, DEFAULT_BANNER } from '../../utils/placeholders.js'
import '../../css/ShopService.css'
import '../../css/Profile.css'
import { usernameMatches, profilePath } from '../../utils/username.js'
import { useAccess } from '../../components/UsernameRoute.jsx'
import ShopProfile from '../../components/shop/ShopProfile.jsx'
import StudyCenterProfile from '../../components/study/StudyCenterProfile.jsx'

function Frame({ embedded, children }) {
  return embedded
    ? <div className="w-full min-w-0">{children}</div>
    : <section className="section"><div className="container">{children}</div></section>
}

function UnifiedProfilePage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canManage } = useAccess() // owner or admin → management navigation; viewer → public profile only
  const [searchParams, setSearchParams] = useSearchParams()
  const page = searchParams.get('tab') || 'home'
  const setPage = (key) => setSearchParams(key === 'home' ? {} : { tab: key })
  const [refreshKey, setRefreshKey] = useState(0)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [followList, setFollowList] = useState(null) // 'followers' | 'following' | null
  const { feedback, showSuccess, showError } = useFeedback()

  const { data: profile, loading, error } = useApiData(
    () => api.get(`/api/profile/${username}?lite=1`, { requiresAuth: true }),
    [username, refreshKey]
  )

  if (loading && (!profile || !usernameMatches(profile.username, username))) {
    return (
      <Frame embedded={canManage}>
        <ProfileSkeleton />
      </Frame>
    )
  }

  if (error || !profile) {
    return (
      <Frame embedded={canManage}>
        <div className="detail-not-found">
          <h2>Profile not found</h2>
          <p>There's no shop or service provider at {username}.</p>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </Frame>
    )
  }

  const isOwner = usernameMatches(user?.username, profile.username) // owner → admin view, everyone else → visitor view
  const isShop = profile.type === 'shop'
  const avatarSrc = (isShop ? profile.logoUrl : profile.avatarUrl) || DEFAULT_AVATAR
  const bannerSrc = profile.bannerUrl || DEFAULT_BANNER

  if (profile.type === 'study_center') {
    return <StudyCenterProfile profile={profile} isOwner={isOwner} embedded={canManage} refresh={() => setRefreshKey((k) => k + 1)} />
  }
  if (isShop) {
    // Owner/admin: the tab bar is rendered once by the shell (ProfileFrame) — not here.
    return <ShopProfile profile={profile} isOwner={isOwner} embedded={canManage} refresh={() => setRefreshKey((k) => k + 1)} />
  }

  // Public tabs only — identical for viewer and owner. Dashboard / Udhar / Analytics … live under /:username/<section>.
  const tabs = isShop
    ? [
        { key: 'home', label: 'Home' },
        { key: 'products', label: 'Products' },
        { key: 'about', label: 'About' },
        { key: 'reviews', label: 'Reviews' },
      ]
    : [
        { key: 'home', label: 'Home' },
        { key: 'services', label: 'Service Details' },
        { key: 'about', label: 'About' },
        { key: 'reviews', label: 'Reviews' },
      ]

  return (
    <Frame embedded={canManage}>
        <FeedbackBanner feedback={feedback} />

        {/* ---------- Instagram-style header ---------- */}
        <div className="ig-banner" style={{ position: 'relative' }}>
          <img src={bannerSrc} alt="" />
          {isOwner && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ position: 'absolute', right: 12, bottom: 12, background: 'rgba(255,255,255,0.92)' }}
              onClick={() => setShowEditProfile(true)}
            >
              📷 Change Banner
            </button>
          )}
        </div>

        <div className="ig-profile-header">
          <span className="ig-avatar">
            <img src={avatarSrc} alt={profile.name} />
          </span>

          <div className="ig-profile-info">
            <div className="ig-profile-top-row">
              <div>
                <p className="ig-name">{profile.name}</p>
                <h1 className="ig-username">{profile.username}</h1>
              </div>
              {isOwner ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowEditProfile(true)}>
                    ✏️ Edit Profile
                  </button>
                </div>
              ) : (
                <FollowButton
                  targetType={profile.type}
                  targetId={profile.id}
                  initialFollowing={profile.isFollowing}
                  onChange={() => setRefreshKey((k) => k + 1)}
                />
              )}
            </div>

            <div className="ig-stats-row">
              {isShop && (
                <span className="ig-stat"><strong>{profile.productCount ?? 0}</strong> Products</span>
              )}
              <button type="button" className="ig-stat ig-stat-btn" onClick={() => setFollowList('followers')}>
                <strong>{profile.followerCount ?? 0}</strong> Followers
              </button>
              <button type="button" className="ig-stat ig-stat-btn" onClick={() => setFollowList('following')}>
                <strong>{profile.followingCount ?? 0}</strong> Following
              </button>
            </div>

            {profile.bio && <p className="ig-bio">{profile.bio}</p>}
          </div>
        </div>

        {/* ---------- Pill tabs ---------- */}
        <div className="ig-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={'ig-tab ' + (page === t.key ? 'active' : '')}
              onClick={() => setPage(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          {page === 'home' && <HomeSection profile={profile} />}
          {page === 'products' && isShop && <ProductsSection profile={profile} isOwner={isOwner} onChanged={() => setRefreshKey((k) => k + 1)} />}
          {page === 'services' && !isShop && <ServicesSection profile={profile} />}
          {page === 'about' && <AboutSection profile={profile} />}
          {page === 'reviews' && <ReviewsSection profile={profile} isOwner={isOwner} />}
        </div>

      {showEditProfile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditProfile(false)}
          onSaved={(msg, updatedUser) => {
            showSuccess(msg)
            setShowEditProfile(false)
            // If the username changed, this page's URL is now stale — move to
            // the new one (replace, so Back doesn't land on a dead URL).
            if (updatedUser?.username && updatedUser.username !== profile.username) {
              navigate(profilePath(updatedUser.username), { replace: true })
            } else {
              setRefreshKey((k) => k + 1)
            }
          }}
          onError={showError}
        />
      )}

      <FollowListModal
        open={!!followList}
        onClose={() => setFollowList(null)}
        mode={followList}
        targetType={profile.type}
        targetId={profile.id}
        userId={profile.ownerUserId}
        title={followList === 'followers' ? 'Followers' : 'Following'}
      />
    </Frame>
  )
}

export default UnifiedProfilePage
