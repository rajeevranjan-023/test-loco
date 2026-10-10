import React from 'react'

function SkeletonCard({ variant = 'default' }) {
  return (
    <div className={`skeleton-card skeleton-card-${variant}`}>
      <div className="skeleton-block skeleton-thumb" />
      <div className="skeleton-block skeleton-line skeleton-line-lg" />
      <div className="skeleton-block skeleton-line skeleton-line-sm" />
    </div>
  )
}

export default SkeletonCard
