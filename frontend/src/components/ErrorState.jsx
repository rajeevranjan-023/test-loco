import React from 'react'

export default function ErrorState({ error, onRetry, title = '', className = 'detail-empty' }) {
  const canRetry = !!onRetry && (error?.retryable ?? true)
  return (
    <div role="alert" className={className}>
      <p>{title}{error?.message || 'Something went wrong. Please try again.'}</p>
      {canRetry && <button type="button" className="btn btn-outline" style={{ marginTop: 12 }} onClick={onRetry}>Try again</button>}
    </div>
  )
}
