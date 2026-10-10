import React, { useState } from 'react'
import Modal from '../../components/common/Modal.jsx'
import MediaUploadField from '../../components/common/MediaUploadField.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import { api } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { REQUIREMENT_CATEGORIES } from '../../data/requirementCategories.js'

const EMPTY_FORM = { phone: '', email: '', category: '', title: '', description: '', imageUrl: '' }

function PostRequirementModal({ open, onClose, onPosted }) {
  const { user, isAuthenticated } = useAuth()
  const [form, setForm] = useState({ ...EMPTY_FORM, email: user?.email || '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.phone || !form.email || !form.category || !form.title || !form.description) {
      setError('Please fill in phone, email, category, title and description.')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.post('/api/requirements', form, { requiresAuth: isAuthenticated })
      setSuccess(result)
      onPosted?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setForm({ ...EMPTY_FORM, email: user?.email || '' })
    setError('')
    setSuccess(null)
    onClose()
  }

  if (success) {
    return (
      <Modal open={open} onClose={handleClose} title="Requirement posted!" size="sm">
        <p style={{ color: 'var(--color-text-light)', marginBottom: 8 }}>
          ✅ Your requirement has been sent to{' '}
          <strong>{success.notified > 0 ? `${success.notified} relevant seller${success.notified === 1 ? '' : 's'}` : 'nearby sellers'}</strong>{' '}
          in the <strong>{form.category}</strong> category.
        </p>
        <p style={{ color: 'var(--color-text-light)', fontSize: '0.88rem' }}>
          They'll be able to see your contact details and reach out directly.
        </p>
        <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={handleClose}>
          Done
        </button>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Post a Requirement"
      footer={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleClose} disabled={submitting}>Cancel</button>
          <button type="submit" form="post-requirement-form" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? <Spinner size="sm" label="Posting…" /> : 'Post Requirement'}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--color-text-light)', fontSize: '0.88rem', marginBottom: 16 }}>
        Tell us what you need — we'll route it straight to sellers and service providers in that category.
      </p>
      <form id="post-requirement-form" onSubmit={handleSubmit}>
        <div className="lf-modal-field-row">
          <label>
            Phone number
            <input required type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="98765 43210" />
          </label>
          <label>
            Email
            <input required type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" />
          </label>
        </div>

        <label>
          Category
          <select required value={form.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Select a category…</option>
            {REQUIREMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label>
          Requirement title
          <input required value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Need 2 tons of mitti delivered" />
        </label>

        <label>
          Description
          <textarea required rows="4" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Add any details — quantity, timing, budget, location…" />
        </label>

        <MediaUploadField label="Photo" value={form.imageUrl} onChange={(imageUrl) => set({ imageUrl })} folder="requirements" kind="image" />

        {error && <p className="lf-modal-error">⚠️ {error}</p>}
      </form>
    </Modal>
  )
}

export default PostRequirementModal
