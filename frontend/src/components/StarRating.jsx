import React from 'react'
import { formatRating } from '../utils/format.js'

// Renders a compact star rating, e.g. ★★★★☆ 4.5 (312)
function StarRating({ rating, reviews, size = 'md', showValue = true }) {
  const full = Math.round(rating)
  return (
    <span className={`star-rating star-rating-${size}`}>
      <span className="star-rating-stars">
        {'★'.repeat(full)}
        {'☆'.repeat(5 - full)}
      </span>
      {showValue && <span className="star-rating-value">{formatRating(rating)}</span>}
      {typeof reviews === 'number' && (
        <span className="star-rating-count">({reviews})</span>
      )}
    </span>
  )
}

export default StarRating
