import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useFeedback } from '../../hooks/useFeedback.js'
import FeedbackBanner from '../FeedbackBanner.jsx'
import EditProfileModal from '../../features/profile/EditProfileModal.jsx'
import FollowListModal from '../../features/follow/FollowListModal.jsx'
import ReviewForm from '../../features/review/ReviewForm.jsx'
import { Button } from './ui.jsx'
import { profilePath } from '../../utils/username.js'
import ProductsPanel from './ProductsPanel.jsx'
import { ProfileHeader, AboutCard, ShopInformation, PhotosSection, CategoriesSection, ReviewsSection, SimilarShops } from './PublicSections.jsx'
import { StatsRow, BasicInformation, ShopImages, SocialLinks, EditAboutModal, EditSocialsModal } from './OwnerSections.jsx'

// The shop profile (route /:username). Same page for everyone — `isOwner` swaps the action buttons and adds the management cards.
// All content comes from the API: /api/profile/:username(?lite=1), /products, /similar, /stats, /api/reviews.
// `embedded` = rendered inside the owner shell, which already supplies the page width/padding (so no second container here).
export default function ShopProfile({ profile, isOwner: ownerAccess, embedded = false, refresh }) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { feedback, showSuccess, showError } = useFeedback()
  const [preview, setPreview] = useState(false)       // owner pressed "View Shop" → see the page as customers do
  const [modal, setModal] = useState(null)            // 'profile' | 'about' | 'socials' | 'review'
  const [followList, setFollowList] = useState(null)
  const [preset, setPreset] = useState(null)          // category clicked in "Shop Categories"
  const [reviewKey, setReviewKey] = useState(0)
  const [cart, setCart] = useState({})                // viewer's cart (client-side for now)
  const isOwner = ownerAccess && !preview

  const { data: stats } = useApiData(
    () => (isOwner ? api.get(`/api/profile/${profile.username}/stats`, { requiresAuth: true }) : Promise.resolve(null)),
    [profile.username, isOwner, profile.productCount]
  )

  const done = (msg) => { setModal(null); showSuccess(msg); refresh() }
  const addToCart = (p) => {
    setCart((c) => ({ ...c, [p.id]: { qty: (c[p.id]?.qty || 0) + 1 } }))
    showSuccess(`${p.name} added to cart`)
  }
  const share = async () => {
    const url = `${window.location.origin}${profilePath(profile.username)}`
    try {
      if (navigator.share) await navigator.share({ title: profile.name, url })
      else { await navigator.clipboard.writeText(url); showSuccess('Profile link copied.') }
    } catch { /* user dismissed the share sheet */ }
  }
  const pickCategory = (name) => setPreset({ name, at: Date.now() })

  const products = (
    <ProductsPanel profile={profile} isOwner={isOwner} categories={profile.categories || []} presetCategory={preset}
      refreshKey={profile.productCount} onChanged={refresh} onToast={(m) => (/fail|error|could not/i.test(m) ? showError(m) : showSuccess(m))}
      cart={cart} onCart={addToCart} />
  )

  return (
    <div className={embedded ? 'w-full min-w-0 space-y-5' : 'mx-auto w-full max-w-[1200px] space-y-5 px-3 pb-10 pt-3 sm:px-5'}>
      <FeedbackBanner feedback={feedback} />

      {ownerAccess && preview && (
        <div className="flex items-center justify-between rounded-xl bg-orange-50 px-4 py-2 text-xs text-orange-700">
          You are previewing your shop as customers see it.
          <Button size="sm" variant="primary" onClick={() => setPreview(false)}>Back to owner view</Button>
        </div>
      )}

      <ProfileHeader profile={profile} isOwner={isOwner} onEditProfile={() => setModal('profile')} onChangeBanner={() => setModal('profile')}
        onShare={share} onViewShop={() => setPreview(true)} onFollowList={setFollowList} />

      {isOwner ? (
        <>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
            <BasicInformation profile={profile} onEdit={() => setModal('profile')} />
            <div className="grid min-w-0 gap-5">
              <AboutCard profile={profile} title="About Your Shop" onEdit={() => setModal('about')} />
              <div className="min-w-0 space-y-5">
                <ShopImages profile={profile} onSaved={done} onError={showError} />
                <SocialLinks profile={profile} onEdit={() => setModal('socials')} />
              </div>
            </div>
          </div>
          <StatsRow stats={stats} />
          {products}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
              <CategoriesSection owner categories={profile.categories} onPick={pickCategory} onAdd={() => showSuccess('Categories come from each product — set one when adding a product.')} />
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
              <ReviewsSection profile={profile} owner refreshKey={reviewKey} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AboutCard profile={profile} />
            <ShopInformation profile={profile} />
          </div>
          <PhotosSection images={profile.images} />
          {products}
          <CategoriesSection categories={profile.categories} onPick={pickCategory} />
          <ReviewsSection profile={profile} refreshKey={reviewKey} canWrite={isAuthenticated && !ownerAccess} onWrite={() => setModal('review')} />
          <SimilarShops username={profile.username} />
        </>
      )}

      {modal === 'profile' && (
        <EditProfileModal profile={profile} onClose={() => setModal(null)} onError={showError}
          onSaved={(msg, u) => {
            setModal(null); showSuccess(msg)
            if (u?.username && u.username !== profile.username) navigate(profilePath(u.username), { replace: true })
            else refresh()
          }} />
      )}
      {modal === 'about' && <EditAboutModal profile={profile} onClose={() => setModal(null)} onSaved={done} onError={showError} />}
      {modal === 'socials' && <EditSocialsModal profile={profile} onClose={() => setModal(null)} onSaved={done} onError={showError} />}
      <ReviewForm open={modal === 'review'} onClose={() => setModal(null)} targetType="shop" targetId={profile.id}
        onSubmitted={() => { setModal(null); setReviewKey((k) => k + 1); refresh() }} />
      <FollowListModal open={!!followList} onClose={() => setFollowList(null)} mode={followList} targetType="shop" targetId={profile.id}
        userId={profile.ownerUserId} title={followList === 'followers' ? 'Followers' : 'Following'} />
    </div>
  )
}
