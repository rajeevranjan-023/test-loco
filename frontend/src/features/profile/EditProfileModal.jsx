import React, { useState } from 'react'
import Modal from '../../components/common/Modal.jsx'
import MediaUploadField from '../../components/common/MediaUploadField.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import { api } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { validateName, validateEmail, validatePhone, validateUsername, validateBio } from '../../utils/validators.js'

const AVAILABILITY_OPTIONS = ['Available Today', 'Busy Today', 'Not Available']

// Owner-only "pencil" edit for a shop/service profile — covers both
// account-level settings (name, username, email, phone, bio, avatar) and
// listing-level fields (banner, description, availability, pricing).
function EditProfileModal({ profile, onClose, onSaved, onError }) {
  const { user, updateUser } = useAuth()
  const isShop = profile.type === 'shop'

  const [form, setForm] = useState({
    name: user?.name || '',
    username: profile.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || '',
    logoUrl: profile.logoUrl || '',
    serviceAvatarUrl: profile.avatarUrl || '',
    bannerUrl: profile.bannerUrl || '',
    videoUrl: profile.videoUrl || '',
    description: profile.description || '',
    availability: profile.availability || 'Available Today',
    priceAmount: profile.price?.amount ?? '',
    priceUnit: profile.price?.unit ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const handleSave = async () => {
    setError('')
    const problem =
      validateName(form.name) ||
      validateUsername(form.username) ||
      validateEmail(form.email) ||
      validatePhone(form.phone) ||
      validateBio(form.bio)
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        bio: form.bio,
        avatarUrl: form.avatarUrl,
        description: form.description,
        bannerUrl: form.bannerUrl,
        ...(isShop
          ? { logoUrl: form.logoUrl }
          : {
              serviceAvatarUrl: form.serviceAvatarUrl, // the service's own public circular photo
              videoUrl: form.videoUrl,
              availability: form.availability,
              priceAmount: form.priceAmount ? Number(form.priceAmount) : undefined,
              priceUnit: form.priceUnit,
            }),
      }
      const result = await api.patch('/api/seller/account', payload, { requiresAuth: true })
      updateUser(result.user)
      onSaved('Profile updated.', result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Profile"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" label="Saving…" /> : 'Save changes'}
          </button>
        </>
      }
    >
      <p className="edit-profile-section-label">Account</p>
      <div className="lf-modal-field-row">
        <label>
          Name
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>
          Username
          <input value={form.username} onChange={(e) => set({ username: e.target.value })} placeholder="@yourname" />
        </label>
      </div>
      <div className="lf-modal-field-row">
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </label>
      </div>
      <label>
        Bio
        <textarea rows="2" maxLength={160} value={form.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="A short line about you or your business…" />
      </label>
      <MediaUploadField label="Personal photo (shown when you appear in others' follower/following lists)" value={form.avatarUrl} onChange={(avatarUrl) => set({ avatarUrl })} folder="avatars" kind="image" />

      <p className="edit-profile-section-label">Listing</p>
      {isShop ? (
        <MediaUploadField label="Shop logo (circle, shown on your profile)" value={form.logoUrl} onChange={(logoUrl) => set({ logoUrl })} folder="logos" kind="image" />
      ) : (
        <MediaUploadField label="Profile photo (circle, shown on your profile)" value={form.serviceAvatarUrl} onChange={(serviceAvatarUrl) => set({ serviceAvatarUrl })} folder="service-avatars" kind="image" />
      )}
      <MediaUploadField label="Banner image (cover photo, shown at the top of your profile)" value={form.bannerUrl} onChange={(bannerUrl) => set({ bannerUrl })} folder="banners" kind="image" />
      {!isShop && (
        <MediaUploadField label="Showcase video" value={form.videoUrl} onChange={(videoUrl) => set({ videoUrl })} folder="service-videos" kind="video" />
      )}

      <label>
        Description
        <textarea rows="4" value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </label>

      {!isShop && (
        <>
          <div className="lf-modal-field-row">
            <label>
              Price amount (₹)
              <input type="number" min="0" value={form.priceAmount} onChange={(e) => set({ priceAmount: e.target.value })} />
            </label>
            <label>
              Price unit
              <select value={form.priceUnit} onChange={(e) => set({ priceUnit: e.target.value })}>
                <option value="hour">per hour</option>
                <option value="day">per day</option>
                <option value="fixed">fixed</option>
              </select>
            </label>
          </div>
          <label>
            Availability
            <select value={form.availability} onChange={(e) => set({ availability: e.target.value })}>
              {AVAILABILITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {error && <p className="lf-modal-error">⚠️ {error}</p>}
    </Modal>
  )
}

export default EditProfileModal
