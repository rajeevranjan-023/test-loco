import React, { useState } from 'react'
import Modal from '../../components/common/Modal.jsx'
import MediaUploadField from '../../components/common/MediaUploadField.jsx'
import StarRatingInput from './StarRatingInput.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import { api } from '../../services/api.js'

function ReviewForm({ open, onClose, targetType, targetId, onSubmitted }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!comment.trim()) {
      setError('Please write a short review before submitting.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.post('/api/reviews', { targetType, targetId, rating, comment, imageUrl }, { requiresAuth: true })
      setComment('')
      setImageUrl('')
      setRating(5)
      onSubmitted()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Write a Review"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" form="review-form" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? <Spinner size="sm" label="Posting…" /> : 'Post Review'}
          </button>
        </>
      }
    >
      <form id="review-form" onSubmit={handleSubmit}>
        <label>Your rating</label>
        <StarRatingInput value={rating} onChange={setRating} />

        <label style={{ marginTop: 16 }}>
          Your review
          <textarea
            rows="4"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience…"
          />
        </label>

        <MediaUploadField label="Add a photo" value={imageUrl} onChange={setImageUrl} folder="reviews" kind="image" />

        {error && <p className="lf-modal-error">⚠️ {error}</p>}
      </form>
    </Modal>
  )
}

export default ReviewForm
