import React from 'react'
import StarRating from '../../components/StarRating.jsx'

function ReviewCard({ review }) {
  const date = new Date(review.createdAt).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="review-card card">
      <div className="review-card-top">
        <div>
          <p className="review-card-name">{review.userName}</p>
          <StarRating rating={review.rating} />
        </div>
        <span className="review-card-date">{date}</span>
      </div>
      <p className="review-card-comment">{review.comment}</p>
      {review.imageUrl && <img src={review.imageUrl} alt="" className="review-card-image" />}
    </div>
  )
}

export default ReviewCard
