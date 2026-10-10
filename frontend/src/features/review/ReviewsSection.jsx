import React, { useState } from 'react'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { ShimmerList } from '../../components/loading/ShimmerLayouts.jsx'
import ReviewCard from './ReviewCard.jsx'
import ReviewForm from './ReviewForm.jsx'
import StarRating from '../../components/StarRating.jsx'
import '../../css/Review.css'

function ReviewsSection({ profile, isOwner }) {
  const { isAuthenticated } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm] = useState(false)

  const { data, loading } = useApiData(
    () => api.get(`/api/reviews?targetType=${profile.type}&targetId=${profile.id}`),
    [profile.id, refreshKey]
  )

  return (
    <div className="reviews-section">
      <div className="reviews-summary card">
        <div>
          <span className="reviews-summary-avg">{data?.average || profile.rating || 0}</span>
          <StarRating rating={data?.average || profile.rating || 0} />
          <p className="reviews-summary-count">{data?.total || 0} review{data?.total === 1 ? '' : 's'}</p>
        </div>
        {isAuthenticated && !isOwner && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            ✍️ Write a Review
          </button>
        )}
      </div>

      {loading ? (
        <ShimmerList count={3} />
      ) : !data?.reviews?.length ? (
        <p className="detail-empty">No reviews yet — be the first to share your experience.</p>
      ) : (
        <div className="review-list">
          {data.reviews.map((r) => (
            <ReviewCard key={r._id} review={r} />
          ))}
        </div>
      )}

      <ReviewForm
        open={showForm}
        onClose={() => setShowForm(false)}
        targetType={profile.type}
        targetId={profile.id}
        onSubmitted={() => { setShowForm(false); setRefreshKey((k) => k + 1) }}
      />
    </div>
  )
}

export default ReviewsSection
