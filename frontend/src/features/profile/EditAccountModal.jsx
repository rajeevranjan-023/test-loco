import React, { useEffect, useRef, useState } from 'react'
import Modal from '../../components/common/Modal.jsx'
import MediaUploadField from '../../components/common/MediaUploadField.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import { api } from '../../services/api.js'
import '../../css/EditAccount.css'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  normalizeUsername,
  validateName,
  validateEmail,
  validatePhone,
  validateUsername,
  validateBio,
} from '../../utils/validators.js'

const BIO_MAX = 160

// A labelled field row: label + pencil icon, the input, and its own error line.
function Field({ label, error, children, hint }) {
  return (
    <div className="edit-account-field">
      <label className="edit-account-label">
        <span>{label}</span>
        <span className="edit-account-pencil" aria-hidden="true">✏️</span>
      </label>
      {children}
      {hint && !error && <p className="edit-account-hint">{hint}</p>}
      {error && <p className="edit-account-error">⚠️ {error}</p>}
    </div>
  )
}

// Instagram-style "Edit Profile" for ANY logged-in user (consumer or seller).
// It only ever edits the signed-in user's own account: the backend derives
// the target from the auth token, never from anything sent by the client.
function EditAccountModal({ onClose, onSaved }) {
  const { user, updateUser } = useAuth()

  const initial = {
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || '',
    bannerUrl: user?.bannerUrl || '',
  }

  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  // 'idle' | 'unchanged' | 'checking' | 'available' | 'taken'
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const checkSeq = useRef(0)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const hasChanges = Object.keys(initial).some((k) => (form[k] || '') !== (initial[k] || ''))

  // ---- Live username availability (debounced) ----
  useEffect(() => {
    const normalized = normalizeUsername(form.username)

    if (!normalized || normalized === (user?.username || '')) {
      setUsernameStatus(normalized ? 'unchanged' : 'idle')
      return undefined
    }
    if (validateUsername(form.username)) {
      setUsernameStatus('idle') // format error is shown by the validator instead
      return undefined
    }

    setUsernameStatus('checking')
    const seq = ++checkSeq.current
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/seller/check-username/${encodeURIComponent(normalized)}`, { requiresAuth: true })
        if (seq === checkSeq.current) setUsernameStatus(res.available ? 'available' : 'taken')
      } catch {
        // If the check itself fails, don't block the user — the server
        // re-validates uniqueness on save anyway.
        if (seq === checkSeq.current) setUsernameStatus('idle')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [form.username, user?.username])

  const validateAll = () => {
    const next = {
      name: validateName(form.name),
      username: validateUsername(form.username) || (usernameStatus === 'taken' ? 'That username is already taken.' : ''),
      email: validateEmail(form.email),
      phone: validatePhone(form.phone),
      bio: validateBio(form.bio),
    }
    Object.keys(next).forEach((k) => { if (!next[k]) delete next[k] })
    return next
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    setServerError('')

    const found = validateAll()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      const result = await api.patch('/api/auth/me', {
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        bio: form.bio,
        avatarUrl: form.avatarUrl,
        bannerUrl: form.bannerUrl,
      }, { requiresAuth: true })

      updateUser(result.user) // instant reflection everywhere, no reload
      onSaved?.('Profile updated.', result.user)
    } catch (err) {
      // Route server-side validation messages to the right field.
      const msg = err.message || 'Could not save your changes.'
      const lower = msg.toLowerCase()
      if (lower.includes('username')) setErrors((p) => ({ ...p, username: msg }))
      else if (lower.includes('email')) setErrors((p) => ({ ...p, email: msg }))
      else if (lower.includes('phone')) setErrors((p) => ({ ...p, phone: msg }))
      else if (lower.includes('bio')) setErrors((p) => ({ ...p, bio: msg }))
      else if (lower.includes('name')) setErrors((p) => ({ ...p, name: msg }))
      else setServerError(msg)
    } finally {
      setSaving(false)
    }
  }

  const usernameHint =
    usernameStatus === 'checking' ? 'Checking availability…'
      : usernameStatus === 'available' ? '✅ Username is available'
        : usernameStatus === 'taken' ? ''
          : 'Letters, numbers and underscores, e.g. @rajeev_ranjan'

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Profile"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="submit"
            form="edit-account-form"
            className="btn btn-primary btn-sm"
            disabled={saving || !hasChanges}
          >
            {saving ? <Spinner size="sm" label="Saving…" /> : 'Save'}
          </button>
        </>
      }
    >
      <form id="edit-account-form" onSubmit={handleSave} noValidate>
        <MediaUploadField
          label="Banner image"
          value={form.bannerUrl}
          onChange={(bannerUrl) => set({ bannerUrl })}
          folder="banners"
          kind="image"
          shape="wide"
        />

        <MediaUploadField
          label="Profile photo"
          value={form.avatarUrl}
          onChange={(avatarUrl) => set({ avatarUrl })}
          folder="avatars"
          kind="image"
          shape="circle"
        />

        <Field label="Name" error={errors.name}>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your name" autoComplete="name" />
        </Field>

        <Field label="Username" error={errors.username} hint={usernameHint}>
          <input
            value={form.username}
            onChange={(e) => set({ username: e.target.value })}
            placeholder="@username"
            autoComplete="username"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Email" error={errors.email}>
          <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" autoComplete="email" />
        </Field>

        <Field label="Phone number" error={errors.phone}>
          <input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 98765 43210" autoComplete="tel" />
        </Field>

        <Field label="Bio" error={errors.bio}>
          <textarea rows="3" value={form.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="Tell people a little about yourself" />
          <p className="edit-account-counter">{form.bio.length}/{BIO_MAX}</p>
        </Field>

        {serverError && <p className="lf-modal-error">⚠️ {serverError}</p>}
      </form>
    </Modal>
  )
}

export default EditAccountModal
